# --------------------------------------------------------
# BEATs: Audio Pre-Training with Acoustic Tokenizers (https://arxiv.org/abs/2212.09058)
# Github source: https://github.com/microsoft/unilm/tree/master/beats
# Copyright (c) 2022 Microsoft
# Licensed under The MIT License [see LICENSE for details]
# Based on fairseq code bases
# https://github.com/pytorch/fairseq
# --------------------------------------------------------

import math
import numpy as np
from typing import Dict, Optional, Tuple
import torch
from torch import Tensor, nn
import torch.nn.functional as F
from torch.nn import LayerNorm, Parameter
from modules import (
    GradMultiply,
    SamePad,
    get_activation_fn,
    GLU_Linear,
    quant_noise,
)


def init_bert_params(module):
    """
    Initialize the weights specific to the BERT Model.
    """
    def normal_(data):
        data.copy_(
            data.cpu().normal_(mean=0.0, std=0.02).to(data.device)
        )

    if isinstance(module, nn.Linear):
        normal_(module.weight.data)
        if module.bias is not None:
            module.bias.data.zero_()
    if isinstance(module, nn.Embedding):
        normal_(module.weight.data)
        if module.padding_idx is not None:
            module.weight.data[module.padding_idx].zero_()
    if isinstance(module, MultiheadAttention):
        normal_(module.q_proj.weight.data)
        normal_(module.k_proj.weight.data)
        normal_(module.v_proj.weight.data)


class MultiheadAttention(nn.Module):
    def __init__(
            self,
            embed_dim,
            num_heads,
            kdim=None,
            vdim=None,
            dropout=0.0,
            bias=True,
            add_bias_kv=False,
            add_zero_attn=False,
            self_attention=False,
            encoder_decoder_attention=False,
            q_noise=0.0,
            qn_block_size=8,
            has_relative_attention_bias=False,
            num_buckets=32,
            max_distance=128,
            gru_rel_pos=False,
            rescale_init=False,
    ):
        super().__init__()
        self.embed_dim = embed_dim
        self.kdim = kdim if kdim is not None else embed_dim
        self.vdim = vdim if vdim is not None else embed_dim
        self.qkv_same_dim = self.kdim == embed_dim and self.vdim == embed_dim

        self.num_heads = num_heads
        self.dropout_module = nn.Dropout(dropout)

        self.has_relative_attention_bias = has_relative_attention_bias
        self.num_buckets = num_buckets
        self.max_distance = max_distance
        if self.has_relative_attention_bias:
            self.relative_attention_bias = nn.Embedding(num_buckets, num_heads)

        self.head_dim = embed_dim // num_heads
        self.scaling = self.head_dim ** -0.5

        self.self_attention = self_attention
        self.encoder_decoder_attention = encoder_decoder_attention

        k_bias = True
        if rescale_init:
            k_bias = False

        self.k_proj = quant_noise(nn.Linear(self.kdim, embed_dim, bias=k_bias), q_noise, qn_block_size)
        self.v_proj = quant_noise(nn.Linear(self.vdim, embed_dim, bias=bias), q_noise, qn_block_size)
        self.q_proj = quant_noise(nn.Linear(embed_dim, embed_dim, bias=bias), q_noise, qn_block_size)
        self.out_proj = quant_noise(nn.Linear(embed_dim, embed_dim, bias=bias), q_noise, qn_block_size)

        self.bias_k = self.bias_v = None
        self.add_zero_attn = add_zero_attn
        self.gru_rel_pos = gru_rel_pos
        if self.gru_rel_pos:
            self.grep_linear = nn.Linear(self.head_dim, 8)
            self.grep_a = nn.Parameter(torch.ones(1, num_heads, 1, 1))

        self.reset_parameters()

    def reset_parameters(self):
        nn.init.xavier_uniform_(self.k_proj.weight, gain=1 / math.sqrt(2))
        nn.init.xavier_uniform_(self.v_proj.weight, gain=1 / math.sqrt(2))
        nn.init.xavier_uniform_(self.q_proj.weight, gain=1 / math.sqrt(2))
        nn.init.xavier_uniform_(self.out_proj.weight)
        if self.out_proj.bias is not None:
            nn.init.constant_(self.out_proj.bias, 0.0)
        if self.has_relative_attention_bias:
            nn.init.xavier_normal_(self.relative_attention_bias.weight)

    def compute_bias(self, query_length, key_length):
        context_position = torch.arange(query_length, dtype=torch.long)[:, None]
        memory_position = torch.arange(key_length, dtype=torch.long)[None, :]
        relative_position = memory_position - context_position
        
        # simplified bucket logic
        num_buckets = self.num_buckets // 2
        relative_buckets = (relative_position > 0).to(torch.long) * num_buckets
        relative_position = torch.abs(relative_position)
        
        max_exact = num_buckets // 2
        is_small = relative_position < max_exact
        relative_postion_if_large = max_exact + (
                torch.log(relative_position.float() / max_exact)
                / math.log(self.max_distance / max_exact)
                * (num_buckets - max_exact)
        ).to(torch.long)
        relative_postion_if_large = torch.min(
            relative_postion_if_large, torch.full_like(relative_postion_if_large, num_buckets - 1)
        )
        relative_buckets += torch.where(is_small, relative_position, relative_postion_if_large)
        
        values = self.relative_attention_bias(relative_buckets)
        values = values.permute([2, 0, 1])
        return values

    def forward(self, query, key, value, key_padding_mask=None, attn_mask=None, position_bias=None):
        tgt_len, bsz, embed_dim = query.size()
        src_len = key.size(0)
        
        q = self.q_proj(query) * self.scaling
        k = self.k_proj(key)
        v = self.v_proj(value)

        q = q.view(tgt_len, bsz * self.num_heads, self.head_dim).transpose(0, 1)
        k = k.view(src_len, bsz * self.num_heads, self.head_dim).transpose(0, 1)
        v = v.view(src_len, bsz * self.num_heads, self.head_dim).transpose(0, 1)

        if self.has_relative_attention_bias and position_bias is None:
            position_bias = self.compute_bias(tgt_len, src_len)
            position_bias = position_bias.unsqueeze(0).repeat(bsz, 1, 1, 1).view(bsz * self.num_heads, tgt_len, src_len)

        attn_weights = torch.bmm(q, k.transpose(1, 2))
        
        if position_bias is not None:
            attn_weights = attn_weights + position_bias

        if key_padding_mask is not None:
            attn_weights = attn_weights.view(bsz, self.num_heads, tgt_len, src_len)
            attn_weights = attn_weights.masked_fill(key_padding_mask.unsqueeze(1).unsqueeze(2), float("-inf"))
            attn_weights = attn_weights.view(bsz * self.num_heads, tgt_len, src_len)

        attn_probs = F.softmax(attn_weights, dim=-1)
        attn_probs = self.dropout_module(attn_probs)

        attn = torch.bmm(attn_probs, v)
        attn = attn.transpose(0, 1).contiguous().view(tgt_len, bsz, embed_dim)
        attn = self.out_proj(attn)
        return attn, None, position_bias


class TransformerSentenceEncoderLayer(nn.Module):
    def __init__(self, embedding_dim, ffn_embedding_dim, num_attention_heads, dropout, attention_dropout, activation_dropout, activation_fn, layer_norm_first, deep_norm, has_relative_attention_bias, num_buckets, max_distance, rescale_init, gru_rel_pos, encoder_layers):
        super().__init__()
        self.embedding_dim = embedding_dim
        self.layer_norm_first = layer_norm_first
        self.activation_fn = get_activation_fn(activation_fn)
        self.self_attn = MultiheadAttention(embedding_dim, num_attention_heads, dropout=attention_dropout, self_attention=True, has_relative_attention_bias=has_relative_attention_bias, num_buckets=num_buckets, max_distance=max_distance, rescale_init=rescale_init, gru_rel_pos=gru_rel_pos)
        self.dropout1 = nn.Dropout(dropout)
        self.dropout2 = nn.Dropout(activation_dropout)
        self.dropout3 = nn.Dropout(dropout)
        self.self_attn_layer_norm = LayerNorm(embedding_dim)
        self.fc1 = nn.Linear(embedding_dim, ffn_embedding_dim)
        self.fc2 = nn.Linear(ffn_embedding_dim, embedding_dim)
        self.final_layer_norm = LayerNorm(embedding_dim)
        self.alpha = math.pow(2 * encoder_layers, 1 / 4) if deep_norm else 1.0

    def forward(self, x, self_attn_padding_mask=None, pos_bias=None, **kwargs):
        residual = x
        if self.layer_norm_first:
            x = self.self_attn_layer_norm(x)
            x, _, pos_bias = self.self_attn(x, x, x, key_padding_mask=self_attn_padding_mask, position_bias=pos_bias)
            x = residual + self.dropout1(x)
            residual = x
            x = self.final_layer_norm(x)
            x = self.fc2(self.dropout2(self.activation_fn(self.fc1(x))))
            x = residual + self.dropout3(x)
        else:
            x, _, pos_bias = self.self_attn(x, x, x, key_padding_mask=self_attn_padding_mask, position_bias=pos_bias)
            x = residual * self.alpha + self.dropout1(x)
            x = self.self_attn_layer_norm(x)
            residual = x
            x = self.fc2(self.dropout2(self.activation_fn(self.fc1(x))))
            x = residual * self.alpha + self.dropout3(x)
            x = self.final_layer_norm(x)
        return x, None, pos_bias


class TransformerEncoder(nn.Module):
    def __init__(self, args):
        super().__init__()
        self.dropout = args.dropout
        self.embedding_dim = args.encoder_embed_dim
        self.pos_conv = nn.utils.weight_norm(nn.Conv1d(self.embedding_dim, self.embedding_dim, kernel_size=args.conv_pos, padding=args.conv_pos // 2, groups=args.conv_pos_groups), name="weight", dim=2)
        self.pos_conv = nn.Sequential(self.pos_conv, SamePad(args.conv_pos), nn.GELU())
        self.layers = nn.ModuleList([TransformerSentenceEncoderLayer(self.embedding_dim, args.encoder_ffn_embed_dim, args.encoder_attention_heads, args.dropout, args.attention_dropout, args.activation_dropout, args.activation_fn, args.layer_norm_first, args.deep_norm, args.relative_position_embedding, args.num_buckets, args.max_distance, False, args.gru_rel_pos, args.encoder_layers) for _ in range(args.encoder_layers)])
        if args.relative_position_embedding:
            for i in range(1, args.encoder_layers):
                self.layers[i].self_attn.relative_attention_bias = self.layers[0].self_attn.relative_attention_bias
        self.layer_norm = LayerNorm(self.embedding_dim)
        self.layerdrop = args.encoder_layerdrop
        self.apply(init_bert_params)

    def forward(self, x, padding_mask=None):
        if padding_mask is not None:
            x = x.masked_fill(padding_mask.unsqueeze(-1), 0)
        x = x + self.pos_conv(x.transpose(1, 2)).transpose(1, 2)
        x = F.dropout(x, p=self.dropout, training=self.training)
        x = x.transpose(0, 1)
        pos_bias = None
        for layer in self.layers:
            if not self.training or np.random.random() > self.layerdrop:
                x, _, pos_bias = layer(x, self_attn_padding_mask=padding_mask, pos_bias=pos_bias)
        x = x.transpose(0, 1)
        x = self.layer_norm(x)
        return x, None

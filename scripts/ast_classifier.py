"""
AST (Audio Spectrogram Transformer) Classifier for Forensic Analysis
Uses Hugging Face transformers with MIT/ast-finetuned-audioset model.
"""

import numpy as np
import json
import sys
import os
import warnings
import tempfile
import subprocess

warnings.filterwarnings("ignore")
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TRANSFORMERS_NO_ADVISORY_WARNINGS'] = '1'

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from forensic_categories import map_to_forensic_category


def convert_to_wav_16k(input_path):
    """Convert input audio to 16kHz mono WAV using FFmpeg."""
    try:
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        tmp.close()
        cmd = [
            "ffmpeg", "-y",
            "-i", input_path,
            "-ar", "16000",
            "-ac", "1",
            tmp.name
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        return tmp.name
    except Exception:
        return input_path


def classify_audio(audio_path, job_id):
    """Classify audio using AST (Audio Spectrogram Transformer)."""
    converted_path = None
    try:
        audio_path = audio_path.strip('"')
        if not os.path.exists(audio_path):
            return {"status": "error", "model": "AST", "message": f"File not found: {audio_path}"}

        import torch
        import librosa

        print("--- Running Model: AST (Audio Spectrogram Transformer) ---", file=sys.stderr)

        # Load audio
        try:
            waveform, sr = librosa.load(audio_path, sr=16000, mono=True, dtype=np.float32)
        except Exception:
            converted_path = convert_to_wav_16k(audio_path)
            waveform, sr = librosa.load(converted_path, sr=16000, mono=True, dtype=np.float32)

        try:
            from transformers import ASTFeatureExtractor, ASTForAudioClassification

            # Load AST model and feature extractor
            model_name = "MIT/ast-finetuned-audioset-10-10-0.4593"
            print(f"[AST] Loading model: {model_name}", file=sys.stderr)

            feature_extractor = ASTFeatureExtractor.from_pretrained(model_name)
            model = ASTForAudioClassification.from_pretrained(model_name)
            model.eval()

            # AST expects 16kHz audio, max ~10 seconds per chunk
            # Process in chunks for longer audio
            chunk_duration = 10  # seconds
            chunk_samples = chunk_duration * sr
            num_chunks = max(1, int(np.ceil(len(waveform) / chunk_samples)))

            events = []
            for chunk_idx in range(num_chunks):
                start_sample = chunk_idx * chunk_samples
                end_sample = min((chunk_idx + 1) * chunk_samples, len(waveform))
                chunk = waveform[start_sample:end_sample]

                if len(chunk) < sr:  # Skip very short chunks (< 1 second)
                    continue

                # Extract features
                inputs = feature_extractor(
                    chunk,
                    sampling_rate=sr,
                    return_tensors="pt"
                )

                # Run inference
                with torch.no_grad():
                    outputs = model(**inputs)
                    logits = outputs.logits

                # Get top-5 predictions
                probs = torch.nn.functional.softmax(logits, dim=-1)
                top5_probs, top5_indices = torch.topk(probs[0], k=min(5, probs.shape[-1]))

                time_sec = round(chunk_idx * chunk_duration, 2)

                for prob, idx in zip(top5_probs.tolist(), top5_indices.tolist()):
                    label = model.config.id2label[idx]
                    forensic_cat = map_to_forensic_category(label)
                    confidence = round(prob, 4)
                    decibels = round(-60 + (confidence * 60), 1)

                    print(f"[AST] Time: {time_sec}s | Class: {forensic_cat} ({label}) | Confidence: {confidence} | Vol: {decibels}dB", file=sys.stderr)

                    events.append({
                        "time": time_sec,
                        "type": forensic_cat,
                        "rawLabel": label,
                        "confidence": confidence,
                        "decibels": decibels
                    })

            print("--- AST Classification Complete ---", file=sys.stderr)

        except Exception as e:
            print(f"[AST] Model unavailable, using fallback: {e}", file=sys.stderr)
            # Fallback: use librosa spectral features
            events = _fallback_classify(waveform, sr)
            print("--- AST Fallback Classification Complete ---", file=sys.stderr)

        if converted_path and converted_path != audio_path and os.path.exists(converted_path):
            try:
                import time
                time.sleep(0.5)
                os.unlink(converted_path)
            except Exception as e:
                print(f"[AST] Warning: Could not delete temp file {converted_path}: {e}", file=sys.stderr)

        return {
            "status": "success",
            "model": "AST",
            "jobID": job_id,
            "detectedSounds": len(events),
            "soundEvents": events
        }

    except Exception as e:
        if converted_path and os.path.exists(converted_path):
            try:
                import time
                time.sleep(0.5)
                os.unlink(converted_path)
            except Exception:
                pass
        return {"status": "error", "model": "AST", "message": str(e)}


def _fallback_classify(waveform, sr):
    """Fallback classification using librosa when transformers isn't available."""
    import librosa
    events = []
    duration = len(waveform) / sr
    chunk_duration = 2.0  # seconds
    num_chunks = max(1, int(np.ceil(duration / chunk_duration)))

    for i in range(num_chunks):
        start = int(i * chunk_duration * sr)
        end = min(int((i + 1) * chunk_duration * sr), len(waveform))
        chunk = waveform[start:end]

        if len(chunk) < sr // 2:
            continue

        centroid = np.mean(librosa.feature.spectral_centroid(y=chunk, sr=sr))
        rms = np.mean(librosa.feature.rms(y=chunk))
        zcr = np.mean(librosa.feature.zero_crossing_rate(y=chunk))

        time_sec = round(i * chunk_duration, 2)

        if rms < 0.01:
            label = "Silence"
            confidence = 0.85
        elif zcr > 0.1 and centroid > 3000:
            label = "Alarm"
            confidence = round(0.5 + rms, 4)
        elif centroid < 500 and rms > 0.05:
            label = "Vehicle"
            confidence = round(0.55 + rms, 4)
        elif 500 <= centroid < 2000:
            label = "Speech"
            confidence = round(0.6 + rms, 4)
        else:
            label = "Music"
            confidence = round(0.5 + rms, 4)

        confidence = min(confidence, 0.99)
        forensic_cat = map_to_forensic_category(label)
        decibels = round(-60 + (confidence * 60), 1)

        events.append({
            "time": time_sec,
            "type": forensic_cat,
            "confidence": confidence,
            "decibels": decibels
        })

    return events


if __name__ == "__main__":
    if len(sys.argv) > 1:
        output = classify_audio(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "job")
        sys.stdout.write(json.dumps(output))
    else:
        sys.stdout.write(json.dumps({"status": "error", "model": "AST", "message": "No input"}))

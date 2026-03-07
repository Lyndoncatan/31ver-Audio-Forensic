"""
Wav2Vec 2.0 Classifier for Forensic Analysis
Uses Hugging Face transformers with facebook/wav2vec2-base-960h model.
Primarily acts as a precise Human Voice / Speech detector by attempting ASR.
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
    """Classify audio using Wav2Vec 2.0 (ASR to detect Speech)."""
    converted_path = None
    try:
        audio_path = audio_path.strip('"')
        if not os.path.exists(audio_path):
            return {"status": "error", "model": "Wav2Vec2", "message": f"File not found: {audio_path}"}

        import torch
        import librosa

        print("--- Running Model: Wav2Vec 2.0 (Speech Detection) ---", file=sys.stderr)

        # Load audio
        try:
            waveform, sr = librosa.load(audio_path, sr=16000, mono=True, dtype=np.float32)
        except Exception:
            converted_path = convert_to_wav_16k(audio_path)
            waveform, sr = librosa.load(converted_path, sr=16000, mono=True, dtype=np.float32)

        try:
            from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC

            # Load Wav2Vec2 model and processor
            model_name = "facebook/wav2vec2-base-960h"
            print(f"[Wav2Vec2] Loading model: {model_name}", file=sys.stderr)

            processor = Wav2Vec2Processor.from_pretrained(model_name)
            model = Wav2Vec2ForCTC.from_pretrained(model_name)
            model.eval()

            # Process in chunks of 5 seconds to avoid memory issues and get timed events
            chunk_duration = 5  # seconds
            chunk_samples = chunk_duration * sr
            num_chunks = max(1, int(np.ceil(len(waveform) / chunk_samples)))

            events = []
            
            # Since Wav2Vec2 is strictly speech recognition, we look for confident character outputs
            for chunk_idx in range(num_chunks):
                start_sample = chunk_idx * chunk_samples
                end_sample = min((chunk_idx + 1) * chunk_samples, len(waveform))
                chunk = waveform[start_sample:end_sample]

                if len(chunk) < sr:  # Skip very short chunks (< 1 second)
                    continue

                # Extract features
                input_values = processor(
                    chunk, 
                    sampling_rate=sr, 
                    return_tensors="pt"
                ).input_values

                # Run inference
                with torch.no_grad():
                    logits = model(input_values).logits

                # Calculate confidence and get transcription
                probs = torch.nn.functional.softmax(logits, dim=-1)
                predicted_ids = torch.argmax(logits, dim=-1)
                transcription = processor.batch_decode(predicted_ids)[0]
                
                # Simple empirical confidence proxy: average confidence of the most likely tokens
                max_probs = torch.max(probs, dim=-1).values
                # We ignore the <pad> token (usually ID 0 in wav2vec2) for confidence
                non_pad_mask = predicted_ids != processor.tokenizer.pad_token_id
                if non_pad_mask.sum() > 0:
                    confidence = float(max_probs[non_pad_mask].mean().item())
                else:
                    confidence = 0.0

                time_sec = round(chunk_idx * chunk_duration, 2)

                # Only register as Human Voice if it confidently transcribed something
                # Or if confidence is moderately high despite poor transcription
                if len(transcription.strip()) > 2 or confidence > 0.6:
                    forensic_cat = map_to_forensic_category("Speech")
                    # Scale confidence slightly appropriately
                    display_conf = round(min(confidence + 0.1, 0.99), 4) if len(transcription.strip()) > 2 else round(confidence, 4)
                    decibels = round(-60 + (display_conf * 60), 1)
                    
                    raw_label_info = f"Speech (ASR: '{transcription}')" if transcription else "Speech (Vocal activity)"

                    print(f"[Wav2Vec2] Time: {time_sec}s | Class: {forensic_cat} | Conf: {display_conf} | Transcript: '{transcription}'", file=sys.stderr)

                    events.append({
                        "time": time_sec,
                        "type": forensic_cat,
                        "rawLabel": raw_label_info,
                        "confidence": display_conf,
                        "decibels": decibels
                    })

            print("--- Wav2Vec 2.0 Classification Complete ---", file=sys.stderr)

        except Exception as e:
            print(f"[Wav2Vec2] Model unavailable, using fallback: {e}", file=sys.stderr)
            # Fallback: use energy-based speech detection
            events = []
            chunk_duration = 5
            num_chunks = max(1, int(np.ceil(len(waveform) / (chunk_duration * sr))))
            for chunk_idx in range(num_chunks):
                start = chunk_idx * chunk_duration * sr
                end = min((chunk_idx + 1) * chunk_duration * sr, len(waveform))
                chunk = waveform[int(start):int(end)]
                if len(chunk) < sr:
                    continue
                rms = float(np.sqrt(np.mean(chunk ** 2)))
                zcr = float(np.mean(np.abs(np.diff(np.sign(chunk)))))
                time_sec = round(chunk_idx * chunk_duration, 2)
                # Speech-like: moderate energy, moderate zero-crossing rate
                if rms > 0.01 and 0.02 < zcr < 0.15:
                    confidence = round(min(0.5 + rms * 2, 0.95), 4)
                    forensic_cat = map_to_forensic_category("Speech")
                    decibels = round(-60 + (confidence * 60), 1)
                    events.append({
                        "time": time_sec,
                        "type": forensic_cat,
                        "rawLabel": "Speech (Energy-based detection)",
                        "confidence": confidence,
                        "decibels": decibels
                    })
            print("--- Wav2Vec 2.0 Fallback Classification Complete ---", file=sys.stderr)

        if converted_path and converted_path != audio_path and os.path.exists(converted_path):
            try:
                # Sometimes file descriptor is held briefly by librosa/soundfile on Windows
                import time
                time.sleep(0.5)
                os.unlink(converted_path)
            except Exception as e:
                print(f"[Wav2Vec2] Warning: Could not delete temp file {converted_path}: {e}", file=sys.stderr)

        return {
            "status": "success",
            "model": "Wav2Vec2",
            "jobID": job_id,
            "detectedSounds": len(events),
            "soundEvents": events
        }

    except Exception as e:
        import traceback
        traceback.print_exc(file=sys.stderr)
        if converted_path and os.path.exists(converted_path):
            try:
                import time
                time.sleep(0.5)
                os.unlink(converted_path)
            except Exception:
                pass
        return {"status": "error", "model": "Wav2Vec2", "message": str(e)}


if __name__ == "__main__":
    if len(sys.argv) > 1:
        output = classify_audio(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "job")
        sys.stdout.write(json.dumps(output))
    else:
        sys.stdout.write(json.dumps({"status": "error", "model": "Wav2Vec2", "message": "No input"}))

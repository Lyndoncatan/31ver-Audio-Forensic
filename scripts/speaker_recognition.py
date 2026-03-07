"""
Speaker Recognition & Voice Separation Engine
Uses pyannote.audio for speaker diarization (who spoke when)
and SpeechBrain ECAPA-TDNN for speaker embeddings (voice fingerprints).

Pipeline:
  1. Load audio (preferably the Demucs vocals stem for cleaner results)
  2. Run pyannote speaker-diarization-3.1 → time segments per speaker
  3. Extract each speaker's audio into individual WAV files
  4. Generate speaker embeddings via SpeechBrain for verification/comparison
  5. Compute similarity matrix between all detected speakers
  6. Return structured JSON with all results
"""

import sys
import os
import json
import warnings
import numpy as np

# Suppress warnings for clean JSON output
warnings.filterwarnings("ignore")
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

# Setup paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)

# Add local ffmpeg to PATH
FFMPEG_DIR = os.path.join(PROJECT_DIR, "ffmpeg")
if os.path.exists(FFMPEG_DIR):
    os.environ["PATH"] = FFMPEG_DIR + os.pathsep + os.environ.get("PATH", "")

# Load environment variables
from dotenv import load_dotenv
load_dotenv(os.path.join(PROJECT_DIR, ".env"))
load_dotenv(os.path.join(BASE_DIR, ".env"))


def run_speaker_recognition(audio_path, output_dir, job_id):
    """
    Main entry point for speaker recognition.
    
    Args:
        audio_path: Path to audio file (ideally the Demucs vocals stem)
        output_dir: Directory to save extracted voice files
        job_id: Unique job identifier
    
    Returns:
        dict with speaker analysis results
    """
    debug_log = []
    
    def log(msg):
        debug_log.append(str(msg))
        print(f"[SpeakerID] {msg}", file=sys.stderr)
    
    try:
        log(f"Starting speaker recognition. Input: {audio_path}")
        audio_path = os.path.abspath(audio_path.strip('"'))
        output_dir = os.path.abspath(output_dir.strip('"'))
        
        if not os.path.exists(audio_path):
            return {
                "status": "error",
                "message": f"Audio file not found: {audio_path}",
                "debug": debug_log
            }
        
        # ============================================================
        # STEP 1: Load Audio
        # ============================================================
        log("Loading audio...")
        import torch
        import io
        import soundfile as sf
        from pydub import AudioSegment
        
        # Set pydub ffmpeg paths
        ffmpeg_exe = os.path.join(FFMPEG_DIR, "ffmpeg.exe")
        ffprobe_exe = os.path.join(FFMPEG_DIR, "ffprobe.exe")
        if os.path.exists(ffmpeg_exe):
            AudioSegment.converter = ffmpeg_exe
        if os.path.exists(ffprobe_exe):
            AudioSegment.ffprobe = ffprobe_exe
        
        # Decode audio to 16kHz mono (required by pyannote)
        audio_segment = AudioSegment.from_file(audio_path)
        audio_segment = audio_segment.set_frame_rate(16000).set_channels(1)
        
        buffer = io.BytesIO()
        audio_segment.export(buffer, format="wav")
        buffer.seek(0)
        data, samplerate = sf.read(buffer)
        
        waveform = torch.tensor(data).float().unsqueeze(0)
        total_duration = len(data) / samplerate
        log(f"Audio loaded: {total_duration:.2f}s, {samplerate}Hz")
        
        # ============================================================
        # STEP 2: Speaker Diarization (pyannote)
        # ============================================================
        log("Running speaker diarization (pyannote.audio 3.1)...")
        
        HF_TOKEN = os.getenv("HF_TOKEN")
        if not HF_TOKEN:
            log("WARNING: HF_TOKEN not found. Attempting without token...")
        
        from pyannote.audio import Pipeline as DiarizationPipeline
        
        try:
            if HF_TOKEN:
                from huggingface_hub import login
                login(token=HF_TOKEN, add_to_git_credential=False)
            
            diarization_pipeline = DiarizationPipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=HF_TOKEN
            )
            diarization_pipeline.to(torch.device("cpu"))
            
            log("Diarization model loaded. Analyzing speakers...")
            diarization = diarization_pipeline({
                "waveform": waveform,
                "sample_rate": samplerate
            })
            
        except Exception as e:
            log(f"Diarization failed: {e}")
            log("Falling back to energy-based voice activity detection...")
            return _fallback_speaker_detection(audio_path, data, samplerate, 
                                                output_dir, job_id, debug_log)
        
        # ============================================================
        # STEP 3: Parse Diarization Results & Extract Voice Segments
        # ============================================================
        log("Parsing diarization results...")
        
        # Collect segments per speaker
        speaker_segments = {}  # {speaker_label: [(start, end), ...]}
        all_segments = []
        
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            speaker_label = speaker  # e.g., "SPEAKER_00"
            start = round(turn.start, 2)
            end = round(turn.end, 2)
            
            if speaker_label not in speaker_segments:
                speaker_segments[speaker_label] = []
            speaker_segments[speaker_label].append((start, end))
            
            all_segments.append({
                "start": start,
                "end": end,
                "speaker": speaker_label
            })
        
        speaker_count = len(speaker_segments)
        log(f"Detected {speaker_count} unique speaker(s)")
        log(f"Total segments: {len(all_segments)}")
        
        if speaker_count == 0:
            log("No speakers detected in audio.")
            return {
                "status": "success",
                "speakerCount": 0,
                "totalDuration": round(total_duration, 2),
                "segments": [],
                "speakers": [],
                "similarityMatrix": [],
                "debug": debug_log
            }
        
        # ============================================================
        # STEP 4: Extract Individual Speaker Audio Files
        # ============================================================
        log("Extracting individual speaker audio files...")
        
        speakers_dir = os.path.join(output_dir, "speakers", job_id)
        os.makedirs(speakers_dir, exist_ok=True)
        
        from scipy.io import wavfile
        
        speakers_info = []
        speaker_audio_data = {}  # Store audio arrays for embedding extraction
        
        for speaker_label, segments in speaker_segments.items():
            # Concatenate all segments for this speaker
            speaker_audio_parts = []
            total_speaking_time = 0
            
            for start_time, end_time in segments:
                start_idx = int(start_time * samplerate)
                end_idx = int(end_time * samplerate)
                start_idx = max(0, start_idx)
                end_idx = min(len(data), end_idx)
                
                if end_idx > start_idx:
                    segment_audio = data[start_idx:end_idx]
                    speaker_audio_parts.append(segment_audio)
                    total_speaking_time += (end_time - start_time)
            
            if speaker_audio_parts:
                # Add tiny fade between concatenated segments to avoid clicks
                fade_samples = min(160, min(len(p) for p in speaker_audio_parts) // 4)
                concatenated = []
                for i, part in enumerate(speaker_audio_parts):
                    if i > 0 and fade_samples > 0:
                        # Cross-fade
                        part = part.copy()
                        fade_len = min(fade_samples, len(part))
                        part[:fade_len] *= np.linspace(0, 1, fade_len)
                    if i < len(speaker_audio_parts) - 1 and fade_samples > 0:
                        part = part.copy()
                        fade_len = min(fade_samples, len(part))
                        part[-fade_len:] *= np.linspace(1, 0, fade_len)
                    concatenated.append(part)
                
                speaker_audio = np.concatenate(concatenated)
                
                # Normalize
                peak = np.max(np.abs(speaker_audio))
                if peak > 0:
                    speaker_audio = speaker_audio / peak * 0.95
                
                # Save WAV
                safe_label = speaker_label.replace(" ", "_")
                wav_filename = f"voice_{safe_label}.wav"
                wav_path = os.path.join(speakers_dir, wav_filename)
                
                int16_audio = (speaker_audio * 32767).astype(np.int16)
                wavfile.write(wav_path, samplerate, int16_audio)
                
                # Store for embedding extraction
                speaker_audio_data[speaker_label] = speaker_audio
                
                # URL path for frontend
                relative_url = f"/separated_audio/speakers/{job_id}/{wav_filename}"
                
                speaking_pct = round((total_speaking_time / total_duration) * 100, 1) if total_duration > 0 else 0
                
                speakers_info.append({
                    "label": speaker_label,
                    "audioUrl": relative_url,
                    "speakingTime": round(total_speaking_time, 2),
                    "speakingPercent": speaking_pct,
                    "segmentCount": len(segments),
                    "firstAppearance": segments[0][0],
                    "lastAppearance": segments[-1][1]
                })
                
                log(f"  {speaker_label}: {total_speaking_time:.1f}s ({speaking_pct}%), {len(segments)} segments → {wav_filename}")
        
        # ============================================================
        # STEP 5: Speaker Embeddings & Similarity (SpeechBrain)
        # ============================================================
        similarity_matrix = []
        embedding_status = "skipped"
        
        try:
            log("Generating speaker embeddings (SpeechBrain ECAPA-TDNN)...")
            from speechbrain.inference.speaker import EncoderClassifier
            
            classifier = EncoderClassifier.from_hparams(
                source="speechbrain/spkrec-ecapa-voxceleb",
                savedir=os.path.join(PROJECT_DIR, "models", "speechbrain_ecapa"),
                run_opts={"device": "cpu"}
            )
            
            embeddings = {}
            speaker_labels_ordered = list(speaker_audio_data.keys())
            
            for speaker_label in speaker_labels_ordered:
                audio_np = speaker_audio_data[speaker_label]
                # SpeechBrain expects torch tensor
                audio_tensor = torch.tensor(audio_np).float().unsqueeze(0)
                
                # Get embedding
                emb = classifier.encode_batch(audio_tensor)
                embeddings[speaker_label] = emb.squeeze().detach().numpy()
                log(f"  Embedding for {speaker_label}: shape {embeddings[speaker_label].shape}")
            
            # Compute cosine similarity matrix
            if len(speaker_labels_ordered) > 1:
                log("Computing speaker similarity matrix...")
                for i, spk_a in enumerate(speaker_labels_ordered):
                    row = []
                    for j, spk_b in enumerate(speaker_labels_ordered):
                        emb_a = embeddings[spk_a]
                        emb_b = embeddings[spk_b]
                        # Cosine similarity
                        cos_sim = float(np.dot(emb_a, emb_b) / 
                                       (np.linalg.norm(emb_a) * np.linalg.norm(emb_b) + 1e-8))
                        row.append({
                            "speakerA": spk_a,
                            "speakerB": spk_b,
                            "similarity": round(cos_sim, 4)
                        })
                    similarity_matrix.append(row)
                
                log("Similarity matrix computed.")
            
            embedding_status = "success"
            
        except ImportError:
            log("SpeechBrain not installed. Skipping embedding extraction.")
            log("Install with: pip install speechbrain")
            embedding_status = "not_installed"
        except Exception as e:
            log(f"Embedding extraction failed: {e}")
            embedding_status = f"error: {str(e)}"
        
        # ============================================================
        # STEP 6: Build Final Result
        # ============================================================
        result = {
            "status": "success",
            "speakerCount": speaker_count,
            "totalDuration": round(total_duration, 2),
            "segments": all_segments,
            "speakers": speakers_info,
            "similarityMatrix": similarity_matrix,
            "embeddingStatus": embedding_status,
            "debug": debug_log
        }
        
        log(f"Speaker recognition complete. {speaker_count} speakers found.")
        return result
        
    except Exception as e:
        import traceback
        log(f"CRITICAL ERROR: {str(e)}")
        log(traceback.format_exc())
        return {
            "status": "error",
            "message": str(e),
            "debug": debug_log
        }


def _fallback_speaker_detection(audio_path, data, samplerate, output_dir, job_id, debug_log):
    """
    Fallback when pyannote is unavailable — uses simple energy-based 
    voice activity detection. Cannot distinguish between speakers,
    but can at least extract voiced segments.
    """
    def log(msg):
        debug_log.append(str(msg))
        print(f"[SpeakerID-Fallback] {msg}", file=sys.stderr)
    
    try:
        from scipy.io import wavfile
        
        total_duration = len(data) / samplerate
        log(f"Running energy-based voice detection on {total_duration:.1f}s audio")
        
        # Compute short-time energy
        frame_size = int(0.025 * samplerate)  # 25ms frames
        hop_size = int(0.010 * samplerate)     # 10ms hop
        
        frames = []
        for i in range(0, len(data) - frame_size, hop_size):
            frame = data[i:i + frame_size]
            energy = np.sum(frame ** 2) / frame_size
            frames.append(energy)
        
        frames = np.array(frames)
        
        # Threshold: above 10% of max energy = voice active
        threshold = np.max(frames) * 0.10
        voiced = frames > threshold
        
        # Find contiguous voiced regions
        segments = []
        in_segment = False
        start = 0
        
        for i, is_voiced in enumerate(voiced):
            time = i * hop_size / samplerate
            if is_voiced and not in_segment:
                start = time
                in_segment = True
            elif not is_voiced and in_segment:
                if time - start > 0.3:  # Minimum 300ms
                    segments.append((round(start, 2), round(time, 2)))
                in_segment = False
        
        if in_segment:
            end_time = len(data) / samplerate
            if end_time - start > 0.3:
                segments.append((round(start, 2), round(end_time, 2)))
        
        log(f"Found {len(segments)} voiced segments")
        
        # Save as single speaker (can't distinguish without diarization)
        speakers_dir = os.path.join(output_dir, "speakers", job_id)
        os.makedirs(speakers_dir, exist_ok=True)
        
        all_voiced_audio = []
        for start_t, end_t in segments:
            s_idx = int(start_t * samplerate)
            e_idx = int(end_t * samplerate)
            all_voiced_audio.append(data[s_idx:e_idx])
        
        speakers_info = []
        all_segments = []
        
        if all_voiced_audio:
            combined = np.concatenate(all_voiced_audio)
            peak = np.max(np.abs(combined))
            if peak > 0:
                combined = combined / peak * 0.95
            
            wav_path = os.path.join(speakers_dir, "voice_SPEAKER_00.wav")
            int16 = (combined * 32767).astype(np.int16)
            wavfile.write(wav_path, samplerate, int16)
            
            total_speaking = sum(e - s for s, e in segments)
            
            speakers_info.append({
                "label": "SPEAKER_00",
                "audioUrl": f"/separated_audio/speakers/{job_id}/voice_SPEAKER_00.wav",
                "speakingTime": round(total_speaking, 2),
                "speakingPercent": round((total_speaking / total_duration) * 100, 1),
                "segmentCount": len(segments),
                "firstAppearance": segments[0][0],
                "lastAppearance": segments[-1][1]
            })
            
            for s, e in segments:
                all_segments.append({
                    "start": s,
                    "end": e,
                    "speaker": "SPEAKER_00"
                })
        
        return {
            "status": "success",
            "speakerCount": 1 if speakers_info else 0,
            "totalDuration": round(total_duration, 2),
            "segments": all_segments,
            "speakers": speakers_info,
            "similarityMatrix": [],
            "embeddingStatus": "fallback_mode",
            "note": "Pyannote unavailable — used energy-based detection. Cannot distinguish multiple speakers.",
            "debug": debug_log
        }
        
    except Exception as e:
        log(f"Fallback also failed: {e}")
        return {
            "status": "error",
            "message": f"Both diarization and fallback failed: {str(e)}",
            "debug": debug_log
        }


def sanitize_for_json(obj):
    """Convert numpy types to native Python types for JSON serialization."""
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(v) for v in obj]
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


if __name__ == "__main__":
    if len(sys.argv) > 3:
        audio_path = sys.argv[1]
        output_dir = sys.argv[2]
        job_id = sys.argv[3]
        result = run_speaker_recognition(audio_path, output_dir, job_id)
        sys.stdout.write(json.dumps(sanitize_for_json(result)))
        sys.stdout.flush()
    else:
        sys.stdout.write(json.dumps({
            "status": "error",
            "message": "Usage: speaker_recognition.py <audio_path> <output_dir> <job_id>"
        }))
        sys.stdout.flush()

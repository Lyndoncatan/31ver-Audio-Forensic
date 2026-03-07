"""
Multi-Model Audio Classifier Orchestrator
Runs all available audio classification models and produces ensemble results.

Models: YAMNet (MediaPipe), VGGish, AST, BEATs, PANNs, Wav2Vec 2.0
"""

import json
import sys
import os
import time
import traceback
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def sanitize_for_json(obj):
    """Recursively convert numpy types to native Python types for JSON serialization."""
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(item) for item in obj]
    elif isinstance(obj, (np.floating,)):
        return float(obj)
    elif isinstance(obj, (np.integer,)):
        return int(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, np.bool_):
        return bool(obj)
    return obj


def run_model(model_name, classify_func, audio_path, job_id):
    """Run a single model with error handling and timing."""
    start_time = time.time()
    try:
        result = classify_func(audio_path, job_id)
        elapsed = round(time.time() - start_time, 2)
        result["processingTime"] = elapsed
        print(f"[Orchestrator] {model_name} completed in {elapsed}s", file=sys.stderr)
        return result
    except Exception as e:
        elapsed = round(time.time() - start_time, 2)
        print(f"[Orchestrator] {model_name} FAILED after {elapsed}s: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return {
            "status": "error",
            "model": model_name,
            "message": str(e),
            "processingTime": elapsed
        }


def compute_ensemble(model_results):
    """
    Compute ensemble consensus from all successful model results.
    Averages confidence scores per forensic category across models.
    """
    category_scores = {}  # { "Human Voice": [0.8, 0.7, 0.9], ... }
    successful_models = 0

    for model_name, result in model_results.items():
        if result.get("status") != "success":
            continue
        
        successful_models += 1
        events = result.get("soundEvents", [])
        
        # Aggregate best confidence per category for this model
        model_categories = {}
        for event in events:
            cat = event.get("type", "Unknown")
            conf = event.get("confidence", 0)
            if cat not in model_categories or conf > model_categories[cat]:
                model_categories[cat] = conf
        
        for cat, conf in model_categories.items():
            if cat not in category_scores:
                category_scores[cat] = []
            category_scores[cat].append(conf)

    if successful_models == 0:
        return {
            "status": "error",
            "message": "No models produced successful results",
            "categories": [],
            "modelsUsed": 0
        }

    # Compute average confidence per category
    ensemble_categories = []
    for cat, scores in category_scores.items():
        avg_confidence = float(round(sum(scores) / len(scores), 4))
        model_agreement = len(scores)  # How many models detected this category
        agreement_ratio = float(round(model_agreement / successful_models, 2))
        
        ensemble_categories.append({
            "type": cat,
            "confidence": avg_confidence,
            "modelAgreement": model_agreement,
            "agreementRatio": agreement_ratio,
            "decibels": float(round(-60 + (avg_confidence * 60), 1))
        })

    # Sort by confidence (highest first)
    ensemble_categories.sort(key=lambda x: x["confidence"], reverse=True)

    return {
        "status": "success",
        "modelsUsed": successful_models,
        "categories": ensemble_categories[:10],  # Top 10
        "topCategory": ensemble_categories[0] if ensemble_categories else None
    }


def classify_audio(audio_path, job_id):
    """Run all models and produce ensemble results."""
    audio_path = audio_path.strip('"')
    
    if not os.path.exists(audio_path):
        return json.dumps({
            "status": "error",
            "message": f"File not found: {audio_path}"
        })

    print("=" * 60, file=sys.stderr)
    print("[Orchestrator] Multi-Model Audio Classification Starting", file=sys.stderr)
    print(f"[Orchestrator] Input: {audio_path}", file=sys.stderr)
    print(f"[Orchestrator] Job ID: {job_id}", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    total_start = time.time()
    model_results = {}

    # --- 1. YAMNet (MediaPipe) - Existing model ---
    print("\n[Orchestrator] Running YAMNet...", file=sys.stderr)
    try:
        from mediapipe_audio_classifier import classify_audio as yamnet_classify
        model_results["yamnet"] = run_model("YAMNet", yamnet_classify, audio_path, job_id)
    except Exception as e:
        model_results["yamnet"] = {
            "status": "error", "model": "YAMNet", "message": str(e), "processingTime": 0
        }

    # --- 2. VGGish ---
    print("\n[Orchestrator] Running VGGish...", file=sys.stderr)
    try:
        from vggish_classifier import classify_audio as vggish_classify
        model_results["vggish"] = run_model("VGGish", vggish_classify, audio_path, job_id)
    except Exception as e:
        model_results["vggish"] = {
            "status": "error", "model": "VGGish", "message": str(e), "processingTime": 0
        }

    # --- 3. AST ---
    print("\n[Orchestrator] Running AST...", file=sys.stderr)
    try:
        from ast_classifier import classify_audio as ast_classify
        model_results["ast"] = run_model("AST", ast_classify, audio_path, job_id)
    except Exception as e:
        model_results["ast"] = {
            "status": "error", "model": "AST", "message": str(e), "processingTime": 0
        }

    # --- 4. BEATs ---
    print("\n[Orchestrator] Running BEATs...", file=sys.stderr)
    try:
        from beats_classifier import classify_audio as beats_classify
        model_results["beats"] = run_model("BEATs", beats_classify, audio_path, job_id)
    except Exception as e:
        model_results["beats"] = {
            "status": "error", "model": "BEATs", "message": str(e), "processingTime": 0
        }

    # --- 5. PANNs ---
    print("\n[Orchestrator] Running PANNs...", file=sys.stderr)
    try:
        from panns_classifier import classify_audio as panns_classify
        model_results["panns"] = run_model("PANNs", panns_classify, audio_path, job_id)
    except Exception as e:
        model_results["panns"] = {
            "status": "error", "model": "PANNs", "message": str(e), "processingTime": 0
        }

    # --- 6. Wav2Vec 2.0 ---
    print("\n[Orchestrator] Running Wav2Vec 2.0...", file=sys.stderr)
    try:
        from wav2vec2_classifier import classify_audio as wav2vec2_classify
        model_results["wav2vec2"] = run_model("Wav2Vec 2.0", wav2vec2_classify, audio_path, job_id)
    except Exception as e:
        model_results["wav2vec2"] = {
            "status": "error", "model": "Wav2Vec 2.0", "message": str(e), "processingTime": 0
        }

    # --- Compute Ensemble ---
    print("\n[Orchestrator] Computing ensemble consensus...", file=sys.stderr)
    ensemble = compute_ensemble(model_results)

    total_elapsed = round(time.time() - total_start, 2)
    print(f"\n[Orchestrator] Total processing time: {total_elapsed}s", file=sys.stderr)

    # Count successful models
    successful = sum(1 for r in model_results.values() if r.get("status") == "success")
    failed = sum(1 for r in model_results.values() if r.get("status") != "success")
    print(f"[Orchestrator] Models succeeded: {successful}/{len(model_results)}", file=sys.stderr)
    if failed > 0:
        for name, r in model_results.items():
            if r.get("status") != "success":
                print(f"  - {name}: {r.get('message', 'unknown error')}", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    # Build combined result
    # IMPORTANT: Merge ALL model events into top-level soundEvents
    # so the separator and sonar visualization get the full ensemble data
    all_events = []
    for model_name, result in model_results.items():
        if result.get("status") != "success":
            continue
        events = result.get("soundEvents", [])
        for event in events:
            all_events.append({
                **event,
                "sourceModel": model_name
            })

    # De-duplicate: for overlapping time windows with same category,
    # keep the highest confidence event
    merged_events = {}
    for event in all_events:
        time_key = round(event.get("time", 0), 1)
        cat = event.get("type", "Unknown")
        key = f"{time_key}_{cat}"
        if key not in merged_events or event.get("confidence", 0) > merged_events[key].get("confidence", 0):
            merged_events[key] = event

    # Sort by time, then by confidence
    sorted_events = sorted(merged_events.values(), key=lambda x: (x.get("time", 0), -x.get("confidence", 0)))

    combined = {
        "status": "success" if successful > 0 else "error",
        "jobID": job_id,
        # Merged events from ALL models (not just YAMNet)
        "detectedSounds": len(sorted_events),
        "soundEvents": sorted_events,
        # Multi-model fields
        "multiModel": True,
        "models": model_results,
        "ensemble": ensemble,
        "totalProcessingTime": total_elapsed,
        "modelsSucceeded": successful,
        "modelsFailed": failed
    }

    return combined



if __name__ == "__main__":
    if len(sys.argv) > 1:
        output = classify_audio(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "job")
        if isinstance(output, str):
            sys.stdout.write(output)
        else:
            sys.stdout.write(json.dumps(sanitize_for_json(output)))
    else:
        sys.stdout.write(json.dumps({"status": "error", "message": "No input provided"}))

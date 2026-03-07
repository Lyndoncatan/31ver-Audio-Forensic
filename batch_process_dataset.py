import os
import sys
import json
import csv
import subprocess
import time
from datetime import datetime
from pathlib import Path

# Paths to the classification scripts
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
YAMNET_SCRIPT = os.path.join(SCRIPT_DIR, "scripts", "mediapipe_audio_classifier.py")
ANALYSIS_SCRIPT = os.path.join(SCRIPT_DIR, "scripts", "audio_analysis.py")

# Ensure the scripts exist
if not os.path.exists(YAMNET_SCRIPT):
    print(f"❌ Error: Could not find YAMNet script at {YAMNET_SCRIPT}")
    print("Trying alternative path...")
    YAMNET_SCRIPT = os.path.join(SCRIPT_DIR, "mediapipe_audio_classifier.py")
    if not os.path.exists(YAMNET_SCRIPT):
        print(f"❌ Critical Error: YAMNet script not found at {YAMNET_SCRIPT}. Exiting.")
        sys.exit(1)

if not os.path.exists(ANALYSIS_SCRIPT):
    print(f"❌ Error: Could not find analysis script at {ANALYSIS_SCRIPT}")
    print("Trying alternative path...")
    ANALYSIS_SCRIPT = os.path.join(SCRIPT_DIR, "audio_analysis.py")
    if not os.path.exists(ANALYSIS_SCRIPT):
        print(f"❌ Error: Analysis script not found at {ANALYSIS_SCRIPT}. Proceeding without it.")
        ANALYSIS_SCRIPT = None

# Dataset settings
DATASET_DIR = r"E:\dataset"
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "dataset_results")

# Supported audio formats
VALID_EXTENSIONS = {'.wav', '.mp3', '.flac', '.ogg'}

def run_yamnet_inference(file_path):
    """Run the YAMNet/MediaPipe classifier on a single file."""
    try:
        # Expected to output JSON to stdout
        cmd = [sys.executable, YAMNET_SCRIPT, file_path, "batch_job"]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        
        # Parse the JSON from stdout
        try:
            return json.loads(result.stdout.strip())
        except json.JSONDecodeError:
            # Fallback for cluttered output
            lines = result.stdout.strip().split('\n')
            for line in reversed(lines):
                if line.strip().startswith('{') and line.strip().endswith('}'):
                    try:
                        return json.loads(line)
                    except:
                        pass
            return {"status": "error", "message": "Failed to parse JSON output", "raw": result.stdout}
            
    except subprocess.CalledProcessError as e:
        return {"status": "error", "message": f"Process failed: {e.stderr}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def run_acoustic_analysis(file_path):
    """Run the basic acoustic analysis script."""
    if not ANALYSIS_SCRIPT:
        return {"analysisComplete": False, "message": "Script not found"}
        
    try:
        # Requires base64 audio and a filename, so we have to read it first
        import base64
        with open(file_path, "rb") as f:
            audio_b64 = base64.b64encode(f.read()).decode('utf-8')
            
        cmd = [sys.executable, ANALYSIS_SCRIPT, audio_b64, os.path.basename(file_path)]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        try:
            stdout = result.stdout
            json_start = stdout.find('{')
            json_end = stdout.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = stdout[json_start:json_end]
                return json.loads(json_str)
            else:
                return {"analysisComplete": False, "message": "No JSON output found"}
        except Exception as e:
             return {"analysisComplete": False, "message": str(e)}
             
    except Exception as e:
        return {"analysisComplete": False, "message": str(e)}

def process_dataset():
    if not os.path.exists(DATASET_DIR):
        print(f"❌ Dataset directory not found: {DATASET_DIR}")
        return

    print(f"🚀 Starting Batch Processing of {DATASET_DIR}")
    print(f"📂 Output directory: {OUTPUT_DIR}")
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Statistics
    stats = {
        "start_time": time.time(),
        "total_files": 0,
        "processed": 0,
        "failed": 0,
        "categories": {}
    }
    
    csv_rows = []
    
    # Walk through the dataset directory
    for root, dirs, files in os.walk(DATASET_DIR):
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in VALID_EXTENSIONS:
                stats["total_files"] += 1
                
                # Determine category based on folder name inside dataset dir
                rel_path = os.path.relpath(root, DATASET_DIR)
                category = rel_path.split(os.sep)[0] if rel_path != '.' else "uncategorized"
                
                if category not in stats["categories"]:
                    stats["categories"][category] = {"total": 0, "processed": 0, "failed": 0}
                
                stats["categories"][category]["total"] += 1
                
                file_path = os.path.join(root, file)
                
                # Output folder mirroring dataset structure
                file_out_dir = os.path.join(OUTPUT_DIR, rel_path)
                os.makedirs(file_out_dir, exist_ok=True)
                
                out_json_path = os.path.join(file_out_dir, f"{os.path.splitext(file)[0]}.json")
                
                # Skip if already processed
                if os.path.exists(out_json_path):
                    print(f"⏭️ Skipping {file} - already processed")
                    stats["processed"] += 1
                    stats["categories"][category]["processed"] += 1
                    continue
                
                print(f"🔄 Processing [{category}] {file} ...")
                
                # 1. Run inference
                yamnet_results = run_yamnet_inference(file_path)
                acoustic_results = run_acoustic_analysis(file_path)
                
                if yamnet_results.get("status") == "success":
                    stats["processed"] += 1
                    stats["categories"][category]["processed"] += 1
                    
                    # Extract top prediction
                    top_class = "Unknown"
                    top_conf = 0.0
                    events = yamnet_results.get("soundEvents", [])
                    if events:
                        top_event = sorted(events, key=lambda x: x["confidence"], reverse=True)[0]
                        top_class = top_event["type"]
                        top_conf = top_event["confidence"]
                        
                    # Extract acoustic features
                    rms = acoustic_results.get("averageRMS", 0.0)
                    dom_freq = acoustic_results.get("dominantFrequency", 0.0)
                    duration = acoustic_results.get("duration", 0.0)
                    max_db = acoustic_results.get("maxDecibels", -100.0)
                    
                    combined_result = {
                        "file": file,
                        "category": category,
                        "path": file_path,
                        "parsed_at": datetime.now().isoformat(),
                        "yamnet_inference": yamnet_results,
                        "acoustic_analysis": acoustic_results
                    }
                    
                    with open(out_json_path, 'w') as f:
                        json.dump(combined_result, f, indent=2)
                        
                    csv_rows.append({
                        "file_name": file,
                        "dataset_category": category,
                        "inferred_class": top_class,
                        "confidence": top_conf,
                        "duration_sec": duration,
                        "dominant_freq_hz": dom_freq,
                        "rms_energy": rms,
                        "max_decibels": max_db,
                        "total_detected_events": len(events)
                    })
                    print(f"   ✅ Success: {top_class} ({top_conf:.2f})")
                else:
                    stats["failed"] += 1
                    stats["categories"][category]["failed"] += 1
                    err = yamnet_results.get('message', 'Unknown Error')
                    print(f"   ❌ Failed: {err}")
                    
                    csv_rows.append({
                        "file_name": file,
                        "dataset_category": category,
                        "inferred_class": f"ERROR: {err}",
                        "confidence": 0,
                        "duration_sec": 0,
                        "dominant_freq_hz": 0,
                        "rms_energy": 0,
                        "max_decibels": 0,
                        "total_detected_events": 0
                    })
    
    # Save CSV
    if csv_rows:
        csv_path = os.path.join(OUTPUT_DIR, "dataset_summary.csv")
        file_exists = os.path.isfile(csv_path)
        with open(csv_path, mode='a', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=csv_rows[0].keys())
            if not file_exists:
                writer.writeheader()
            writer.writerows(csv_rows)
            
    elapsed = time.time() - stats["start_time"]
    print("\n" + "="*40)
    print("📊 BATCH PROCESSING COMPLETE 📊")
    print("="*40)
    print(f"⏱️ Time elapsed: {elapsed:.2f} seconds")
    print(f"📂 Total Files Found: {stats['total_files']}")
    print(f"✅ Successfully Processed: {stats['processed']}")
    print(f"❌ Failed: {stats['failed']}")
    
    print("\n📈 Breakdown by Category:")
    for cat, cstats in stats["categories"].items():
        print(f"  - {cat}: {cstats['total']} files ({cstats['processed']} successful, {cstats['failed']} failed)")
        
    print(f"\n📁 Results saved to: {OUTPUT_DIR}")
    print(f"📄 Summary CSV saved to: {os.path.join(OUTPUT_DIR, 'dataset_summary.csv')}")

if __name__ == "__main__":
    try:
        process_dataset()
    except KeyboardInterrupt:
        print("\n⚠️ Batch processing interrupted by user. Partial results saved.")

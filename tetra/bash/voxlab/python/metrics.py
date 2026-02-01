#!/usr/bin/env python3
"""
voxlab metrics - Audio comparison metrics between reference and candidate.

Computes:
  - Mel spectrogram distance
  - PESQ (if available)
  - RMS energy difference
  - Duration ratio

Usage:
    python3 metrics.py --reference ref.wav --candidate cand.wav
"""

import argparse
import json
import sys

import numpy as np


def rms_energy(audio):
    return float(np.sqrt(np.mean(audio ** 2)))


def mel_distance(ref_audio, cand_audio, sr):
    """Compute mean absolute error between mel spectrograms."""
    try:
        import librosa
        ref_mel = librosa.feature.melspectrogram(y=ref_audio, sr=sr, n_mels=80)
        cand_mel = librosa.feature.melspectrogram(y=cand_audio, sr=sr, n_mels=80)
        # Align lengths
        min_len = min(ref_mel.shape[1], cand_mel.shape[1])
        ref_mel = ref_mel[:, :min_len]
        cand_mel = cand_mel[:, :min_len]
        # Log mel
        ref_db = librosa.power_to_db(ref_mel, ref=np.max)
        cand_db = librosa.power_to_db(cand_mel, ref=np.max)
        return float(np.mean(np.abs(ref_db - cand_db)))
    except ImportError:
        print("  warning: librosa not available, skipping mel distance", file=sys.stderr)
        return None


def pesq_score(ref_audio, cand_audio, sr):
    """Compute PESQ score if pesq package available."""
    try:
        from pesq import pesq
        # PESQ requires 8000 or 16000 Hz
        target_sr = 16000
        if sr != target_sr:
            import librosa
            ref_audio = librosa.resample(ref_audio, orig_sr=sr, target_sr=target_sr)
            cand_audio = librosa.resample(cand_audio, orig_sr=sr, target_sr=target_sr)
        # Align lengths
        min_len = min(len(ref_audio), len(cand_audio))
        return float(pesq(target_sr, ref_audio[:min_len], cand_audio[:min_len], "wb"))
    except ImportError:
        print("  warning: pesq not available, skipping PESQ", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  warning: PESQ failed: {e}", file=sys.stderr)
        return None


def compare(reference_path, candidate_path):
    try:
        import soundfile as sf
    except ImportError:
        print("error: soundfile package required (pip install soundfile)", file=sys.stderr)
        sys.exit(1)

    ref_audio, ref_sr = sf.read(reference_path)
    cand_audio, cand_sr = sf.read(candidate_path)

    # Convert to mono if needed
    if ref_audio.ndim > 1:
        ref_audio = ref_audio.mean(axis=1)
    if cand_audio.ndim > 1:
        cand_audio = cand_audio.mean(axis=1)

    # Resample candidate to match reference if needed
    if cand_sr != ref_sr:
        try:
            import librosa
            cand_audio = librosa.resample(cand_audio, orig_sr=cand_sr, target_sr=ref_sr)
        except ImportError:
            print("warning: sample rates differ and librosa not available", file=sys.stderr)

    results = {
        "reference": reference_path,
        "candidate": candidate_path,
        "ref_duration_s": round(len(ref_audio) / ref_sr, 3),
        "cand_duration_s": round(len(cand_audio) / ref_sr, 3),
        "duration_ratio": round(len(cand_audio) / max(len(ref_audio), 1), 3),
        "ref_rms": round(rms_energy(ref_audio), 6),
        "cand_rms": round(rms_energy(cand_audio), 6),
        "rms_diff": round(abs(rms_energy(ref_audio) - rms_energy(cand_audio)), 6),
    }

    mel_dist = mel_distance(ref_audio, cand_audio, ref_sr)
    if mel_dist is not None:
        results["mel_distance"] = round(mel_dist, 4)

    pesq_val = pesq_score(ref_audio, cand_audio, ref_sr)
    if pesq_val is not None:
        results["pesq"] = round(pesq_val, 3)

    return results


def main():
    parser = argparse.ArgumentParser(description="voxlab audio metrics")
    parser.add_argument("--reference", required=True, help="Reference audio file")
    parser.add_argument("--candidate", required=True, help="Candidate audio file")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    results = compare(args.reference, args.candidate)

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        print(f"Reference:  {results['reference']}")
        print(f"Candidate:  {results['candidate']}")
        print(f"Duration:   {results['ref_duration_s']}s vs {results['cand_duration_s']}s (ratio: {results['duration_ratio']})")
        print(f"RMS:        {results['ref_rms']} vs {results['cand_rms']} (diff: {results['rms_diff']})")
        if "mel_distance" in results:
            print(f"Mel dist:   {results['mel_distance']}")
        if "pesq" in results:
            print(f"PESQ:       {results['pesq']}")


if __name__ == "__main__":
    main()

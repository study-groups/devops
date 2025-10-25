#!/usr/bin/env python3
"""
2_extract_excitations.py - Extract training data from recordings

Performs LPC analysis and extracts excitation patterns from voice recordings.
"""

import argparse
import os
import numpy as np
import librosa
from scipy import signal
from pathlib import Path
import json
from tqdm import tqdm

def compute_lpc_stable(audio, order=10):
    """Compute LPC coefficients with stability checking"""
    # Use librosa's LPC with windowing
    lpc_coeffs = librosa.lpc(audio, order=order)

    # Check stability (all poles inside unit circle)
    roots = np.roots(lpc_coeffs)
    if np.any(np.abs(roots) >= 0.99):
        # Unstable, use more conservative order
        lpc_coeffs = librosa.lpc(audio, order=6)
        # Pad to order 10
        lpc_coeffs = np.pad(lpc_coeffs, (0, order - 6 + 1), mode='constant')[1:]
    else:
        lpc_coeffs = lpc_coeffs[1:]  # Remove a0 (always 1.0)

    return lpc_coeffs

def extract_excitation(audio, sr=16000, frame_length_ms=10, hop_length_ms=5):
    """
    Extract excitation patterns using LPC inverse filtering

    Args:
        audio: Audio signal
        sr: Sample rate
        frame_length_ms: Frame length in milliseconds
        hop_length_ms: Hop length in milliseconds

    Returns:
        List of excitation frames with metadata
    """
    frame_length = int(sr * frame_length_ms / 1000)  # 160 samples @ 16kHz
    hop_length = int(sr * hop_length_ms / 1000)      # 80 samples @ 16kHz

    excitations = []

    for i in range(0, len(audio) - frame_length, hop_length):
        frame = audio[i:i + frame_length]

        # Skip low-energy frames (silence)
        energy = np.sqrt(np.mean(frame ** 2))
        if energy < 0.01:
            continue

        # Compute LPC coefficients
        try:
            lpc_coeffs = compute_lpc_stable(frame, order=10)
        except:
            continue

        # Inverse filter to get excitation
        # y[n] = x[n] - sum(a[k] * y[n-k])
        excitation = signal.lfilter([1.0], np.concatenate([[1.0], lpc_coeffs]), frame)

        # Normalize excitation
        excitation = excitation / (np.max(np.abs(excitation)) + 1e-10)

        excitations.append({
            'samples': excitation.astype(np.float32),
            'lpc_coeffs': lpc_coeffs.astype(np.float32),
            'energy': float(energy)
        })

    return excitations

def process_recordings(recordings_dir, speaker_name, output_dir):
    """Process all recordings for a speaker"""

    recordings_path = Path(recordings_dir) / speaker_name
    output_path = Path(output_dir) / speaker_name
    output_path.mkdir(parents=True, exist_ok=True)

    if not recordings_path.exists():
        print(f"Error: Recordings directory not found: {recordings_path}")
        return

    # Get all WAV files
    wav_files = list(recordings_path.glob("*.wav"))

    if not wav_files:
        print(f"Error: No WAV files found in {recordings_path}")
        return

    print(f"Found {len(wav_files)} recordings")
    print(f"Extracting excitation patterns...")

    all_data = []
    phoneme_counts = {}

    for wav_file in tqdm(wav_files, desc="Processing"):
        # Parse filename: phoneme_takeN.wav
        phoneme = wav_file.stem.rsplit('_', 1)[0]

        # Load audio
        try:
            audio, sr = librosa.load(wav_file, sr=16000, mono=True)
        except Exception as e:
            print(f"Error loading {wav_file}: {e}")
            continue

        # Trim silence
        audio, _ = librosa.effects.trim(audio, top_db=30)

        # Extract excitations
        excitations = extract_excitation(audio, sr=sr)

        # Add phoneme label
        for exc in excitations:
            exc['phoneme'] = phoneme
            all_data.append(exc)

        phoneme_counts[phoneme] = phoneme_counts.get(phoneme, 0) + len(excitations)

    print(f"\nExtracted {len(all_data)} excitation frames")
    print(f"Phonemes: {len(phoneme_counts)}")

    # Print distribution
    print("\nPhoneme distribution:")
    for phoneme, count in sorted(phoneme_counts.items()):
        print(f"  {phoneme:8s}: {count:4d} frames")

    # Save as numpy arrays
    output_file = output_path / "training_data.npz"

    samples = np.array([d['samples'] for d in all_data])
    lpc_coeffs = np.array([d['lpc_coeffs'] for d in all_data])
    energies = np.array([d['energy'] for d in all_data])
    phonemes = np.array([d['phoneme'] for d in all_data])

    np.savez_compressed(
        output_file,
        samples=samples,
        lpc_coeffs=lpc_coeffs,
        energies=energies,
        phonemes=phonemes
    )

    # Save metadata
    metadata = {
        'speaker': speaker_name,
        'num_frames': len(all_data),
        'num_phonemes': len(phoneme_counts),
        'phoneme_counts': phoneme_counts,
        'sample_rate': 16000,
        'frame_length': 160
    }

    with open(output_path / "metadata.json", 'w') as f:
        json.dump(metadata, f, indent=2)

    print(f"\n✓ Training data saved to: {output_file}")
    print(f"✓ Metadata saved to: {output_path / 'metadata.json'}")
    print(f"\nNext step: python 3_train_vae.py --speaker {speaker_name}")

def main():
    parser = argparse.ArgumentParser(description='Extract excitations from voice recordings')
    parser.add_argument('--speaker', default='my_voice', help='Speaker name')
    parser.add_argument('--recordings-dir', default='recordings', help='Recordings directory')
    parser.add_argument('--output-dir', default='training_data', help='Output directory')

    args = parser.parse_args()

    process_recordings(args.recordings_dir, args.speaker, args.output_dir)

if __name__ == '__main__':
    main()

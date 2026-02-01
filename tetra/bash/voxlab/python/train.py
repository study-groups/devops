#!/usr/bin/env python3
"""
voxlab trainer - Generic training loop that reads config.json and writes run.ndjson.

Reads pipeline config, runs training steps, logs metrics per step,
checks triggers, and saves checkpoints.

Usage:
    python3 train.py --config /path/to/config.json --output /path/to/run.ndjson
"""

import argparse
import json
import math
import os
import random
import struct
import sys
import time
import wave
from datetime import datetime, timezone
from pathlib import Path


def load_config(config_path):
    with open(config_path) as f:
        return json.load(f)


def check_triggers(triggers, step, loss, prev_loss, no_improve_count):
    """Check triggers and return list of fired trigger actions."""
    fired = []
    for t in triggers:
        ttype = t.get("type")
        value = float(t.get("value", 0))
        action = t.get("action", "alert")
        name = t.get("name", "unnamed")

        if ttype == "threshold" and loss < value:
            fired.append({"trigger": name, "type": ttype, "action": action})
        elif ttype == "plateau" and no_improve_count >= int(value):
            fired.append({"trigger": name, "type": ttype, "action": action})
        elif ttype == "divergence" and prev_loss is not None:
            # value = number of consecutive increases allowed
            if no_improve_count >= int(value) and loss > prev_loss:
                fired.append({"trigger": name, "type": ttype, "action": action})

    return fired


def log_step(output_file, entry):
    with open(output_file, "a") as f:
        f.write(json.dumps(entry) + "\n")


def generate_sample_wav(path, progress, duration=2.0, sample_rate=16000):
    """Generate a synthetic voice sample that improves with training progress.

    Simulates a model learning to produce a vowel-like sound:
    - progress=0.0: hissy static with a buried, wrong-pitch buzz
    - progress=0.5: recognizable tone emerging, some noise remains
    - progress=1.0: clean vowel-like tone with natural formants

    Uses phase accumulation for stable FM synthesis and seeded RNG
    for reproducible noise.
    """
    rng = random.Random(42)  # deterministic noise
    n_samples = int(duration * sample_rate)

    # Target: A3 fundamental + formant-like harmonics (vowel "ah")
    target_f0 = 220.0
    start_f0 = 310.0   # off-pitch

    f0 = start_f0 + (target_f0 - start_f0) * progress

    # Noise and distortion levels (decay with progress)
    noise_level = 0.40 * (1.0 - progress) ** 1.5
    harmonic_dirt = 0.35 * (1.0 - progress)
    vibrato_depth = 12.0 * (1.0 - progress) ** 2    # Hz of pitch wobble
    formant_blend = progress                          # formant richness fades in
    amplitude = 0.20 + 0.20 * progress

    # Phase accumulators (prevents FM chirping artifacts)
    phase = 0.0
    phase3 = 0.0
    phase5 = 0.0
    # Formant phases (vowel overtones)
    fp1 = 0.0  # ~2.5x f0 (first formant-ish)
    fp2 = 0.0  # ~4x f0 (second formant-ish)

    samples = []
    for i in range(n_samples):
        t = i / sample_rate
        dt = 1.0 / sample_rate

        # Slow vibrato (pitch instability)
        vibrato = vibrato_depth * math.sin(2 * math.pi * 4.8 * t)
        inst_f0 = f0 + vibrato

        # Accumulate phases
        phase += inst_f0 * dt
        phase3 += inst_f0 * 3 * dt
        phase5 += inst_f0 * 5 * dt
        fp1 += inst_f0 * 2.5 * dt
        fp2 += inst_f0 * 4.1 * dt

        # Fundamental
        val = math.sin(2 * math.pi * phase)

        # Harsh odd harmonics (buzz) — fade with training
        val += harmonic_dirt * 0.5 * math.sin(2 * math.pi * phase3)
        val += harmonic_dirt * 0.3 * math.sin(2 * math.pi * phase5)

        # Vowel formants — fade in with training
        val += formant_blend * 0.15 * math.sin(2 * math.pi * fp1)
        val += formant_blend * 0.08 * math.sin(2 * math.pi * fp2)

        # White noise (hiss)
        val = val * amplitude + rng.uniform(-1, 1) * noise_level

        # Gentle envelope
        env = min(t * 15, 1.0) * min((duration - t) * 15, 1.0)
        val *= env

        val = max(-1.0, min(1.0, val))
        samples.append(int(val * 32767))

    with wave.open(path, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(struct.pack(f"<{len(samples)}h", *samples))


def stub_train(config, output_path, checkpoint_dir):
    """Stub trainer that simulates a decreasing loss curve."""
    params = config.get("params", {})
    epochs = int(params.get("epochs", 10))
    lr = float(params.get("lr", 0.001))
    steps_per_epoch = int(params.get("steps_per_epoch", 100))
    triggers = config.get("triggers", [])

    # Derive outputs dir from checkpoint dir sibling
    exp_dir = os.path.dirname(checkpoint_dir)
    outputs_dir = os.path.join(exp_dir, "outputs")
    os.makedirs(outputs_dir, exist_ok=True)

    total_steps = epochs * steps_per_epoch
    mid_step = total_steps // 2

    best_loss = float("inf")
    prev_loss = None
    no_improve_count = 0
    total_step = 0

    # Generate "before" sample (untrained model output)
    before_path = os.path.join(outputs_dir, "sample_before.wav")
    generate_sample_wav(before_path, progress=0.0)
    print(f"Training: {epochs} epochs, lr={lr}, steps/epoch={steps_per_epoch}")
    print(f"  sample: before → {before_path}")

    for epoch in range(epochs):
        for step_in_epoch in range(steps_per_epoch):
            total_step += 1
            # Simulated loss: exponential decay with noise
            progress = total_step / total_steps
            base_loss = 2.5 * math.exp(-3.0 * progress)
            noise = 0.05 * math.sin(total_step * 0.3) * (1 - progress)
            loss = max(0.01, base_loss + noise)
            val_loss = loss * 1.1  # validation slightly higher

            # Track improvement
            if loss < best_loss:
                best_loss = loss
                no_improve_count = 0
            else:
                no_improve_count += 1

            entry = {
                "step": total_step,
                "epoch": epoch,
                "loss": round(loss, 6),
                "val_loss": round(val_loss, 6),
                "lr": lr,
                "ts": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            }

            # Generate "during" sample at midpoint
            if total_step == mid_step:
                during_path = os.path.join(outputs_dir, "sample_during.wav")
                generate_sample_wav(during_path, progress=progress)
                entry["sample"] = "during"
                print(f"  sample: during → {during_path} (step {total_step})")

            # Check triggers
            fired = check_triggers(triggers, total_step, loss, prev_loss, no_improve_count)
            for f in fired:
                entry["trigger"] = f["trigger"]
                action = f["action"]

                if action == "checkpoint":
                    ckpt_path = os.path.join(checkpoint_dir, f"step_{total_step}.pt")
                    Path(ckpt_path).touch()
                    print(f"  checkpoint: step {total_step} (trigger: {f['trigger']})")
                elif action == "stop":
                    log_step(output_path, entry)
                    print(f"  early stop at step {total_step} (trigger: {f['trigger']})")
                    # Save final sample + best checkpoint
                    after_path = os.path.join(outputs_dir, "sample_after.wav")
                    generate_sample_wav(after_path, progress=progress)
                    print(f"  sample: after → {after_path}")
                    best_path = os.path.join(checkpoint_dir, "best.pt")
                    Path(best_path).touch()
                    return
                elif action == "alert":
                    print(f"  alert: {f['trigger']} fired at step {total_step}")

            log_step(output_path, entry)
            prev_loss = loss

        # End of epoch summary
        print(f"  epoch {epoch}: loss={loss:.6f} val_loss={val_loss:.6f}")

    # Generate "after" sample (trained model output)
    after_path = os.path.join(outputs_dir, "sample_after.wav")
    generate_sample_wav(after_path, progress=1.0)
    print(f"  sample: after → {after_path}")

    # Save final best checkpoint
    best_path = os.path.join(checkpoint_dir, "best.pt")
    Path(best_path).touch()
    print(f"Training complete. Best loss: {best_loss:.6f}")


def main():
    parser = argparse.ArgumentParser(description="voxlab trainer")
    parser.add_argument("--config", required=True, help="Path to config.json")
    parser.add_argument("--output", required=True, help="Path to run.ndjson output")
    parser.add_argument("--checkpoint-dir", required=True, help="Checkpoint directory")
    parser.add_argument("--stage", default=None, help="Pipeline stage to run")
    args = parser.parse_args()

    config = load_config(args.config)
    os.makedirs(args.checkpoint_dir, exist_ok=True)

    # Clear previous run output
    if os.path.exists(args.output):
        os.remove(args.output)

    stub_train(config, args.output, args.checkpoint_dir)


if __name__ == "__main__":
    main()

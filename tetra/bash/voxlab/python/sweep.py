#!/usr/bin/env python3
"""
voxlab sweep - Parameter sweep runner.

Generates parameter combinations and invokes train.py for each.

Usage:
    python3 sweep.py --config base_config.json --output-dir sweep_results/ \
        --param lr=0.001,0.01,0.1 --param batch_size=16,32
"""

import argparse
import itertools
import json
import os
import subprocess
import sys
from pathlib import Path


def parse_param(param_str):
    """Parse 'key=val1,val2,val3' into (key, [val1, val2, val3])."""
    key, vals = param_str.split("=", 1)
    return key, vals.split(",")


def generate_combinations(param_dict):
    """Generate all combinations of parameter values."""
    keys = list(param_dict.keys())
    values = list(param_dict.values())
    for combo in itertools.product(*values):
        yield dict(zip(keys, combo))


def main():
    parser = argparse.ArgumentParser(description="voxlab parameter sweep")
    parser.add_argument("--config", required=True, help="Base config.json")
    parser.add_argument("--output-dir", required=True, help="Output directory for sweep results")
    parser.add_argument("--param", action="append", default=[], help="Parameter to sweep: key=val1,val2")
    args = parser.parse_args()

    with open(args.config) as f:
        base_config = json.load(f)

    params = {}
    for p in args.param:
        key, vals = parse_param(p)
        params[key] = vals

    if not params:
        print("No parameters to sweep.", file=sys.stderr)
        sys.exit(1)

    os.makedirs(args.output_dir, exist_ok=True)
    combos = list(generate_combinations(params))
    print(f"Sweep: {len(combos)} combinations")

    results = []
    for i, combo in enumerate(combos):
        run_name = "_".join(f"{k}{v}" for k, v in combo.items())
        run_dir = os.path.join(args.output_dir, run_name)
        os.makedirs(run_dir, exist_ok=True)
        ckpt_dir = os.path.join(run_dir, "checkpoints")
        os.makedirs(ckpt_dir, exist_ok=True)

        # Merge params into config
        config = json.loads(json.dumps(base_config))
        config["params"] = {**config.get("params", {}), **combo}
        config["sweep_index"] = i
        config["sweep_params"] = combo

        config_path = os.path.join(run_dir, "config.json")
        with open(config_path, "w") as f:
            json.dump(config, f, indent=2)

        output_path = os.path.join(run_dir, "run.ndjson")

        print(f"\n[{i+1}/{len(combos)}] {combo}")

        train_script = os.path.join(os.path.dirname(__file__), "train.py")
        rc = subprocess.call([
            sys.executable, train_script,
            "--config", config_path,
            "--output", output_path,
            "--checkpoint-dir", ckpt_dir,
        ])

        # Read final loss
        final_loss = None
        if os.path.exists(output_path):
            with open(output_path) as f:
                lines = f.readlines()
                if lines:
                    last = json.loads(lines[-1])
                    final_loss = last.get("loss")

        results.append({
            "params": combo,
            "final_loss": final_loss,
            "exit_code": rc,
            "run_dir": run_dir,
        })

    # Write sweep summary
    summary_path = os.path.join(args.output_dir, "sweep_summary.json")
    results.sort(key=lambda r: r["final_loss"] if r["final_loss"] is not None else float("inf"))
    with open(summary_path, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nSweep complete. Best: {results[0]['params']} → loss={results[0]['final_loss']}")
    print(f"Summary: {summary_path}")


if __name__ == "__main__":
    main()

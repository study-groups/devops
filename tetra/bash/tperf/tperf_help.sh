#!/usr/bin/env bash
# tperf help tree integration
# NOTE: This file should only be sourced when tree module is available

# Create tperf help category
tree_insert "tperf" category \
    title="Performance Profiling" \
    help="Boot and runtime performance profiling utilities"

# profile command
tree_insert "tperf.profile" command \
    title="Full Boot Profile" \
    help="Run complete boot analysis (trace + analyze)" \
    synopsis="tperf profile [output_file]" \
    handler="tperf::trace_boot && tperf::analyze_boot" \
    examples="tperf profile
tperf profile /tmp/custom_trace.log"

# trace-boot command
tree_insert "tperf.trace-boot" command \
    title="Trace Boot Sequence" \
    help="Profile a fresh boot with set -x tracing" \
    synopsis="tperf trace-boot [output_file]" \
    handler="tperf::trace_boot" \
    details="Runs source ~/tetra/tetra.sh in a fresh bash shell with PS4 tracing enabled. Outputs a detailed execution trace showing every line executed during boot." \
    examples="tperf trace-boot
tperf trace-boot /tmp/my_trace.log"

# analyze command
tree_insert "tperf.analyze" command \
    title="Analyze Boot Trace" \
    help="Analyze a boot trace log file" \
    synopsis="tperf analyze [trace_file]" \
    handler="tperf::analyze_boot" \
    details="Parses trace log and shows:
  - Total lines executed
  - Top 20 files by execution count
  - Boot stage breakdown with percentages
  - Module metadata initialization check" \
    examples="tperf analyze
tperf analyze /tmp/boot_trace.log"

# count command
tree_insert "tperf.count" command \
    title="Count Lines by Pattern" \
    help="Count lines executed matching a file pattern" \
    synopsis="tperf count <pattern> [trace_file]" \
    handler="tperf::count_lines_in_file" \
    examples="tperf count module_metadata.sh
tperf count 'boot_core' /tmp/trace.log"

# compare command
tree_insert "tperf.compare" command \
    title="Compare Boot Traces" \
    help="Compare two boot traces to measure optimization impact" \
    synopsis="tperf compare <trace1> <trace2>" \
    handler="tperf::compare_boot" \
    details="Shows:
  - Lines before and after
  - Absolute difference
  - Percentage improvement/regression" \
    examples="tperf compare before.log after.log"

# Add output file location info
tree_insert "tperf.files" category \
    title="File Locations" \
    help="Default trace file: ~/tetra/tperf/boot_trace.log"

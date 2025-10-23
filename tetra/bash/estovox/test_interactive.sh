#!/bin/bash
source ./core/state.sh
source ./presets/phonemes.sh

estovox_init_state

echo "Initial JAW: $ESTOVOX_JAW_OPENNESS"

# Test setting param
estovox_set_param "ESTOVOX_JAW_OPENNESS" "0.5"
echo "After set to 0.5: $ESTOVOX_JAW_OPENNESS"

# Test bc math
result=$(bc -l <<< "$ESTOVOX_JAW_OPENNESS + 0.05")
echo "BC result: $result"

estovox_set_param "ESTOVOX_JAW_OPENNESS" "$result"
echo "After BC set: $ESTOVOX_JAW_OPENNESS"

# Test apply preset
estovox_apply_preset "a" 0.5
echo "After preset 'a': JAW=$ESTOVOX_JAW_OPENNESS"

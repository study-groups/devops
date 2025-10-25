#!/usr/bin/env bash
#
# record_phonemes_vad.sh - Voice cloning with VAD
#

# Get script directory and formant path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FORMANT_BIN="$SCRIPT_DIR/../bin/formant"

# Check if formant exists
if [ ! -x "$FORMANT_BIN" ]; then
    echo "ERROR: Formant binary not found at: $FORMANT_BIN"
    echo "Please build formant first: cd .. && make"
    exit 1
fi

RECORDINGS_DIR="$SCRIPT_DIR/recordings"
SPEAKER_NAME="${1:-my_voice}"
MAX_DURATION=5000
VAD_MODE=1

# Phonemes
PHONEMES=("a" "e" "i" "o" "u" "m" "n" "l" "r" "w" "y" "p" "t" "k" "f" "s" "h" "b" "d" "g" "v" "z")

mkdir -p "$RECORDINGS_DIR/$SPEAKER_NAME"

clear
echo ""
echo "Voice Cloning Training - VAD Mode"
echo "=================================="
echo ""
echo "Record ${#PHONEMES[@]} phonemes × 3 takes = $((${#PHONEMES[@]} * 3)) files"
echo "Speaker: $SPEAKER_NAME"
echo ""
echo "Workflow:"
echo "  • Listen to example (2 sec)"
echo "  • Press ENTER"
echo "  • Speak the phoneme"
echo "  • VAD auto-captures"
echo ""
read -p "Press ENTER to begin..."

# Setup
FIFO="/tmp/formant_vad_$$"
LOG="/tmp/formant_log_$$"

CLEANUP_DONE=false
cleanup() {
    # Prevent recursive calls
    if [ "$CLEANUP_DONE" = true ]; then
        return
    fi
    CLEANUP_DONE=true

    echo "Cleaning up..."

    # Send STOP command and close FIFO
    if [ -p "$FIFO" ]; then
        echo "STOP" >&3 2>/dev/null || true
        exec 3>&- 2>/dev/null || true
    fi

    # Kill formant engine if still running
    if [ -n "${FORMANT_PID:-}" ]; then
        kill $FORMANT_PID 2>/dev/null || true
        wait $FORMANT_PID 2>/dev/null || true
    fi

    # Clean up temp files
    rm -f "$FIFO" "$LOG" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Create FIFO
rm -f "$FIFO"
mkfifo "$FIFO" || { echo "Failed to create FIFO"; exit 1; }

# Start formant engine
echo "Starting formant engine..."
echo "  Binary: $FORMANT_BIN"
echo "  FIFO: $FIFO"
echo ""
"$FORMANT_BIN" -i "$FIFO" -s 16000 > "$LOG" 2>&1 &
FORMANT_PID=$!

# Open FIFO for writing (keeps it open to prevent EOF)
exec 3> "$FIFO"

# Wait for engine to start
sleep 2

# Check if engine is running
if ! kill -0 $FORMANT_PID 2>/dev/null; then
    echo "ERROR: Formant engine failed to start"
    cat "$LOG"
    exit 1
fi

echo "Engine ready (PID: $FORMANT_PID)"
echo ""

# Get description
get_desc() {
    case "$1" in
        a) echo "ahhh (father)" ;;
        e) echo "ehhh (bed)" ;;
        i) echo "eeee (beet)" ;;
        o) echo "ohhh (go)" ;;
        u) echo "oooo (food)" ;;
        m) echo "mmm (hum)" ;;
        n) echo "nnn (nose)" ;;
        l) echo "lll (long)" ;;
        r) echo "rrr (red)" ;;
        w) echo "www (wet)" ;;
        y) echo "yyy (yes)" ;;
        p) echo "puh (pop)" ;;
        t) echo "tuh (tap)" ;;
        k) echo "kuh (kite)" ;;
        f) echo "fff (fan)" ;;
        s) echo "sss (snake)" ;;
        h) echo "hhh (hat)" ;;
        b) echo "buh (boy)" ;;
        d) echo "duh (dog)" ;;
        g) echo "guh (go)" ;;
        v) echo "vvv (van)" ;;
        z) echo "zzz (zoo)" ;;
        *) echo "$1" ;;
    esac
}

# Main recording loop
TOTAL=${#PHONEMES[@]}
for i in "${!PHONEMES[@]}"; do
    phoneme="${PHONEMES[$i]}"
    num=$((i + 1))
    desc=$(get_desc "$phoneme")

    echo "[$num/$TOTAL] Phoneme: $phoneme"
    echo ""

    for take in 1 2 3; do
        file="$RECORDINGS_DIR/$SPEAKER_NAME/${phoneme}_take${take}.wav"

        echo "  Take $take/3: $desc"
        echo ""

        # Play example
        echo "    🔊 Example playing..."
        echo "PH $phoneme 2000 120 0.8 0.3" >&3
        sleep 2.0
        echo "PR VOLUME 0.0" >&3  # Silence the output
        sleep 0.2

        # Get ready
        echo ""
        read -p "    Press ENTER then speak (or 's' to skip): " response

        # Check if user wants to skip
        if [ "$response" = "s" ] || [ "$response" = "S" ]; then
            echo "    ⊘ Skipped"
            echo ""
            continue
        fi

        # Delete old file if exists
        rm -f "$file" 2>/dev/null

        # Start recording
        echo "RECORD_VAD $phoneme $MAX_DURATION $file $VAD_MODE" >&3

        echo ""
        echo -n "    🎤 Listening"

        # Wait for file to appear
        for j in {1..20}; do
            sleep 0.2
            echo -n "."
            if [ -f "$file" ]; then
                break
            fi
        done

        # Monitor recording
        if [ -f "$file" ]; then
            echo ""
            echo -n "    🔴 Recording"

            last_size=0
            no_change_count=0

            for j in {1..50}; do
                sleep 0.2

                if [ -f "$file" ]; then
                    size=$(stat -f%z "$file" 2>/dev/null || echo "0")

                    # Show progress
                    echo -n "."

                    # Check if file stopped growing
                    if [ "$size" -gt 1000 ]; then
                        if [ "$size" -eq "$last_size" ]; then
                            no_change_count=$((no_change_count + 1))
                            if [ $no_change_count -ge 3 ]; then
                                echo ""
                                echo "    ✓ Complete!"
                                break
                            fi
                        else
                            no_change_count=0
                        fi
                    fi

                    last_size=$size
                fi
            done
        else
            echo ""
            echo "    ⚠ No recording created"
        fi

        echo ""

        # Show result and statistics
        if [ -f "$file" ]; then
            size=$(stat -f%z "$file" 2>/dev/null || echo "0")

            if [ "$size" -gt 1000 ]; then
                kb=$((size / 1024))

                # Calculate duration (rough estimate: size / (sample_rate * 2 bytes))
                duration=$(echo "scale=2; ($size - 44) / 32000" | bc)

                # Check file with ffprobe if available for better stats
                if command -v ffprobe >/dev/null 2>&1; then
                    stats=$(ffprobe -v error -show_entries format=duration,bit_rate -of default=noprint_wrappers=1 "$file" 2>/dev/null)
                    dur=$(echo "$stats" | grep duration | cut -d= -f2)
                    if [ -n "$dur" ]; then
                        duration=$dur
                    fi
                fi

                echo "    ✓ Saved:"
                echo "      File: $file"
                echo "      Size: ${kb}KB"
                echo "      Duration: ${duration}s"

                # Quality check
                if (( $(echo "$duration < 0.3" | bc -l) )); then
                    echo "      ⚠ Warning: Recording is very short"
                elif (( $(echo "$duration > 3.0" | bc -l) )); then
                    echo "      ⚠ Warning: Recording is longer than expected"
                else
                    echo "      ✓ Duration looks good"
                fi
            else
                echo "    ✗ Failed - File too small (${size} bytes)"
            fi
        else
            echo "    ✗ Failed - No recording created"
        fi

        echo ""
    done

    echo ""
done

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║               Recording Session Complete!                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Count successful recordings
total_files=$(find "$RECORDINGS_DIR/$SPEAKER_NAME" -name "*.wav" -size +1k 2>/dev/null | wc -l | tr -d ' ')
total_size=$(du -sh "$RECORDINGS_DIR/$SPEAKER_NAME" 2>/dev/null | cut -f1)

echo "Summary:"
echo "  Speaker: $SPEAKER_NAME"
echo "  Location: $RECORDINGS_DIR/$SPEAKER_NAME/"
echo "  Files: $total_files recordings"
echo "  Total size: $total_size"
echo ""
echo "Expected: $((TOTAL * 3)) recordings (${TOTAL} phonemes × 3 takes)"
echo ""

if [ "$total_files" -eq $((TOTAL * 3)) ]; then
    echo "✓ All recordings complete!"
elif [ "$total_files" -gt 0 ]; then
    missing=$((TOTAL * 3 - total_files))
    echo "⚠ Missing $missing recordings"
    echo "  You can re-run this script to record missing phonemes"
else
    echo "✗ No recordings captured"
    echo "  Please check microphone permissions and try again"
fi

echo ""
echo "Next step:"
echo "  python voice_cloning/2_extract_excitations.py --speaker $SPEAKER_NAME"
echo ""

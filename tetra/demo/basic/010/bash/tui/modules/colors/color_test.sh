#!/usr/bin/env bash

# Color Testing Suite for Mac Terminal
# Tests different colorization techniques and considerations

echo "=== COLOR TESTING SUITE ==="
echo "Terminal: $TERM"
echo "Colors supported: $(tput colors 2>/dev/null || echo 'unknown')"
echo

# Test 1: ANSI Escape Codes vs tput
echo "1. ANSI vs tput comparison:"
echo -n "ANSI Red: "
printf "\033[31mRED TEXT\033[0m\n"
echo -n "tput Red: "
tput setaf 1; echo -n "RED TEXT"; tput sgr0; echo

echo -n "ANSI RGB: "
printf "\033[38;2;255;0;0mRED RGB\033[0m\n"
echo -n "tput RGB: "
tput setaf 196 2>/dev/null && echo -n "RED 256" && tput sgr0 && echo || echo "RGB not supported"
echo

# Test 2: Unicode Block Characters
echo "2. Unicode block character tests:"
chars=("█" "▉" "▊" "▋" "▌" "▍" "▎" "▏" "■" "▪" "▫" "▬")
for char in "${chars[@]}"; do
    printf "\033[31m%s\033[0m " "$char"
done
echo " <- Red blocks"

for char in "${chars[@]}"; do
    printf "\033[42m%s\033[0m " "$char"
done
echo " <- Green background"
echo

# Test 3: RGB Color Accuracy
echo "3. RGB color accuracy test:"
colors=("FF0000" "00FF00" "0000FF" "FFFF00" "FF00FF" "00FFFF")
names=("Red" "Green" "Blue" "Yellow" "Magenta" "Cyan")

for i in "${!colors[@]}"; do
    hex="${colors[i]}"
    name="${names[i]}"
    r=$((16#${hex:0:2}))
    g=$((16#${hex:2:2}))
    b=$((16#${hex:4:2}))

    printf "%-8s: " "$name"
    printf "\033[38;2;%d;%d;%dm████\033[0m " "$r" "$g" "$b"
    printf "#%s RGB(%d,%d,%d)\n" "$hex" "$r" "$g" "$b"
done
echo

# Test 4: Background vs Foreground
echo "4. Background vs foreground rendering:"
printf "FG Red: \033[31m████\033[0m  "
printf "BG Red: \033[41m    \033[0m  "
printf "FG+BG: \033[31;41m████\033[0m\n"

printf "FG RGB: \033[38;2;0;170;0m████\033[0m  "
printf "BG RGB: \033[48;2;0;170;0m    \033[0m  "
printf "Mixed:  \033[38;2;255;255;255;48;2;0;170;0m████\033[0m\n"
echo

# Test 5: Color Reset Methods
echo "5. Color reset method tests:"
printf "No reset: \033[31mRED"
printf "\033[0m Standard reset\n"

printf "tput reset: "
tput setaf 1; printf "RED"; tput sgr0; printf " Normal\n"

printf "Double reset: \033[31mRED\033[0m\033[0m Normal\n"
echo

# Test 6: Terminal Detection
echo "6. Terminal capability detection:"
echo "TERM: $TERM"
echo "COLORTERM: $COLORTERM"
echo "tput colors: $(tput colors 2>/dev/null || echo 'N/A')"
echo "256 color test: $(tput setaf 196 2>/dev/null && echo "✓" || echo "✗")$(tput sgr0 2>/dev/null)"
echo "RGB test: $(printf '\033[38;2;255;0;0m' 2>/dev/null && echo "✓" || echo "✗")$(printf '\033[0m')"
echo

# Test 7: Problematic Color Combinations
echo "7. Problematic color analysis:"
problem_colors=("22DD22" "006644" "00DD88" "66FF66")
echo "Original problematic colors:"
for hex in "${problem_colors[@]}"; do
    r=$((16#${hex:0:2}))
    g=$((16#${hex:2:2}))
    b=$((16#${hex:4:2}))

    printf "#%s: \033[38;2;%d;%d;%dm▉▉\033[0m RGB(%d,%d,%d) " "$hex" "$r" "$g" "$b" "$r" "$g" "$b"

    # Test different characters
    printf "\033[38;2;%d;%d;%dm█■▪\033[0m\n" "$r" "$g" "$b"
done
echo

# Test 8: System-specific considerations
echo "8. macOS terminal considerations:"
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "✓ Running on macOS"
    echo "Terminal app: ${TERM_PROGRAM:-unknown}"
    echo "Terminal version: ${TERM_PROGRAM_VERSION:-unknown}"

    # Test Terminal.app specific features
    if [[ "$TERM_PROGRAM" == "Apple_Terminal" ]]; then
        echo "Apple Terminal detected - testing OSC sequences"
        printf "Background change test: \033]11;#FF0000\007"
        sleep 1
        printf "\033]11;#000000\007"
    fi
else
    echo "Not running on macOS"
fi
echo

echo "=== TEST COMPLETE ==="
echo "Grade this output and report which techniques work best."
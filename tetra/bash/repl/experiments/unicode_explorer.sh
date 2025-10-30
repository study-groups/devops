#!/usr/bin/env bash
# unicode_explorer.sh - Interactive Unicode character explorer with search
#
# SEMANTIC FRAMING:
#   prompt_display  - The visual indicator requesting input (e.g., "ab >")
#   prompt_slots    - Four character positions in 2x2 grid
#   search_pattern  - Filter criteria for Unicode characters
#   char_slot       - Individual character position (1-4)
#   active_slot     - Currently selected slot (1-4) for editing
#   slot_bank       - Collection of 4 related unicode ranges
#
# Four-slot prompt format:
#   1 2 >
#   3 4
# Where slots 1,2,3,4 can be any Unicode character

SAVE_FILE="current_prompt.txt"

# Curated Unicode ranges organized into banks
declare -a BANKS=(
  "2800:256:Braille"
  "2500:128:Box"
  "2580:32:Block"
  "2590:16:BlockShade"
  "25E0:32:BlockGeom"
  "2596:16:BlockQuad"
  "2190:112:Arrow"
  "25A0:96:Geometric"
  "2600:100:Symbol"
  "2700:96:Dingbat"
)

current_bank=0

# Get character count for current bank
get_bank_count() {
  local bank_index=$1
  local bank_def="${BANKS[$bank_index]}"
  IFS=: read -r _ count _ <<< "$bank_def"
  echo "$count"
}

# Get character at offset in current bank
get_char_in_bank() {
  local bank_index=$1
  local offset=$2
  local bank_def="${BANKS[$bank_index]}"

  IFS=: read -r start count category <<< "$bank_def"

  if ((offset >= count)); then
    offset=$((offset % count))
  fi

  local codepoint=$((0x$start + offset))
  local hex=$(printf "%04X" $codepoint)
  printf "%s|%s|%s" "$(printf "\\U$hex")" "$hex" "$category"
}

# Save slots to file with optional remapping
# Usage: save_slots slot1 slot2 slot3 slot4 [mapping]
# mapping examples: "1234" (default), "1320" (swap 2&3, blank 4), "1111" (all slot1)
save_slots() {
  local s1="$1" s2="$2" s3="$3" s4="$4"
  local mapping="${5:-1234}"  # default to "1234"

  local -a out=(" " " " " " " ")
  local -a slots=(" " "$s1" "$s2" "$s3" "$s4")  # 1-indexed

  # Parse mapping string
  for i in {1..4}; do
    local map_char="${mapping:$((i-1)):1}"
    if [[ "$map_char" =~ [1-4] ]]; then
      out[$i]="${slots[$map_char]}"
    else
      out[$i]=" "  # blank for any non-digit or 0
    fi
  done

  printf "%s\n%s\n%s\n%s\n" "${out[1]}" "${out[2]}" "${out[3]}" "${out[4]}" > "$SAVE_FILE"
}

# Load slots from file
load_slots() {
  if [[ -f "$SAVE_FILE" ]]; then
    local -a loaded
    mapfile -t loaded < "$SAVE_FILE"
    echo "${loaded[0]:-}" "${loaded[1]:-}" "${loaded[2]:-}" "${loaded[3]:-}"
  else
    echo " " " " " " " "
  fi
}

# Get random character from current bank
random_char() {
  local bank_index=$1
  local count=$(get_bank_count "$bank_index")
  local random_offset=$((RANDOM % count))
  get_char_in_bank "$bank_index" "$random_offset" | cut -d'|' -f1
}

unicode_explorer_repl() {
  local char_offset=0
  local active_slot=1
  local -a slots
  local -a locked=(false false false false false)  # locks for slots 1-4 (index 1-4)

  # 4 separate mapping states
  local -a mappings=("" "1234" "2143" "3412" "4321")  # index 1-4
  local current_state=1  # which state (1-4) is active

  # Load saved slots or use defaults
  read -r slots[1] slots[2] slots[3] slots[4] <<< "$(load_slots)"

  local key entry char hex category
  local bank_count=$(get_bank_count $current_bank)

  tput civis
  tput clear

  while true; do
    tput cup 0 0
    tput ed  # Clear from cursor down

    # Get current character info
    IFS="|" read -r char hex category <<< "$(get_char_in_bank $current_bank $char_offset)"

    # Display header - minimal
    echo ""
    printf "  %s\n" "$char"
    echo ""
    printf "     U+%s  %s  [%d/%d]" "$hex" "$category" $((char_offset + 1)) "$bank_count"
    tput el  # Clear to end of line
    echo ""
    printf "     ↑↓ nav | ← → banks | 1,2,3,4 | SHIFT+# lock | random, save, quit"
    tput el
    echo ""
    printf "     state:%d map:%s | s=save m=edit-map []=cycle-state" "$current_state" "${mappings[$current_state]}"
    tput el
    echo ""
    echo " ────────────────────────────────────────────────────────────"

    # Display 4-slot grid with lock indicators and current mapping
    # Calculate what will be displayed based on current state mapping
    local mapping="${mappings[$current_state]}"
    local -a display_slots=(" " " " " " " ")

    for i in {1..4}; do
      local map_char="${mapping:$((i-1)):1}"
      if [[ "$map_char" =~ [1-4] ]]; then
        display_slots[$i]="${slots[$map_char]}"
      else
        display_slots[$i]=" "
      fi
    done

    local l1="" l2="" l3="" l4=""
    [[ ${locked[1]} == true ]] && l1="🔒" || l1=""
    [[ ${locked[2]} == true ]] && l2="🔒" || l2=""
    [[ ${locked[3]} == true ]] && l3="🔒" || l3=""
    [[ ${locked[4]} == true ]] && l4="🔒" || l4=""

    printf " %s%s%s%s ::" "$l1" "${display_slots[1]}" "$l2" "${display_slots[2]}"
    tput el
    echo ""
    printf " %s%s%s%s " "$l3" "${display_slots[3]}" "$l4" "${display_slots[4]}"
    tput el
    echo ""

    # Read input
    IFS= read -rsn1 key

    case "$key" in
      $'\x1b')  # Escape sequence (arrows)
        read -rsn2 -t 0.01 key
        case "$key" in
          "[A")  # Up
            ((char_offset--))
            ((char_offset < 0)) && char_offset=$((bank_count - 1))
            ;;
          "[B")  # Down
            ((char_offset++))
            ((char_offset >= bank_count)) && char_offset=0
            ;;
          "[C")  # Right - next bank
            ((current_bank++))
            ((current_bank >= ${#BANKS[@]})) && current_bank=0
            bank_count=$(get_bank_count $current_bank)
            char_offset=0
            ;;
          "[D")  # Left - previous bank
            ((current_bank--))
            ((current_bank < 0)) && current_bank=$((${#BANKS[@]} - 1))
            bank_count=$(get_bank_count $current_bank)
            char_offset=0
            ;;
        esac
        ;;

      "1")  # Select slot 1 and set immediately
        active_slot=1
        slots[1]="$char"
        save_slots "${slots[1]}" "${slots[2]}" "${slots[3]}" "${slots[4]}" "${mappings[$current_state]}"
        ;;

      "2")  # Select slot 2 and set immediately
        active_slot=2
        slots[2]="$char"
        save_slots "${slots[1]}" "${slots[2]}" "${slots[3]}" "${slots[4]}" "${mappings[$current_state]}"
        ;;

      "3")  # Select slot 3 and set immediately
        active_slot=3
        slots[3]="$char"
        save_slots "${slots[1]}" "${slots[2]}" "${slots[3]}" "${slots[4]}" "${mappings[$current_state]}"
        ;;

      "4")  # Select slot 4 and set immediately
        active_slot=4
        slots[4]="$char"
        save_slots "${slots[1]}" "${slots[2]}" "${slots[3]}" "${slots[4]}" "${mappings[$current_state]}"
        ;;

      "!")  # Shift+1 - toggle lock on slot 1
        if [[ ${locked[1]} == true ]]; then
          locked[1]=false
        else
          locked[1]=true
        fi
        ;;

      "@")  # Shift+2 - toggle lock on slot 2
        if [[ ${locked[2]} == true ]]; then
          locked[2]=false
        else
          locked[2]=true
        fi
        ;;

      "#")  # Shift+3 - toggle lock on slot 3
        if [[ ${locked[3]} == true ]]; then
          locked[3]=false
        else
          locked[3]=true
        fi
        ;;

      "$")  # Shift+4 - toggle lock on slot 4
        if [[ ${locked[4]} == true ]]; then
          locked[4]=false
        else
          locked[4]=true
        fi
        ;;

      "R"|"r")  # Random - fill all unlocked slots with random chars from current bank
        for i in 1 2 3 4; do
          if [[ ${locked[$i]} != true ]]; then
            slots[$i]=$(random_char $current_bank)
          fi
        done
        ;;

      "[")  # Cycle to previous state
        ((current_state--))
        ((current_state < 1)) && current_state=4
        save_slots "${slots[1]}" "${slots[2]}" "${slots[3]}" "${slots[4]}" "${mappings[$current_state]}"
        ;;

      "]")  # Cycle to next state
        ((current_state++))
        ((current_state > 4)) && current_state=1
        save_slots "${slots[1]}" "${slots[2]}" "${slots[3]}" "${slots[4]}" "${mappings[$current_state]}"
        ;;

      "s"|"S")  # Save with current state mapping
        save_slots "${slots[1]}" "${slots[2]}" "${slots[3]}" "${slots[4]}" "${mappings[$current_state]}"
        ;;

      "m"|"M")  # Edit mapping for current state
        # Put prompt on the slot line
        tput cup 8 0
        printf " %s%s%s%s :: " "$l1" "${display_slots[1]}" "$l2" "${display_slots[2]}"
        tput cnorm
        read -r user_mapping
        tput civis

        if [[ -n "$user_mapping" ]]; then
          mappings[$current_state]="$user_mapping"
        fi
        ;;

      "q"|"Q")  # Quit
        tput clear
        printf "Final prompt:\n %s%s ::\n %s%s\n" "${display_slots[1]}" "${display_slots[2]}" "${display_slots[3]}" "${display_slots[4]}"
        break
        ;;
    esac
  done

  tput cnorm
}

# Export
export -f unicode_explorer_repl

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  unicode_explorer_repl
fi

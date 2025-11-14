#!/usr/bin/env bash

# MIDI-MP Architecture Documentation
# Uses TDS (Tetra Display System) for theming

# Source TDS if available
if [[ -z "$TDS_LOADED" ]]; then
    TDS_SRC="${TDS_SRC:-$TETRA_SRC/bash/tds}"
    if [[ -f "$TDS_SRC/tds.sh" ]]; then
        source "$TDS_SRC/tds.sh"
    else
        echo "Warning: TDS not found, using plain output" >&2
    fi
fi

# Get colors from TDS tokens
c_primary=$(tds_color "structural.primary")
c_secondary=$(tds_color "structural.secondary")
c_accent=$(tds_color "structural.accent")
c_success=$(tds_color "status.success")
c_warning=$(tds_color "status.warning")
c_info=$(tds_color "status.info")
c_text=$(tds_color "text.primary")
c_muted=$(tds_color "text.muted")
c_heading=$(tds_color "content.heading.h1")
c_code=$(tds_color "content.code.inline")
c_reset=$(color_reset)

# Box drawing
BOX_TL='┌'
BOX_TR='┐'
BOX_BL='└'
BOX_BR='┘'
BOX_H='─'
BOX_V='│'
ARROW='→'
ARROW_DOWN='↓'
ARROW_SPLIT='┬'

clear

echo -e "${c_heading}"
cat << "BANNER"
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║           MIDI-MP: MIDI Multiplayer Protocol Architecture            ║
║                                                                       ║
║                    One Controller → Many Players                      ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
BANNER
echo -e "${c_reset}"

echo ""
echo -e "${c_text}$(color_bold)═══ 3-PROCESS CHAIN ═══${c_reset}"
echo ""

# Process 1: MIDI Hardware Bridge
echo -e "${c_success}${BOX_TL}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_TR}${c_reset}"
echo -e "${c_success}${BOX_V}${c_reset} $(color_bold)${c_text}Process 1: MIDI${c_reset}    ${c_success}${BOX_V}${c_reset}"
echo -e "${c_success}${BOX_V}${c_reset} ${c_info}midi-1983${c_reset}          ${c_success}${BOX_V}${c_reset}"
echo -e "${c_success}${BOX_V}${c_reset}                      ${c_success}${BOX_V}${c_reset}"
echo -e "${c_success}${BOX_V}${c_reset} ${c_warning}Port: 1983${c_reset}         ${c_success}${BOX_V}${c_reset}"
echo -e "${c_success}${BOX_V}${c_reset} ${c_muted}Output broadcasts${c_reset}  ${c_success}${BOX_V}${c_reset}"
echo -e "${c_success}${BOX_BL}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_BR}${c_reset}"

echo -e "         ${c_muted}${ARROW_DOWN}${c_reset}"
echo -e "         ${c_muted}UDP :1983${c_reset}"
echo -e "         ${c_muted}${ARROW_DOWN}${c_reset}"
echo -e "         ${c_muted}/midi/raw/cc/1/40 [0-127]${c_reset}"
echo -e "         ${c_muted}${ARROW_DOWN}${c_reset}"

# Process 2: MIDI-MP Router
echo -e "${c_secondary}${BOX_TL}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_TR}${c_reset}"
echo -e "${c_secondary}${BOX_V}${c_reset} $(color_bold)${c_text}Process 2: Router${c_reset} ${c_secondary}${BOX_V}${c_reset}"
echo -e "${c_secondary}${BOX_V}${c_reset} ${c_info}midi-mp-2020${c_reset}       ${c_secondary}${BOX_V}${c_reset}"
echo -e "${c_secondary}${BOX_V}${c_reset}                      ${c_secondary}${BOX_V}${c_reset}"
echo -e "${c_secondary}${BOX_V}${c_reset} ${c_warning}In:  1983${c_reset}          ${c_secondary}${BOX_V}${c_reset}"
echo -e "${c_secondary}${BOX_V}${c_reset} ${c_warning}Out: 2020${c_reset}          ${c_secondary}${BOX_V}${c_reset}"
echo -e "${c_secondary}${BOX_V}${c_reset} ${c_muted}Filters & Xforms${c_reset}  ${c_secondary}${BOX_V}${c_reset}"
echo -e "${c_secondary}${BOX_BL}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_BR}${c_reset}"

echo -e "         ${c_muted}${ARROW_DOWN}${c_reset}"
echo -e "         ${c_muted}UDP :2020 (broadcast)${c_reset}"
echo -e "         ${c_muted}${ARROW_DOWN}${c_reset}"
echo -e "         ${c_muted}/midi-mp/event/cymatics.*${c_reset}"
echo -e "         ${c_muted}${ARROW_DOWN}${c_reset}"
echo -e "         ${c_muted}${ARROW_SPLIT}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${c_reset} $(color_bold)${c_accent}MULTICAST!${c_reset}"
echo -e "         ${c_muted}${BOX_V}${c_reset}                  ${c_muted}Multiple apps can listen${c_reset}"
echo -e "     ${c_muted}${BOX_H}${BOX_H}${BOX_H}${BOX_H}┼${BOX_H}${BOX_H}${BOX_H}${BOX_H}${c_reset}"
echo -e "     ${c_muted}${BOX_V}   ${BOX_V}   ${BOX_V}${c_reset}"

# Consumer Apps (Multiple)
echo -e "${c_muted}     ${BOX_V}   ${BOX_V}   ${BOX_V}${c_reset}"
echo -e "${c_muted}     ${BOX_V}   ${BOX_V}   ${ARROW_DOWN}${c_reset}"

echo -e "${c_accent}   ${BOX_TL}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_TR}  ${BOX_TL}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_TR}  ${BOX_TL}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_TR}${c_reset}"
echo -e "${c_accent}   ${BOX_V}${c_reset} ${c_text}Cymatica${c_reset}  ${c_accent}${BOX_V}  ${BOX_V}${c_reset} ${c_text}VJ App${c_reset}    ${c_accent}${BOX_V}  ${BOX_V}${c_reset} ${c_text}Game${c_reset}      ${c_accent}${BOX_V}${c_reset}"
echo -e "${c_accent}   ${BOX_V}${c_reset} ${c_info}:2020${c_reset}     ${c_accent}${BOX_V}  ${BOX_V}${c_reset} ${c_info}:2020${c_reset}     ${c_accent}${BOX_V}  ${BOX_V}${c_reset} ${c_info}:2020${c_reset}     ${c_accent}${BOX_V}${c_reset}"
echo -e "${c_accent}   ${BOX_BL}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_BR}  ${BOX_BL}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_BR}  ${BOX_BL}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_H}${BOX_BR}${c_reset}"

echo ""
echo -e "$(color_bold)${c_text}═══ PORT USAGE ═══${c_reset}"
echo ""
echo -e "  ${c_success}1983${c_reset} ${c_muted}${ARROW}${c_reset} MIDI hardware output ${c_muted}(1983 = MIDI spec year)${c_reset}"
echo -e "  ${c_secondary}2020${c_reset} ${c_muted}${ARROW}${c_reset} Router output to consumers ${c_muted}(2020 = MIDI 2.0 year)${c_reset}"
echo ""

echo -e "$(color_bold)${c_text}═══ KEY FEATURES ═══${c_reset}"
echo ""
echo -e "  ${c_success}✓${c_reset} $(color_bold)UDP Broadcast${c_reset} - One-to-many communication"
echo -e "  ${c_success}✓${c_reset} $(color_bold)Multiple Listeners${c_reset} - Many apps on same port"
echo -e "  ${c_success}✓${c_reset} $(color_bold)No Registration${c_reset} - Just listen on :2020"
echo -e "  ${c_success}✓${c_reset} $(color_bold)Independent Processing${c_reset} - Each app handles its own logic"
echo ""

echo -e "$(color_bold)${c_text}═══ EXAMPLE USAGE ═══${c_reset}"
echo ""
echo -e "  ${c_muted}# Start the chain${c_reset}"
echo -e "  ${c_code}midi start${c_reset}                  ${c_muted}# midi-1983${c_reset}"
echo -e "  ${c_code}midi-mp router-cymatica${c_reset}    ${c_muted}# midi-mp-2020${c_reset}"
echo ""
echo -e "  ${c_muted}# Start MULTIPLE consumers (all on :2020)${c_reset}"
echo -e "  ${c_accent}midi-mp cymatica-start${c_reset}     ${c_muted}# Consumer 1${c_reset}"
echo -e "  ${c_accent}node my-vj-app.js${c_reset}          ${c_muted}# Consumer 2${c_reset}"
echo -e "  ${c_accent}node my-game.js${c_reset}            ${c_muted}# Consumer 3${c_reset}"
echo -e "  ${c_accent}node my-recorder.js${c_reset}        ${c_muted}# Consumer 4${c_reset}"
echo ""
echo -e "  ${c_muted}All consumers receive the same messages simultaneously!${c_reset}"
echo ""

echo -e "$(color_bold)${c_text}═══ TSM PROCESS LIST ═══${c_reset}"
echo ""
echo -e "  ${c_success}ID  Name                Port  Type${c_reset}"
echo -e "  ${c_success}──  ──────────────────  ────  ────${c_reset}"
echo -e "  11  ${c_info}midi-1983${c_reset}           1983  port  ${c_muted}(output)${c_reset}"
echo -e "  12  ${c_secondary}midi-mp-2020${c_reset}        2020  port  ${c_muted}(output)${c_reset}"
echo -e "  13  ${c_accent}cymatica${c_reset}            -     pid   ${c_muted}(listener)${c_reset}"
echo ""

echo -e "$(color_bold)${c_text}═══ MESSAGE FLOW EXAMPLE ═══${c_reset}"
echo ""
echo -e "  ${c_muted}Move knob CC 40 on MIDI controller:${c_reset}"
echo ""
echo -e "  ${c_success}midi-1983${c_reset}      ${c_muted}${ARROW}${c_reset} ${c_muted}/midi/raw/cc/1/40 [127]${c_reset}"
echo -e "  ${c_secondary}midi-mp-2020${c_reset}   ${c_muted}${ARROW}${c_reset} ${c_muted}/midi-mp/event/cymatics.frequency [2000 Hz]${c_reset}"
echo -e "  ${c_accent}cymatica${c_reset}       ${c_muted}${ARROW}${c_reset} ${c_muted}Updates frequency visualization${c_reset}"
echo -e "  ${c_accent}vj-app${c_reset}         ${c_muted}${ARROW}${c_reset} ${c_muted}Updates shader parameter${c_reset}"
echo -e "  ${c_accent}game${c_reset}           ${c_muted}${ARROW}${c_reset} ${c_muted}Updates player speed${c_reset}"
echo ""

echo -e "$(color_bold)${c_warning}═══ SYMBOLIC PORT NUMBERS ═══${c_reset}"
echo ""
echo -e "  ${c_success}1983${c_reset} = Year MIDI 1.0 specification was released"
echo -e "  ${c_secondary}2020${c_reset} = Year MIDI 2.0 protocol was introduced"
echo ""

echo -e "$(color_bold)${c_heading}═══════════════════════════════════════════════════════════${c_reset}"
echo -e "$(color_bold)${c_text}For more info: ${c_info}cat ~/tetra/bash/midi-mp/STARTUP.md${c_reset}"
echo -e "$(color_bold)${c_heading}═══════════════════════════════════════════════════════════${c_reset}"
echo ""

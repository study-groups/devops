#!/usr/bin/env bash
# tia_story_1979.sh
# 80x24 ASCII slide show about the Atari 2600 TIA sound module.

pause_screen() {
  echo
  read -r -p "  PRESS ENTER TO CONTINUE..." _
}

page1() {
  clear
  cat <<'EOF'

  ********************************************************
  *           ATARI VIDEO COMPUTER SYSTEM 1979           *
  ********************************************************

  LIVING ROOM GLOW. WOODGRAIN FRONT. RF CABLE TO TV.
  A CARTRIDGE CLICKS IN. SWITCHES SNAP DOWN.

  INSIDE:
    6507 CPU  @ ~1.19 MHZ
    RIOT CHIP (RAM + I/O + TIMER)
    TIA CHIP  (VIDEO + SOUND + INPUT)

  NO OPERATING SYSTEM.
  NO FRAMEBUFFER.
  JUST SILICON, WIRES, AND TIMING.

  THIS PROGRAM IS A TERMINAL TOUR
  OF THE TIA SOUND SIDE OF THAT WORLD.

  PRESS ENTER TO STEP THROUGH THE SCREENS.

EOF
  pause_screen
}

page2() {
  clear
  cat <<'EOF'

  ********************************************************
  *                CONSTRAINTS DEFINE STYLE              *
  ********************************************************

  MID 1970S PARTS COSTS ARE HIGH.

  RAM BYTES ARE EXPENSIVE.
  LOGIC GATES ARE COUNTED.
  TV TIMING IS FIXED BY BROADCAST SPEC.

  DESIGN TARGET:
    ONE CUSTOM CHIP DRIVES THE TV SIGNAL.
    SAME CHIP HANDLES SOUND AND INPUT.

  RESULTING RULES:
    NO LINE BUFFER.
    NO SOUND BUFFER.
    CPU MUST FEED TIA IN REAL TIME.

  PICTURE AND SOUND ARE BOTH
  PRODUCTS OF THE SAME CLOCK PRESSURE.

EOF
  pause_screen
}

page3() {
  clear
  cat <<'EOF'

  ********************************************************
  *                      THE TIA CHIP                    *
  ********************************************************

  NAME : TELEVISION INTERFACE ADAPTOR (TIA)
  ROLE : ANALOG + DIGITAL FRONT END TO THE TV

  MAIN FUNCTIONS:
    - GENERATE COLORBURST AND SYNC.
    - SHIFT OUT PIXELS AND PLAYFIELD.
    - SAMPLE CONTROLLERS.
    - GENERATE TWO AUDIO VOICES.

  BUS INTERFACE:
    WRITABLE REGISTERS ON THE 6507 BUS.
    NO READBACK FOR SOUND REGISTERS.

  THE SOUND BLOCK IS SMALL,
  BUT IT DEFINES THE 2600'S VOICE.

EOF
  pause_screen
}

page4() {
  clear
  cat <<'EOF'

  ********************************************************
  *                 PRIMARY VCS / TIA TEAM               *
  ********************************************************

  LARRY WAGNER
    LEAD ARCHITECT FOR THE VCS PROJECT.

  JOE DECUIR
    SYSTEM DESIGN, 6507 + RIOT + TIA INTEGRATION.
    EARLY GAME AND DEMO WORK (E.G. COMBAT).

  JAY MINER
    CUSTOM CHIP DESIGN. TURNED PROTOTYPE LOGIC
    INTO THE TIA SILICON IMPLEMENTATION.

  MANY OTHERS CONTRIBUTED,
  BUT THESE NAMES ANCHOR THE CORE HARDWARE STORY.

EOF
  pause_screen
}

page5() {
  clear
  cat <<'EOF'

  ********************************************************
  *                  TIA AUDIO STRUCTURE                 *
  ********************************************************

  TWO VOICES:
    VOICE 0 → AUDC0 / AUDF0 / AUDV0
    VOICE 1 → AUDC1 / AUDF1 / AUDV1

  PER VOICE:
    AUDC  (4 BITS)  : WAVE / NOISE MODE.
    AUDF  (5 BITS)  : FREQUENCY DIVISOR.
    AUDV  (4 BITS)  : OUTPUT LEVEL 0–15.

  BOTH VOICES ARE MIXED TO A SINGLE
  MONO OUTPUT AND SENT THROUGH THE RF MODULATOR.

  NO ENVELOPES. NO FILTER CONTROLS.
  ONLY LOGIC MODES, DIVISORS, AND LEVEL.

EOF
  pause_screen
}

page6() {
  clear
  cat <<'EOF'

  ********************************************************
  *               POLYNOMIAL NOISE SOURCES               *
  ********************************************************

  CORE RANDOM SEQUENCES IMPLEMENTED AS LFSRS:

    POLY4 :  4-STAGE LFSR, PERIOD  15 STEPS.
    POLY5 :  5-STAGE LFSR, PERIOD  31 STEPS.
    POLY9 :  9-STAGE LFSR, PERIOD 511 STEPS.

  EACH IS A MAXIMAL-LENGTH SEQUENCE
  OVER GF(2), CYCLING THROUGH ALL NONZERO STATES.

  TIA AUDIO MODES SELECT:
    - WHICH POLY FEEDS THE OUTPUT.
    - WHETHER POLY5 ALSO GATES THE CLOCK.
    - OR WHETHER A PURE TOGGLE TONE IS USED.

EOF
  pause_screen
}

page7() {
  clear
  cat <<'EOF'

  ********************************************************
  *                PERCEPTIBLE BEHAVIOR 1979             *
  ********************************************************

  FROM THE PLAYER'S EAR:

    LASER SHOTS:
      SHORT, HIGH-PITCHED TOGGLES OR POLY4 MODES
      WITH RAPID AUDF SWEEPS.

    EXPLOSIONS:
      POLY9 OR POLY5 NOISE,
      VOLUME STEPPED DOWN IN SOFTWARE.

    FOOTSTEPS / ENGINES:
      LOW FREQUENCY TOGGLES,
      SMALL DIVISORS, MEDIUM VOLUME.

    SIMPLE MUSIC:
      TWO-VOICE SEQUENCES OF PITCH VALUES,
      OCCASIONALLY USING NOISE AS PERCUSSION.

EOF
  pause_screen
}

page8() {
  clear
  cat <<'EOF'

  ********************************************************
  *        CPU, RACING THE BEAM, AND SOUND UPDATES       *
  ********************************************************

  DURING EACH SCANLINE:

    CPU MUST:
      - UPDATE HORIZ. POSITION REGISTERS.
      - FEED GRAPHICS FOR CURRENT LINE.
      - HANDLE GAME LOGIC WHEN SAFE.
      - OCCASIONALLY WRITE AUDC / AUDF / AUDV.

  TIMING IMPLICATION:

    SOUND CHANGES ARE OFTEN QUANTIZED
    TO SCANLINE OR FRAME BOUNDARIES.

  THIS IS WHY MANY EFFECTS
  HAVE STEPWISE PITCH OR VOLUME SHIFTS.

EOF
  pause_screen
}

page9() {
  clear
  cat <<'EOF'

  ********************************************************
  *                LEGAL AND PRACTICAL NOTES             *
  ********************************************************

  PATENTS FROM THAT ERA ARE EXPIRED.
  HARDWARE BEHAVIOR AS SUCH IS NOT COPYRIGHTED.

  YOU MUST AVOID:
    - USING ATARI TRADEMARKS AS IF ENDORSED.
    - COPYING ORIGINAL GAME MUSIC OR SAMPLES.
    - VIOLATING LICENSES OF EMULATORS OR TOOLS.

  YOU MAY IMPLEMENT YOUR OWN
  TIA-LIKE SYNTHESIS AND POLYNOMIAL LOGIC
  AND USE IT IN NEW GAMES.

EOF
  pause_screen
}

page10() {
  clear
  cat <<'EOF'

  ********************************************************
  *                    1979 AND AFTER                    *
  ********************************************************

  BY LATE 1970S:

    THE TIA SOUND IS PART OF
    THE CULTURAL NOISE FLOOR:
    ARCADES, LIVING ROOMS, TV STATIC.

  LATER SYSTEMS ADD MORE CHANNELS,
  BETTER TIMBRES, RICHER MUSIC ENGINES.

  BUT THE 2600 TIA REMAINS:
    TWO VOICES.
    SMALL POLYNOMIAL REGISTERS.
    STRONG IDENTITY.

  END OF TOUR.

EOF
}

main() {
  page1
  page2
  page3
  page4
  page5
  page6
  page7
  page8
  page9
  page10
}

main

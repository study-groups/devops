#!/usr/bin/env bash
# estoface_help.sh - Help tree for estoface facial modeling system
# Uses bash/tree for hierarchical help navigation

# Source tree if not already loaded
if ! declare -F tree_insert >/dev/null 2>&1; then
    source "$TETRA_SRC/bash/tree/core.sh"
fi

# Build estoface help tree
estoface_build_help_tree() {
    # Root
    tree_insert "help.estoface" category \
        title="Estoface" \
        help="Facial animation + speech synthesis via gamepad"

    # ========================================================================
    # OVERVIEW
    # ========================================================================

    tree_insert "help.estoface.overview" category \
        title="Overview" \
        help="System architecture" \
        detail="Gamepad → Facial Model → Renderer + Formant Engine
4x4 grid control, FACS-based, UTF-8 display, formant synthesis"

    tree_insert "help.estoface.overview.philosophy" category \
        title="Philosophy" \
        help="Tech art + science: anatomical + performable + efficient" \
        detail="Phase 1: 4x4 grid, basic mouth
Phase 2: Interpolation, smooth control
Phase 3: Tissue modeling
Phase 4: Full face (eyes, expression)"

    # ========================================================================
    # GAMEPAD CONTROL
    # ========================================================================

    tree_insert "help.estoface.gamepad" category \
        title="Gamepad" \
        help="MIDI-style facial performance controller" \
        detail="Transform gamepad into expressive speech controller

Two joysticks map to 4x4 grids = 256 discrete mouth positions
Think: Playing phonemes like MIDI notes, not typing
Performance-oriented: triggers for intensity, hat for modes

Core concept: Coarse control (16 positions) is faster and more
repeatable than fine analog control. Corner positions = cardinal vowels.
Diagonal positions = rare phonemes (harder to hit by design)."

    tree_insert "help.estoface.gamepad.mapping" category \
        title="Mapping" \
        help="Controller layout" \
        detail="Left Stick: Jaw Y-axis [4], Lip Rounding X-axis [4]
Right Stick: Tongue Height Y [4], Front/Back X [4]
Hat: Mode switch | Triggers: Intensity | Buttons: A/E/I/O/U presets"

    tree_insert "help.estoface.gamepad.grid" category \
        title="Grid" \
        help="4x4 position system = 256 mouth configs" \
        detail="Primary: Jaw × Rounding = 16
Secondary: Tongue H × F = 16
Corners (easy): NE=[i] NW=[u] SE=[æ] SW=[ɑ]
Diagonals (hard): Rare phonemes"

    tree_insert "help.estoface.gamepad.rhythm" category \
        title="Performance" \
        help="Sequencing phonemes like MIDI notes" \
        detail="Triggers: Stress/intensity
Hat: Mode (sustain vs rapid)
Think: Vowel melodies, not typing"

    # ========================================================================
    # FACIAL MODEL
    # ========================================================================

    tree_insert "help.estoface.model" category \
        title="Model" \
        help="Anatomical state representation" \
        detail="High DOF facial model based on FACS (Facial Action Coding System)

Internal state has maximum degrees of freedom for accurate simulation.
Gamepad provides coarse input → model interpolates smooth transitions.

Primary articulators: jaw (open/thrust), lips (round/compress/protrude),
tongue (height/frontness/tip), velum (nasality).

Phase 1: Simplified state (4 primary DOF)
Future: Full FACS with tissue modeling (collagen, elasticity)"

    tree_insert "help.estoface.model.state" category \
        title="State" \
        help="Core parameters (all 0.0-1.0)" \
        detail="Jaw: openness, thrust
Lips: rounding, compression, protrusion, corner_height
Tongue: height, frontness, tip_raised
Velum: lowered (nasality)"

    tree_insert "help.estoface.model.facs" category \
        title="FACS" \
        help="Action Units (melindaozel.com/facs-cheat-sheet)" \
        detail="Jaw: AU26(drop) AU27(stretch) AU31(clench) AD29(thrust)
Lips: AU18(pucker) AU22(funnel) AU23(tight) AU24(press) AU28(suck)
Corners: AU12(smile) AU15(frown) AU20(stretch)
Other: AU8 AU13-17 AU25 AD19 AD30 AD32"

    tree_insert "help.estoface.model.facs.reference" category \
        title="AU Reference" \
        help="Complete mouth AU list" \
        detail="AU8:Lips→Each AU12:Pull(smile) AU13:SharpPull AU14:Dimple
AU15:Depress(frown) AU16:LowerDepress AU17:ChinRaise
AU18:Pucker AU20:Stretch AU22:Funnel AU23:Tight AU24:Press
AU25:Part AU26:JawDrop AU27:MouthStretch AU28:Suck
AU31:JawClench AD19:TongueShow AD29:JawThrust AD30:JawSide"

    tree_insert "help.estoface.model.phonemes" category \
        title="Phonemes" \
        help="State→sound mapping" \
        detail="[i] beet: jaw=0.0 round=0.0 th=0.9 tf=0.9
[u] boot: jaw=0.1 round=1.0 th=0.9 tf=0.1
[æ] cat:  jaw=0.7 round=0.0 th=0.3 tf=0.8
[ɑ] father: jaw=1.0 round=0.0 th=0.0 tf=0.2"

    # ========================================================================
    # RENDERING
    # ========================================================================

    tree_insert "help.estoface.rendering" category \
        title="Rendering" \
        help="UTF-8 terminal display, budget UI" \
        detail="Terminal-based face rendering using UTF-8 box-drawing chars

Budget UI aesthetic: Simpler than pulsar, 5 stacking panels
Key insight: Use brightness/dimness to hint at 3D depth in 2D terminal

Panels toggle with keys 1-5 (bottom to top):
  1: Control values + IPA phoneme display
  2: Mouth side view (sagittal cross-section)
  3: Mouth front view (what observer sees)
  4: Eyes and eyebrows (Phase 4)
  5: Command line and status

Tech art: Characters chosen for visual clarity, not realism"

    tree_insert "help.estoface.rendering.panels" category \
        title="Panels" \
        help="5 toggleable panels (keys 1-5)" \
        detail="5:Command/Status 4:Eyes 3:Front 2:Side 1:Values
Budget UI: simpler than pulsar, eyes lower"

    tree_insert "help.estoface.rendering.characters" category \
        title="Characters" \
        help="UTF-8 palette for facial features" \
        detail="Lips:( ) [ ] { } ╱╲─│◡◠  Teeth:‿⌢▁▂▃
Tongue:~∼≈*·  Jaw:‾_⌞⌟└┘
Shading: dim=back/shadow, bright=front/highlight"

    tree_insert "help.estoface.rendering.examples" category \
        title="Examples" \
        help="Sample mouth renderings" \
        detail="Closed: /----\\ or (  )
Open: /    \\ or |  |
Side: .--. |/\\ ||.~~~* \\___"

    # ========================================================================
    # FORMANT SYNTHESIS
    # ========================================================================

    tree_insert "help.estoface.formant" category \
        title="Formant" \
        help="Speech synthesis via ../formant" \
        detail="Real-time formant synthesis driven by facial model state

Articulatory synthesis: Face position → formant frequencies → sound
More intuitive than direct frequency control for performers

Key mappings (simplified):
  Jaw open → F1 increases (lower vowels)
  Tongue high → F1 decreases (higher vowels)
  Tongue front → F2 increases (front vowels)
  Lips round → F2/F3 decrease (rounded vowels)

Communication via named pipes (FIFOs) for low-latency streaming
Direction: estoface sends → formant engine receives and synthesizes"

    tree_insert "help.estoface.formant.mapping" category \
        title="Mapping" \
        help="Face state → formant frequencies" \
        detail="jaw_open→F1↑ tongue_h→F1↓ tongue_f→F2↑ lip_round→F2/F3↓
[a]:jaw=1.0 th=0.0 tf=0.2 → F1=730 F2=1090 F3=2440
[i]:jaw=0.0 th=0.9 tf=0.9 → F1=270 F2=2290 F3=3010"

    tree_insert "help.estoface.formant.protocol" category \
        title="Protocol" \
        help="IPC via named pipes (FIFOs)" \
        detail="Format: FORMANT <F1> <F2> <F3> <amp> <voicing>
Example: FORMANT 730 1090 2440 0.8 1.0
Direction: estoface→formant (unidirectional)"

    tree_insert "help.estoface.formant.ipc" category \
        title="IPC" \
        help="Named pipes (FIFOs) for low-latency streaming" \
        detail="Options: FIFO(chosen), UDP(lossy), stdio(coupled), shmem(complex)
FIFOs: low latency, simple, standard shell redirection"

    # ========================================================================
    # TESTING
    # ========================================================================

    tree_insert "help.estoface.testing" category \
        title="Testing" \
        help="Calibration and validation tools" \
        detail="Comprehensive testing for 256-position mouth model

test_all_positions.sh generates reference file with:
  • All 256 grid positions [0-3, 0-3, 0-3, 0-3]
  • Visual rendering (UTF-8) for each position
  • Formant values (F1, F2, F3) for acoustic verification
  • Closest IPA phoneme match

REPL commands for interactive calibration:
  show grid X Y   - Display specific position
  morph A B       - Animate smooth transition
  formant         - Real-time frequency display
  record/playback - Performance capture"

    tree_insert "help.estoface.testing.positions" category \
        title="Positions" \
        help="test_all_positions.sh generates all 256 configs" \
        detail="Output: position, state, formants, IPA, rendering
Use for visual calibration and formant verification"

    tree_insert "help.estoface.testing.repl" category \
        title="REPL" \
        help="Interactive testing commands" \
        examples="show grid 2 3        # Show position [2,3]
morph 0,0,0,0 3,3,3,3  # Animate [i]→[ɑ]
formant                # Display F1/F2/F3
record sequence.esto   # Record performance"

    # ========================================================================
    # DEVELOPMENT ROADMAP
    # ========================================================================

    tree_insert "help.estoface.roadmap" category \
        title="Roadmap" \
        help="5-phase development plan" \
        detail="Progressive fidelity: Start simple, add complexity

Phase 1 (Current): Mouth foundation
  Basic mouth rendering, FACS model, gamepad input, 4x4 grid

Phase 2: Integration
  IPC with formant, real-time loop, REPL interface

Phase 3: Refinement
  Smooth interpolation, expression modulation, recording

Phase 4: Full face
  Eyes, eyebrows, emotional expressions, coordination

Phase 5: Advanced (Research)
  Tissue physics, collagen modeling, micro-expressions, variation"

    tree_insert "help.estoface.roadmap.phase1" category \
        title="Phase1" \
        help="Mouth foundation (current)" \
        detail="✓ Basic rendering • FACS model • Gamepad • 4x4 grid • Testing"

    tree_insert "help.estoface.roadmap.phase2" category \
        title="Phase2" \
        help="Integration (planned)" \
        detail="IPC+formant • Real-time loop • REPL interface"

    tree_insert "help.estoface.roadmap.phase3" category \
        title="Phase3" \
        help="Refinement" \
        detail="Interpolation • Expression • Record/playback • Presets"

    tree_insert "help.estoface.roadmap.phase4" category \
        title="Phase4" \
        help="Full face" \
        detail="Eyes • Eyebrows • Emotions • Sync"

    tree_insert "help.estoface.roadmap.phase5" category \
        title="Phase5" \
        help="Advanced (research)" \
        detail="Tissue physics • Collagen • Micro-expressions • Variation"

    # ========================================================================
    # REFERENCES
    # ========================================================================

    tree_insert "help.estoface.references" category \
        title="References" \
        help="External docs and resources" \
        detail="Foundation: FACS (Facial Action Coding System)
  melindaozel.com/facs-cheat-sheet - Complete AU reference

Phonetics: IPA (International Phonetic Alphabet)
  internationalphoneticalphabet.org - Vowel/consonant charts

Synthesis: ../formant engine
  README.md, QUICKSTART.md, ESTO_FORMAT.md, CONTROL_SIGNALS.md

Architecture: ../pulsar
  Reference for REPL, TDS, color system integration
  Estoface differs: budget UI, gamepad vs keyboard"

    tree_insert "help.estoface.references.facs" category \
        title="FACS" \
        help="melindaozel.com/facs-cheat-sheet" \
        detail="AU reference: muscles, actions, visuals, combinations"

    tree_insert "help.estoface.references.ipa" category \
        title="IPA" \
        help="internationalphoneticalphabet.org/ipa-charts" \
        detail="Vowel quadrilateral, consonant chart by place+manner"

    tree_insert "help.estoface.references.formant" category \
        title="Formant" \
        help="../formant/README.md + docs" \
        detail="QUICKSTART.md, ESTO_FORMAT.md, CONTROL_SIGNALS.md"

    tree_insert "help.estoface.references.pulsar" category \
        title="Pulsar" \
        help="../pulsar/pulsar_repl.sh" \
        detail="Borrows: REPL, color, TDS, commands
Differs: budget UI, gamepad control"

}

# Auto-build tree on source
estoface_build_help_tree

# Export function
export -f estoface_build_help_tree

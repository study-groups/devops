# State Machine Architecture

## Problem
Currently we have 3+ independent state machines that can get out of sync:
- **Recorder**: IDLE → WAITING_FOR_SPEECH → RECORDING → STOPPING → IDLE
- **VAD**: CALIBRATING → LISTENING → SPEECH_DETECTED → SILENCE_DETECTED
- **Engine**: IDLE → RUNNING → PAUSED → STOPPING
- **Session** (implicit): SETUP → PLAYING_EXAMPLE → WAITING_FOR_USER → RECORDING → COMPLETE

## Issues
1. Recorder state STOPPING not properly transitioning back to IDLE
2. No coordination between example playback and recording start
3. VAD and Recorder can desync
4. Script doesn't know recorder's actual state

## Solution: Hierarchical State Machines

### 1. Session State Machine (Top Level)
Controls the overall recording workflow.

```
STATES:
  - SESSION_INIT          // Creating directories, opening FIFO
  - SESSION_READY         // Engine running, ready for phonemes
  - PHONEME_INIT          // Starting new phoneme
  - EXAMPLE_PLAYING       // Playing example (engine + volume)
  - EXAMPLE_STOPPING      // Silencing example
  - WAITING_USER          // Waiting for ENTER/skip
  - RECORDING_INIT        // Starting recorder
  - RECORDING_ACTIVE      // VAD listening + recording
  - RECORDING_FINALIZING  // Closing file, calculating stats
  - PHONEME_COMPLETE      // Show stats, ready for next
  - SESSION_CLEANUP       // Closing FIFO, stopping engine
  - SESSION_COMPLETE      // Show summary

TRANSITIONS:
  SESSION_INIT → SESSION_READY (when engine starts)
  SESSION_READY → PHONEME_INIT (when phoneme starts)
  PHONEME_INIT → EXAMPLE_PLAYING (when PH command sent)
  EXAMPLE_PLAYING → EXAMPLE_STOPPING (after duration)
  EXAMPLE_STOPPING → WAITING_USER (when volume=0)
  WAITING_USER → RECORDING_INIT (on ENTER)
  WAITING_USER → PHONEME_COMPLETE (on 's' skip)
  RECORDING_INIT → RECORDING_ACTIVE (when recorder starts)
  RECORDING_ACTIVE → RECORDING_FINALIZING (on VAD end/timeout)
  RECORDING_FINALIZING → PHONEME_COMPLETE (when stats calculated)
  PHONEME_COMPLETE → PHONEME_INIT (more takes/phonemes)
  PHONEME_COMPLETE → SESSION_CLEANUP (all done)
  SESSION_CLEANUP → SESSION_COMPLETE

INVARIANTS:
  - Can only start recording when RECORDING_INIT
  - Must wait for recorder IDLE before next recording
  - Example must be stopped before recording
```

### 2. Recorder State Machine (C Code)
Hardware recording control.

```
STATES:
  - RECORDER_IDLE          // No recording, ready to start
  - RECORDER_STARTING      // Opening stream, creating file
  - RECORDER_WAITING       // VAD mode: waiting for speech
  - RECORDER_RECORDING     // Actively writing samples
  - RECORDER_STOPPING      // Stream stopped, finalizing file

TRANSITIONS:
  IDLE → STARTING (on record_start())
  STARTING → WAITING (VAD mode, when stream opens)
  STARTING → RECORDING (fixed mode, when stream opens)
  WAITING → RECORDING (VAD detects speech)
  RECORDING → STOPPING (VAD silence / duration / error)
  STOPPING → IDLE (file closed, stream destroyed)

INVARIANTS:
  - stream==NULL iff state==IDLE
  - wav_file==NULL iff state==IDLE
  - Can only start if state==IDLE
  - STOPPING must transition to IDLE in next engine cycle
```

### 3. VAD State Machine (C Code)
Voice activity detection.

```
STATES:
  - VAD_CALIBRATING      // Measuring noise floor
  - VAD_LISTENING        // Monitoring for speech
  - VAD_SPEECH_START     // Speech detected
  - VAD_SPEECH_ACTIVE    // Speech continuing
  - VAD_SPEECH_END       // Silence after speech
  - VAD_TIMEOUT          // Max duration exceeded

TRANSITIONS:
  CALIBRATING → LISTENING (after N frames)
  LISTENING → SPEECH_START (RMS > threshold)
  SPEECH_START → SPEECH_ACTIVE (confirmed speech)
  SPEECH_ACTIVE → SPEECH_END (RMS < threshold)
  SPEECH_END → LISTENING (false positive)
  SPEECH_END → TIMEOUT (capture complete)
  * → TIMEOUT (max duration)

INVARIANTS:
  - Calibration must complete before detection
  - Pre-trigger buffer only in LISTENING state
  - Recording only happens in SPEECH_* states
```

### 4. Implementation Strategy

#### Phase 1: Add Explicit State to Recorder (C)
```c
typedef enum {
    RECORDER_IDLE,
    RECORDER_STARTING,
    RECORDER_WAITING,
    RECORDER_RECORDING,
    RECORDER_STOPPING
} recorder_state_t;

// Add transition validation
int recorder_transition(recorder_t* r, recorder_state_t new_state) {
    // Validate transition is legal
    // Log transition for debugging
    // Update state atomically
}
```

#### Phase 2: Add Session State to Script (Bash)
```bash
SESSION_STATE="SESSION_INIT"

transition_state() {
    local new_state="$1"
    # Validate transition
    # Log for debugging
    SESSION_STATE="$new_state"
}

# Usage:
transition_state "EXAMPLE_PLAYING"
echo "PH $phoneme 2000 120 0.8 0.3" >&3
transition_state "EXAMPLE_STOPPING"
```

#### Phase 3: Add State Queries (Commands)
```bash
# New commands for formant engine:
STATUS           # Returns: ENGINE=RUNNING RECORDER=IDLE VAD=NONE
WAIT_RECORDER    # Blocks until recorder state == IDLE
```

#### Phase 4: Synchronization Points
```bash
# Before starting new recording:
send_command "WAIT_RECORDER"  # Block until last recording finalized
assert_state "SESSION_READY"
transition_state "RECORDING_INIT"
send_command "RECORD_VAD ..."
transition_state "RECORDING_ACTIVE"
```

## Benefits
1. **Clear ownership**: Each component owns its state
2. **Debuggability**: Log all transitions, easy to see where it breaks
3. **Race prevention**: Can't start recording if not in right state
4. **Testing**: Can test state machine transitions independently
5. **Documentation**: State diagram IS the documentation

## Next Steps
1. Implement recorder state transitions with validation
2. Add STATUS command to query states
3. Add session state machine to bash script
4. Add state logging/debugging output
5. Write state machine tests

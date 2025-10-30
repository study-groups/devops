# TMC Quick Start Guide

Get up and running with TMC in 5 minutes.

## Prerequisites

- Tetra installed and sourced (`source ~/tetra/tetra.sh`)
- MIDI controller connected via USB
- PortMIDI library installed

## Installation

### 1. Install PortMIDI

**macOS:**
```bash
brew install portmidi
```

**Linux:**
```bash
sudo apt-get install libportmidi-dev
```

### 2. Build TMC Binary

```bash
cd ~/tetra/bash/midi
make
```

Or use the tmc command:
```bash
source ~/tetra/bash/midi/midi.sh
tmc build
```

### 3. Verify Installation

```bash
./tmc -l
```

You should see a list of available MIDI devices.

## Basic Usage

### 1. Start TMC Service

```bash
# Load TMC module
source ~/tetra/bash/midi/midi.sh

# Start service (uses default MIDI devices)
tsm start bash ~/tetra/bash/midi/core/socket_server.sh tmc
```

**With specific MIDI devices:**
```bash
# Find your device IDs first
tmc devices

# Set device IDs
export TMC_INPUT_DEVICE=2   # Your controller's ID
export TMC_OUTPUT_DEVICE=2  # Your controller's ID

# Start service
tsm start bash ~/tetra/bash/midi/core/socket_server.sh tmc
```

### 2. Check Status

```bash
tmc status
```

### 3. Learn Your First Control

```bash
# Learn volume control on pot 1
tmc learn VOLUME p1 0.0 1.0

# Now move pot 1 on your controller
# TMC will detect the CC and save the mapping
```

### 4. See Your Mappings

```bash
tmc list
```

### 5. Save Your Configuration

```bash
tmc save my-setup
```

## Learning All Controls

### Use the Wizard

```bash
tmc wizard
```

Follow the prompts to learn controls step-by-step.

### Or Learn in Batches

```bash
# Learn all 8 pots
tmc learn-all pots

# Learn all 8 sliders
tmc learn-all sliders

# Learn all 32 buttons
tmc learn-all buttons

# Learn transport controls
tmc learn-all transport
```

## Monitor MIDI Events

### Start the Monitor Service

```bash
tsm start bash ~/tetra/bash/midi/services/midi_monitor.sh midi-monitor
```

Now move controls on your MIDI controller and watch the events!

### Check the Log

```bash
tail -f ~/tetra/logs/midi_events.log
```

## Broadcast Modes

Control what information gets broadcast:

```bash
# Only raw MIDI (CC, channel, controller, value)
tmc mode raw

# Only syntax names (p1, s1, b1a, etc.)
tmc mode syntax

# Only semantic names (VOLUME, TRIGGER_KICK, etc.)
tmc mode semantic

# All three together (default)
tmc mode all
```

## Common Tasks

### Load a Saved Session

```bash
tmc load my-setup
```

### Change MIDI Device

```bash
# List devices
tmc devices

# Load device configuration
tmc device my-akai-mpk
```

### Edit Mappings Manually

```bash
# Edit hardware mappings (CC assignments)
tmc config edit hardware

# Edit semantic mappings (names and ranges)
tmc config edit semantic

# Edit color table (for LED feedback)
tmc config edit colors
```

### Remove a Mapping

```bash
tmc unlearn VOLUME
# or
tmc unlearn p1
```

### Clear All Mappings

```bash
tmc clear
```

## Example Workflow

Complete setup from scratch:

```bash
# 1. Source TMC
source ~/tetra/bash/midi/midi.sh

# 2. Find your MIDI device
tmc devices
# Note the ID (e.g., 2)

# 3. Start TMC with your device
export TMC_INPUT_DEVICE=2
export TMC_OUTPUT_DEVICE=2
tsm start bash ~/tetra/bash/midi/core/socket_server.sh tmc

# 4. Start monitor to see events
tsm start bash ~/tetra/bash/midi/services/midi_monitor.sh midi-monitor

# 5. Learn controls using wizard
tmc wizard

# 6. Or learn specific controls
tmc learn VOLUME p1 0.0 1.0
tmc learn PAN p2 -1.0 1.0
tmc learn BRIGHTNESS s1 0 127
tmc learn TRIGGER_KICK b1a

# 7. Set broadcast mode
tmc mode semantic

# 8. Save your setup
tmc save my-controller

# 9. Check everything
tmc list
tmc status
tsm list
```

## Troubleshooting

### "tmc binary not found"

```bash
cd ~/tetra/bash/midi
make
```

### "No MIDI devices found"

- Check your MIDI controller is connected
- macOS: Open "Audio MIDI Setup" and check MIDI devices
- Linux: Run `aconnect -l` or `amidi -l`
- Try unplugging and replugging the controller

### "Failed to connect to socket"

TMC service isn't running:

```bash
tsm start bash ~/tetra/bash/midi/core/socket_server.sh tmc
```

### "Learning timeout"

- Make sure you're moving the control within 5 seconds
- Check that TMC service is receiving MIDI (use monitor)
- Verify your MIDI device is sending data

### Events Not Appearing in Monitor

```bash
# Check TMC service is running
tsm list

# Check monitor is subscribed
echo "LIST_SUBSCRIBERS" | nc -U $TSM_PROCESSES_DIR/sockets/tmc.sock

# Restart monitor
tsm stop midi-monitor
tsm start bash ~/tetra/bash/midi/services/midi_monitor.sh midi-monitor
```

## Next Steps

- Read the full README: `~/tetra/bash/midi/README.md`
- Create custom subscriber services
- Integrate with your applications
- Set up LED color feedback
- Create device-specific configurations

## Useful Commands Summary

```bash
# Service management
tsm start bash ~/tetra/bash/midi/core/socket_server.sh tmc
tsm stop tmc
tmc status

# Learning
tmc learn <semantic> <syntax> <min> <max>
tmc learn-all <pots|sliders|buttons|transport>
tmc wizard

# Mapping management
tmc list
tmc mode <raw|syntax|semantic|all>
tmc save <session-name>
tmc load <session-name>

# Monitoring
tsm start bash ~/tetra/bash/midi/services/midi_monitor.sh midi-monitor
tail -f ~/tetra/logs/midi_events.log

# Configuration
tmc config show
tmc config edit <hardware|semantic|colors>
tmc devices

# Help
tmc help
tmc learn-help
```

## Integration Example

Subscribe to TMC events in your bash script:

```bash
#!/usr/bin/env bash

# Your app's socket
MY_SOCKET="/tmp/my_app.sock"

# Subscribe to TMC
echo "SUBSCRIBE $MY_SOCKET" | nc -U $TSM_PROCESSES_DIR/sockets/tmc.sock

# Listen for semantic events
while read -r event; do
    if [[ "$event" =~ ^SEMANTIC\ VOLUME\ (.+)$ ]]; then
        volume="${BASH_REMATCH[1]}"
        echo "Setting volume to: $volume"
        # Do something with volume
    fi
done < <(nc -l -U "$MY_SOCKET")
```

Happy MIDI mapping! 🎛️

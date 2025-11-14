# OSC Implementation Guide for C Applications

## Overview

This guide documents the minimal OSC (Open Sound Control) implementation used in the Pulsar engine and provides a reusable pattern for integrating MIDI control into C applications via OSC multicast.

## Architecture

```
MIDI Controller
     ↓
  midi.js (Node.js bridge with --map option)
     ↓
  OSC Multicast (UDP 224.0.0.1:1983)
     ↓
  C Application (joins multicast, receives OSC)
     ↓
  Real-time Processing
```

### Key Benefits

- **No socket files** - UDP multicast, stateless
- **No connection management** - Fire-and-forget datagrams
- **Multiple listeners** - Broadcast to N applications
- **Low latency** - Direct UDP, <5ms typical
- **Simple protocol** - Minimal OSC subset, easy to parse
- **Robust** - Survives crashes, no cleanup needed

## Core OSC Implementation

### Files Required

1. **osc.h** - Header file (64 lines)
2. **osc.c** - Implementation (150 lines)

### osc.h - Header Definition

```c
#ifndef OSC_H
#define OSC_H

#include <stdint.h>
#include <sys/socket.h>
#include <netinet/in.h>

/* Max OSC message size */
#define OSC_MAX_MSG_SIZE 2048
#define OSC_MAX_ARGS 16

/* OSC type tags */
#define OSC_TYPE_INT32  'i'
#define OSC_TYPE_FLOAT  'f'
#define OSC_TYPE_STRING 's'

/* OSC argument */
typedef struct {
    char type;
    union {
        int32_t i;
        float f;
        const char *s;
    };
} OSC_Arg;

/* Parsed OSC message */
typedef struct {
    const char *address;   /* OSC address pattern */
    int argc;              /* Number of arguments */
    OSC_Arg args[OSC_MAX_ARGS];
} OSC_Message;

/* OSC UDP receiver context */
typedef struct {
    int sock;
    struct sockaddr_in addr;
    char recv_buffer[OSC_MAX_MSG_SIZE];
} OSC_Receiver;

/* Initialize OSC UDP receiver on multicast group */
int osc_init_receiver(OSC_Receiver *osc, const char *multicast_addr, int port);

/* Close OSC receiver */
void osc_close_receiver(OSC_Receiver *osc);

/* Receive and parse OSC message (non-blocking) */
int osc_recv_message(OSC_Receiver *osc, OSC_Message *msg);

#endif
```

### osc.c - Key Implementation Details

#### 1. Socket Setup with SO_REUSEPORT

```c
int osc_init_receiver(OSC_Receiver *osc, const char *multicast_addr, int port) {
    // Create UDP socket
    osc->sock = socket(AF_INET, SOCK_DGRAM, 0);

    // Set non-blocking
    int flags = fcntl(osc->sock, F_GETFL, 0);
    fcntl(osc->sock, F_SETFL, flags | O_NONBLOCK);

    // CRITICAL: Set SO_REUSEADDR and SO_REUSEPORT
    int reuse = 1;
    setsockopt(osc->sock, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse));

#ifdef SO_REUSEPORT
    // Allows multiple processes to bind to same port (macOS/BSD)
    setsockopt(osc->sock, SOL_SOCKET, SO_REUSEPORT, &reuse, sizeof(reuse));
#endif

    // Bind to INADDR_ANY, not the multicast address!
    struct sockaddr_in bind_addr;
    bind_addr.sin_family = AF_INET;
    bind_addr.sin_port = htons(port);
    bind_addr.sin_addr.s_addr = INADDR_ANY;  // KEY: Not multicast addr

    bind(osc->sock, (struct sockaddr*)&bind_addr, sizeof(bind_addr));

    // Join multicast group
    struct ip_mreq mreq;
    mreq.imr_multiaddr.s_addr = inet_addr(multicast_addr);
    mreq.imr_interface.s_addr = INADDR_ANY;
    setsockopt(osc->sock, IPPROTO_IP, IP_ADD_MEMBERSHIP, &mreq, sizeof(mreq));
}
```

#### 2. OSC Message Parsing

```c
int osc_parse_message(const uint8_t *buffer, size_t len, OSC_Message *msg) {
    // Read address pattern (null-terminated, 4-byte aligned)
    msg->address = (const char*)buffer;
    int addr_size = osc_string_size(msg->address);  // Rounds to 4-byte boundary

    // Read type tag string (starts with ',')
    const char *typetags = (const char*)(buffer + addr_size);
    if (typetags[0] != ',') {
        msg->argc = 0;  // No arguments
        return 0;
    }

    // Parse arguments based on type tags
    int arg_offset = addr_size + osc_string_size(typetags);
    for (int i = 1; typetags[i] != '\0'; i++) {
        switch (typetags[i]) {
            case 'i': arg->i = read_int32_bigendian(buffer + arg_offset); break;
            case 'f': arg->f = read_float32_bigendian(buffer + arg_offset); break;
            case 's': arg->s = (const char*)(buffer + arg_offset); break;
        }
    }
}
```

#### 3. Non-Blocking Receive

```c
int osc_recv_message(OSC_Receiver *osc, OSC_Message *msg) {
    ssize_t n = recvfrom(osc->sock, osc->recv_buffer,
                         sizeof(osc->recv_buffer), 0, NULL, NULL);

    if (n < 0) {
        if (errno == EAGAIN || errno == EWOULDBLOCK) {
            return 0;  // No data available
        }
        return -1;  // Error
    }

    // Parse the received message
    osc_parse_message((uint8_t*)osc->recv_buffer, n, msg);
    return 1;  // Message received
}
```

## Integration Pattern

### Step 1: Add OSC to Your Application

```c
// In your main source file
#include "osc.h"

// Global state
static OSC_Receiver osc_receiver;
static int osc_mode = 0;  // Command-line flag
```

### Step 2: Initialize in Main Loop

```c
if (osc_mode) {
    if (osc_init_receiver(&osc_receiver, "224.0.0.1", 1983) < 0) {
        fprintf(stderr, "Failed to init OSC\n");
        exit(1);
    }
    fprintf(stderr, "OSC listening on 224.0.0.1:1983\n");
}
```

### Step 3: Process Messages in Main Loop

```c
while (running) {
    // Process all available OSC messages
    OSC_Message osc_msg;
    while (osc_recv_message(&osc_receiver, &osc_msg) == 1) {
        process_osc_message(&osc_msg);
    }

    // Your application logic
    update_state(dt);
    render_frame();

    nanosleep(&frame_time, NULL);
}
```

### Step 4: Implement Message Handler

```c
static void process_osc_message(const OSC_Message *msg) {
    // Filter for mapped messages: /midi/mapped/{variant}/{semantic}
    if (strncmp(msg->address, "/midi/mapped/", 13) != 0) {
        return;
    }

    // Parse address path
    const char *path = msg->address + 13;
    char variant[32], semantic[64];
    sscanf(path, "%31[^/]/%63s", variant, semantic);

    // Get float value
    if (msg->argc < 1 || msg->args[0].type != OSC_TYPE_FLOAT) {
        return;
    }
    float value = msg->args[0].f;

    // Map semantic controls to application parameters
    if (strcmp(semantic, "gain") == 0) {
        audio_set_gain(value);
    } else if (strcmp(semantic, "speed") == 0) {
        playback_set_rate(value);
    } else if (strcmp(semantic, "mix") == 0) {
        audio_set_mix(value);
    }
    // ... add more mappings
}
```

## OSC Message Format

### MIDI Mapped Messages

Format: `/midi/mapped/{variant}/{semantic}` with float argument (0.0-1.0)

Examples from midi.js:
```
/midi/mapped/a/gain 0.75
/midi/mapped/a/speed 0.5
/midi/mapped/a/pan 0.3
/midi/mapped/b/filter 0.85
```

### Raw MIDI Messages (Optional)

Format: `/midi/raw/{type}/{channel}/{number}` with int argument (0-127)

Examples:
```
/midi/raw/cc/1/40 64
/midi/raw/note/1/60 127
```

## MIDI Mapping Configuration

### Create a Map File

File: `midi/maps/{appname}[0].json`

```json
{
  "controller": "myapp",
  "instance": 0,
  "description": "MIDI mapping for My Application",
  "default_variant": "a",
  "hardware": {
    "k1": { "type": "knob", "channel": 1, "cc": 40 },
    "k2": { "type": "knob", "channel": 1, "cc": 41 },
    "k3": { "type": "knob", "channel": 1, "cc": 42 },
    "k4": { "type": "knob", "channel": 1, "cc": 43 },
    "f1": { "type": "fader", "channel": 1, "cc": 70 },
    "f2": { "type": "fader", "channel": 1, "cc": 71 },
    "b1": { "type": "button", "channel": 1, "note": 60 }
  },
  "variants": {
    "a": {
      "name": "Main Controls",
      "mappings": {
        "k1": { "semantic": "gain", "min": 0.0, "max": 1.0 },
        "k2": { "semantic": "speed", "min": 0.0, "max": 2.0 },
        "k3": { "semantic": "pan", "min": -1.0, "max": 1.0 },
        "k4": { "semantic": "filter", "min": 20.0, "max": 20000.0 },
        "f1": { "semantic": "mix", "min": 0.0, "max": 1.0 },
        "f2": { "semantic": "feedback", "min": 0.0, "max": 0.95 }
      }
    },
    "b": {
      "name": "Effects Controls",
      "mappings": {
        "k1": { "semantic": "reverb", "min": 0.0, "max": 1.0 },
        "k2": { "semantic": "delay", "min": 0.0, "max": 1.0 }
      }
    }
  }
}
```

### Semantic Control Guidelines

**Choose meaningful semantic names:**
- Audio: `gain`, `pan`, `mix`, `volume`, `balance`
- Effects: `reverb`, `delay`, `distortion`, `filter`, `chorus`
- Playback: `speed`, `rate`, `position`, `loop_start`, `loop_end`
- Transport: `play`, `stop`, `record`, `rewind`
- Parameters: `cutoff`, `resonance`, `attack`, `decay`, `sustain`, `release`

**Value ranges:**
- **Normalized (0.0-1.0):** Most parameters, easy to work with
- **Bipolar (-1.0-1.0):** Pan, detune, offset
- **Logarithmic:** Frequencies (20-20000), time values
- **Custom ranges:** Application-specific units

## Running Your Application

### Terminal 1: Start MIDI Bridge

```bash
cd $TETRA_SRC/bash/midi
node midi.js -i "Your MIDI Controller" \
  --map maps/myapp[0].json -v
```

### Terminal 2: Start Your Application

```bash
./myapp --osc
```

### Expected Output

```
OSC listening on 224.0.0.1:1983...
OSC mode: ready! Move your MIDI controls...
```

## Troubleshooting

### "bind: Address already in use"

**Solution 1:** Kill other processes using port 1983
```bash
lsof -i UDP:1983
kill -9 <PID>
```

**Solution 2:** Ensure SO_REUSEPORT is set (see osc.c line 56-62)

**Solution 3:** Modify midi.js to NOT bind to 1983 (use `localPort: 0`)

### "No OSC messages received"

1. Check midi.js is running with `--map` option
2. Verify MIDI controller connected: `node midi.js -l`
3. Run midi.js with `-v` to see OSC output
4. Check firewall not blocking UDP 1983
5. Verify multicast routing: `netstat -rn | grep 224`

### "Messages received but not parsed"

- Check message address matches filter (e.g., `/midi/mapped/`)
- Verify argument type (usually float for mapped messages)
- Add debug logging in `process_osc_message()`

## Performance Characteristics

| Metric           | Value          | Notes                          |
|------------------|----------------|--------------------------------|
| Latency          | <5ms typical   | Depends on network stack       |
| Throughput       | ~100 msg/sec   | Typical MIDI controller rate   |
| CPU overhead     | <0.1%          | Minimal parsing cost           |
| Memory           | ~4KB per msg   | OSC_MAX_MSG_SIZE buffer        |
| Packet loss      | Rare           | UDP multicast on localhost     |

## Real-Time Audio Considerations

### For Audio Applications (like upcoming record/playback)

1. **Separate OSC from audio thread**
   ```c
   // Audio thread (high priority, RT)
   void audio_callback(float *buffer, int frames) {
       // NO OSC calls here!
       // Just read shared atomic variables
       float gain = atomic_load(&g_gain);
       process_audio(buffer, frames, gain);
   }

   // Main thread (normal priority)
   while (running) {
       OSC_Message msg;
       while (osc_recv_message(&osc_receiver, &msg) == 1) {
           // Parse and update shared atomics
           if (is_gain_control(&msg)) {
               atomic_store(&g_gain, msg.args[0].f);
           }
       }
   }
   ```

2. **Use lock-free data structures**
   - `stdatomic.h` for simple values
   - Ring buffers for event queues
   - Never block the audio thread!

3. **Smooth parameter changes**
   ```c
   // In audio thread
   float current_gain = 1.0f;
   float target_gain = 1.0f;

   void audio_callback(float *buffer, int frames) {
       // Get target from OSC (set by main thread)
       target_gain = atomic_load(&g_target_gain);

       // Smooth interpolation (avoid clicks)
       for (int i = 0; i < frames; i++) {
           current_gain += (target_gain - current_gain) * 0.01f;
           buffer[i] *= current_gain;
       }
   }
   ```

4. **Predictable parameter ranges**
   - Map 0.0-1.0 to dB: `db = 20 * log10(value)`
   - Map to frequency: `freq = min * pow(max/min, value)`
   - Clamp all inputs: `value = fmax(min, fmin(max, value))`

## Example: Audio Recorder Application

```c
// audio_recorder.c
#include "osc.h"
#include <stdatomic.h>

// Shared state (main thread ↔ audio thread)
static atomic_int_least32_t recording = ATOMIC_VAR_INIT(0);
static atomic_int_least32_t playback = ATOMIC_VAR_INIT(0);
static _Atomic float input_gain = ATOMIC_VAR_INIT(1.0f);
static _Atomic float output_gain = ATOMIC_VAR_INIT(1.0f);
static _Atomic float monitor_mix = ATOMIC_VAR_INIT(0.0f);

// OSC message handler (main thread)
static void process_osc_message(const OSC_Message *msg) {
    if (strncmp(msg->address, "/midi/mapped/a/", 15) != 0) return;

    const char *semantic = msg->address + 15;
    float value = msg->args[0].f;

    if (strcmp(semantic, "record") == 0) {
        atomic_store(&recording, value > 0.5f ? 1 : 0);
    } else if (strcmp(semantic, "play") == 0) {
        atomic_store(&playback, value > 0.5f ? 1 : 0);
    } else if (strcmp(semantic, "input_gain") == 0) {
        atomic_store(&input_gain, value);
    } else if (strcmp(semantic, "output_gain") == 0) {
        atomic_store(&output_gain, value);
    } else if (strcmp(semantic, "monitor_mix") == 0) {
        atomic_store(&monitor_mix, value);
    }
}

// Audio callback (audio thread - REALTIME!)
void audio_callback(const float *input, float *output, int frames) {
    int is_recording = atomic_load(&recording);
    int is_playing = atomic_load(&playback);
    float in_gain = atomic_load(&input_gain);
    float out_gain = atomic_load(&output_gain);
    float mix = atomic_load(&monitor_mix);

    for (int i = 0; i < frames; i++) {
        float in_sample = input[i] * in_gain;

        if (is_recording) {
            write_to_buffer(in_sample);
        }

        float out_sample = 0.0f;
        if (is_playing) {
            out_sample = read_from_buffer();
        }

        // Monitor mix: 0=playback only, 1=input only
        output[i] = (out_sample * (1.0f - mix) + in_sample * mix) * out_gain;
    }
}

// Main loop (main thread)
int main(int argc, char **argv) {
    OSC_Receiver osc;
    osc_init_receiver(&osc, "224.0.0.1", 1983);

    start_audio_engine(audio_callback);

    while (running) {
        OSC_Message msg;
        while (osc_recv_message(&osc, &msg) == 1) {
            process_osc_message(&msg);
        }
        usleep(1000);  // 1ms sleep, not critical
    }

    stop_audio_engine();
    osc_close_receiver(&osc);
}
```

## Compilation

### Makefile Integration

```makefile
# Add to SOURCES
SOURCES = myapp.c osc.c

# Add to HEADERS
HEADERS = myapp.h osc.h

# Compile
$(TARGET): $(OBJECTS)
	$(CC) -o $@ $^ -lm
```

### Manual Compilation

```bash
cc -O3 -std=c99 -Wall -c osc.c -o osc.o
cc -O3 -std=c99 -Wall -c myapp.c -o myapp.o
cc -o myapp myapp.o osc.o -lm
```

## OSC Protocol Subset

### Supported Types

- `i` - int32 (big-endian)
- `f` - float32 (big-endian, IEEE 754)
- `s` - string (null-terminated, 4-byte aligned)

### NOT Supported (for simplicity)

- `b` - blob
- `t` - timetag
- `d` - double
- `T/F` - true/false
- `N` - nil
- Bundles (timestamp + multiple messages)

### Why This Subset?

- **Covers 99% of MIDI use cases** - CC values as floats, semantics as strings
- **Simple parsing** - No complex nesting or variable-length data
- **Fast** - Minimal branching, predictable memory access
- **Portable** - Works on any platform with sockets

## Next Steps

1. **Copy `osc.h` and `osc.c`** to your project
2. **Create MIDI map** in `midi/maps/yourapp[0].json`
3. **Integrate OSC receiver** into main loop
4. **Implement `process_osc_message()`** handler
5. **Test with midi.js** using `-v` verbose mode
6. **Add semantic controls** as needed

## References

- OSC 1.0 Spec: http://opensoundcontrol.org/spec-1_0
- Pulsar implementation: `game/engine/src/pulsar.c` (line 777+)
- MIDI bridge: `midi/midi.js` (full mapping support)

## License

This OSC implementation is part of the Tetra framework.
Use freely for any purpose.

---

**Date:** 2025-11-09
**Version:** 1.0
**Author:** Tetra Development Team

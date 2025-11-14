# C OSC Listener Example for MIDI Multicast

This document shows how to integrate OSC listening into a C application (like tau-audio-engine) to receive MIDI events from the midi-1983 broadcast system.

## Library: liblo (Lightweight OSC)

liblo is a simple, robust OSC library for C/C++.

### Installation

```bash
# macOS
brew install liblo

# Linux (Debian/Ubuntu)
sudo apt-get install liblo-dev

# From source
git clone https://github.com/radarsat1/liblo.git
cd liblo
./autogen.sh
./configure
make
sudo make install
```

## Complete Example: `midi_osc_listener.c`

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>
#include <unistd.h>
#include <lo/lo.h>

// MIDI multicast configuration
#define MIDI_MULTICAST_ADDR "239.1.1.1"
#define MIDI_OSC_PORT       "1983"

// Global server instance for cleanup
static lo_server_thread server_thread = NULL;
static int keep_running = 1;

// Signal handler for clean shutdown
void signal_handler(int sig) {
    printf("\nShutting down...\n");
    keep_running = 0;
}

//=============================================================================
// OSC MESSAGE HANDLERS
//=============================================================================

// Handler for raw MIDI CC messages: /midi/raw/cc/{channel}/{controller}
int handle_raw_cc(const char *path, const char *types, lo_arg **argv,
                  int argc, lo_message msg, void *user_data)
{
    // Path format: /midi/raw/cc/1/40
    // Extract channel and controller from path
    int channel, controller;
    if (sscanf(path, "/midi/raw/cc/%d/%d", &channel, &controller) == 2) {
        int value = argv[0]->i;  // MIDI value (0-127)

        printf("Raw MIDI CC: channel=%d controller=%d value=%d\n",
               channel, controller, value);

        // YOUR CODE HERE: Process raw MIDI CC
        // Example: Update audio engine parameter based on CC number

        return 0;  // Success
    }
    return 1;  // Parse failed
}

// Handler for raw MIDI note messages: /midi/raw/note/{channel}/{note}
int handle_raw_note(const char *path, const char *types, lo_arg **argv,
                    int argc, lo_message msg, void *user_data)
{
    int channel, note;
    if (sscanf(path, "/midi/raw/note/%d/%d", &channel, &note) == 2) {
        int velocity = argv[0]->i;  // 0-127, 0 = note off

        printf("Raw MIDI Note: channel=%d note=%d velocity=%d %s\n",
               channel, note, velocity, velocity > 0 ? "ON" : "OFF");

        // YOUR CODE HERE: Trigger note events

        return 0;
    }
    return 1;
}

// Handler for semantic (mapped) values: /midi/mapped/{variant}/{semantic}
int handle_mapped(const char *path, const char *types, lo_arg **argv,
                  int argc, lo_message msg, void *user_data)
{
    // Path format: /midi/mapped/a/VOLUME_1
    // Extract variant and semantic name
    char variant[8], semantic[64];
    if (sscanf(path, "/midi/mapped/%[^/]/%s", variant, semantic) == 2) {
        float value = argv[0]->f;  // Normalized value (usually 0.0-1.0)

        printf("Mapped MIDI: variant=%s semantic=%s value=%.6f\n",
               variant, semantic, value);

        // YOUR CODE HERE: Map semantic names to audio parameters
        // Example:
        if (strcmp(semantic, "FILTER_CUTOFF") == 0) {
            // tau_set_filter_cutoff(value);
        } else if (strcmp(semantic, "ENVELOPE_ATTACK") == 0) {
            // tau_set_envelope_attack(value);
        }
        // ... etc

        return 0;
    }
    return 1;
}

// Handler for MIDI state updates: /midi/state/{key}
int handle_state(const char *path, const char *types, lo_arg **argv,
                 int argc, lo_message msg, void *user_data)
{
    // Path format: /midi/state/controller, /midi/state/variant, etc.
    const char *key = strrchr(path, '/') + 1;  // Extract last path component

    if (types[0] == 's') {
        // String value
        const char *value = &argv[0]->s;
        printf("State update: %s=%s\n", key, value);
    } else if (types[0] == 'i') {
        // Integer value
        int value = argv[0]->i;
        printf("State update: %s=%d\n", key, value);
    } else if (types[0] == 'f') {
        // Float value
        float value = argv[0]->f;
        printf("State update: %s=%.6f\n", key, value);
    }

    return 0;
}

// Generic error handler
void error_handler(int num, const char *msg, const char *path)
{
    fprintf(stderr, "OSC Error %d in path %s: %s\n", num, path, msg);
}

//=============================================================================
// MAIN
//=============================================================================

int main(int argc, char *argv[])
{
    // Install signal handlers for clean shutdown
    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);

    printf("MIDI OSC Listener for C\n");
    printf("=======================\n");
    printf("Listening on: %s:%s\n\n", MIDI_MULTICAST_ADDR, MIDI_OSC_PORT);

    // Create OSC server for multicast
    // Note: Use lo_server_thread for automatic message handling
    server_thread = lo_server_thread_new_multicast(MIDI_MULTICAST_ADDR,
                                                     MIDI_OSC_PORT,
                                                     error_handler);

    if (!server_thread) {
        fprintf(stderr, "Failed to create OSC server\n");
        return 1;
    }

    // Get the server instance
    lo_server server = lo_server_thread_get_server(server_thread);

    // Register OSC method handlers
    // NULL = match any path matching the pattern
    lo_server_add_method(server, "/midi/raw/cc/*/*", "i", handle_raw_cc, NULL);
    lo_server_add_method(server, "/midi/raw/note/*/*", "i", handle_raw_note, NULL);
    lo_server_add_method(server, "/midi/mapped/*/*", "f", handle_mapped, NULL);
    lo_server_add_method(server, "/midi/state/*", NULL, handle_state, NULL);

    // Start the server thread
    lo_server_thread_start(server_thread);

    printf("OSC server started. Waiting for MIDI events...\n");
    printf("Press Ctrl+C to exit.\n\n");

    // Main loop - keep running until signal
    while (keep_running) {
        usleep(100000);  // Sleep 100ms
    }

    // Cleanup
    printf("Stopping OSC server...\n");
    lo_server_thread_stop(server_thread);
    lo_server_thread_free(server_thread);

    printf("Goodbye!\n");
    return 0;
}
```

## Compilation

### Simple Makefile

```makefile
CC = gcc
CFLAGS = -Wall -O2 $(shell pkg-config --cflags liblo)
LDFLAGS = $(shell pkg-config --libs liblo)

midi_osc_listener: midi_osc_listener.c
	$(CC) $(CFLAGS) -o $@ $< $(LDFLAGS)

clean:
	rm -f midi_osc_listener
```

### Compile and Run

```bash
# Using Makefile
make

# Or directly
gcc -Wall -O2 $(pkg-config --cflags liblo) \
    -o midi_osc_listener midi_osc_listener.c \
    $(pkg-config --libs liblo)

# Run
./midi_osc_listener
```

## Integration with tau-audio-engine

### Option 1: Separate Thread

```c
// In tau-audio-engine initialization
pthread_t osc_thread;

void* osc_listener_thread(void* arg) {
    // Create and start OSC server (code from above)
    // ...
    return NULL;
}

// Start OSC listener in background
pthread_create(&osc_thread, NULL, osc_listener_thread, NULL);
```

### Option 2: Poll in Main Loop

```c
// Create server in non-threaded mode
lo_server server = lo_server_new_multicast(MIDI_MULTICAST_ADDR,
                                           MIDI_OSC_PORT,
                                           error_handler);

// In your main audio processing loop
while (audio_engine_running) {
    // Process audio...

    // Poll for OSC messages (non-blocking)
    while (lo_server_recv_noblock(server, 0) > 0) {
        // Messages are dispatched to handlers
    }

    // Continue...
}
```

### Option 3: Integrate with Event Loop

If tau-audio-engine uses an event loop (like libuv, libevent, or select/poll):

```c
// Get the OSC server socket file descriptor
int osc_fd = lo_server_get_socket_fd(server);

// Add to your event loop (pseudo-code)
event_loop_add_fd(osc_fd, EVENT_READ, [](int fd) {
    lo_server_recv_noblock(server, 0);
});
```

## Mapping MIDI to Audio Parameters

```c
// Example: Map semantic names to tau parameters
void handle_midi_control(const char *semantic, float value) {
    // Look up parameter by name
    if (strcmp(semantic, "FILTER_CUTOFF") == 0) {
        tau_set_filter_cutoff(value * 20000.0f);  // Scale 0-1 to 0-20kHz
    }
    else if (strcmp(semantic, "RESONANCE") == 0) {
        tau_set_filter_resonance(value);  // Already 0-1
    }
    else if (strcmp(semantic, "ENVELOPE_ATTACK") == 0) {
        tau_set_envelope_attack(value * 2.0f);  // 0-2 seconds
    }
    else if (strcmp(semantic, "ENVELOPE_RELEASE") == 0) {
        tau_set_envelope_release(value * 3.0f);  // 0-3 seconds
    }
    else if (strcmp(semantic, "MASTER_VOLUME") == 0) {
        tau_set_master_volume(value);
    }
    // Add more mappings as needed
}
```

## Running with TSM

To run as a TSM-managed service:

```bash
# Register with TSM
tsm register tau-audio-engine /path/to/tau-audio-engine --name tau-audio --port auto

# Start
tsm start tau-audio

# View logs (including OSC messages)
tsm logs tau-audio -f
```

## Testing

```bash
# Terminal 1: Start listener
./midi_osc_listener

# Terminal 2: Send test messages
osc_send_raw.sh /midi/mapped/a/FILTER_CUTOFF 0.5
osc_send_raw.sh /midi/raw/cc/1/40 64
```

## Advanced: Custom OSC Addresses

You can also define tau-specific OSC addresses and send them from the REPL:

```bash
# In REPL
osc /tau/filter/cutoff 0.5
osc /tau/envelope/attack 0.1
osc /tau/trigger note
```

Then in your C code:

```c
lo_server_add_method(server, "/tau/filter/cutoff", "f", handle_tau_filter, NULL);
lo_server_add_method(server, "/tau/envelope/*", "f", handle_tau_envelope, NULL);
lo_server_add_method(server, "/tau/trigger", "s", handle_tau_trigger, NULL);
```

## Performance Considerations

- **liblo is non-blocking** - OSC message handling won't block audio processing
- **Low latency** - UDP multicast has minimal overhead
- **Thread-safe** - Use mutexes if accessing shared state from OSC and audio threads
- **Consider priority** - Audio thread should have higher priority than OSC thread

## Troubleshooting

### Not receiving messages

1. Check firewall allows multicast UDP on port 1983
2. Verify MIDI service is running: `tsm status midi-1983`
3. Test with `osc_repl_listener.js` to confirm broadcasts working
4. Use `tcpdump` to inspect packets:
   ```bash
   sudo tcpdump -i any -A dst 239.1.1.1 and port 1983
   ```

### Messages arriving out of order

This is normal with UDP. If order matters, use sequence numbers in your protocol or switch to TCP.

## Resources

- [liblo documentation](http://liblo.sourceforge.net/)
- [OSC specification](http://opensoundcontrol.org/spec-1_0)
- [Example liblo programs](https://github.com/radarsat1/liblo/tree/master/examples)

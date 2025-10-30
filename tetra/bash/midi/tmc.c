/*
 * TMC - Tetra MIDI Controller Bridge
 *
 * Bidirectional MIDI I/O using PortMIDI
 * - Reads MIDI input -> writes to Unix socket (for TMC mapper)
 * - Reads from Unix socket -> sends MIDI output (for LED/color control)
 *
 * Compile: gcc -o tmc tmc.c -lportmidi -lpthread
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <pthread.h>
#include <portmidi.h>
#include <sys/socket.h>
#include <sys/un.h>

#define BUFFER_SIZE 1024
#define MIDI_BUFFER_SIZE 256

// Global state
static volatile int running = 1;
static PmStream *midi_in = NULL;
static PmStream *midi_out = NULL;
static int socket_fd = -1;

// Configuration
typedef struct {
    int input_device_id;
    int output_device_id;
    char socket_path[256];
    int verbose;
} tmc_config_t;

static tmc_config_t config = {
    .input_device_id = -1,
    .output_device_id = -1,
    .socket_path = "",
    .verbose = 0
};

// Signal handler for clean shutdown
void signal_handler(int sig) {
    running = 0;
}

// List available MIDI devices
void list_midi_devices() {
    int num_devices = Pm_CountDevices();
    const PmDeviceInfo *info;

    printf("Available MIDI Devices:\n");
    printf("========================\n\n");

    printf("Input Devices:\n");
    for (int i = 0; i < num_devices; i++) {
        info = Pm_GetDeviceInfo(i);
        if (info->input) {
            printf("  [%d] %s - %s\n", i, info->name, info->interf);
        }
    }

    printf("\nOutput Devices:\n");
    for (int i = 0; i < num_devices; i++) {
        info = Pm_GetDeviceInfo(i);
        if (info->output) {
            printf("  [%d] %s - %s\n", i, info->name, info->interf);
        }
    }
    printf("\n");
}

// Initialize PortMIDI and open devices
int init_midi() {
    PmError err;

    err = Pm_Initialize();
    if (err != pmNoError) {
        fprintf(stderr, "ERROR: Failed to initialize PortMIDI: %s\n",
                Pm_GetErrorText(err));
        return -1;
    }

    // Auto-detect default devices if not specified
    if (config.input_device_id < 0) {
        config.input_device_id = Pm_GetDefaultInputDeviceID();
    }
    if (config.output_device_id < 0) {
        config.output_device_id = Pm_GetDefaultOutputDeviceID();
    }

    // Open input device
    if (config.input_device_id >= 0) {
        err = Pm_OpenInput(&midi_in, config.input_device_id, NULL,
                          MIDI_BUFFER_SIZE, NULL, NULL);
        if (err != pmNoError) {
            fprintf(stderr, "ERROR: Failed to open MIDI input %d: %s\n",
                    config.input_device_id, Pm_GetErrorText(err));
            return -1;
        }

        const PmDeviceInfo *info = Pm_GetDeviceInfo(config.input_device_id);
        if (config.verbose) {
            printf("Opened MIDI input: %s\n", info->name);
        }
    }

    // Open output device
    if (config.output_device_id >= 0) {
        err = Pm_OpenOutput(&midi_out, config.output_device_id, NULL,
                           MIDI_BUFFER_SIZE, NULL, NULL, 0);
        if (err != pmNoError) {
            fprintf(stderr, "ERROR: Failed to open MIDI output %d: %s\n",
                    config.output_device_id, Pm_GetErrorText(err));
            return -1;
        }

        const PmDeviceInfo *info = Pm_GetDeviceInfo(config.output_device_id);
        if (config.verbose) {
            printf("Opened MIDI output: %s\n", info->name);
        }
    }

    return 0;
}

// Connect to Unix socket
int connect_socket() {
    struct sockaddr_un addr;

    socket_fd = socket(AF_UNIX, SOCK_STREAM, 0);
    if (socket_fd < 0) {
        perror("socket");
        return -1;
    }

    memset(&addr, 0, sizeof(addr));
    addr.sun_family = AF_UNIX;
    strncpy(addr.sun_path, config.socket_path, sizeof(addr.sun_path) - 1);

    if (connect(socket_fd, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
        perror("connect");
        close(socket_fd);
        socket_fd = -1;
        return -1;
    }

    if (config.verbose) {
        printf("Connected to socket: %s\n", config.socket_path);
    }

    return 0;
}

// Parse MIDI message and format for socket
void format_midi_message(PmMessage msg, char *buffer, size_t size) {
    int status = Pm_MessageStatus(msg);
    int data1 = Pm_MessageData1(msg);
    int data2 = Pm_MessageData2(msg);

    int msg_type = status & 0xF0;
    int channel = (status & 0x0F) + 1;  // 1-indexed for human readability

    switch (msg_type) {
        case 0x80:  // Note Off
            snprintf(buffer, size, "NOTE_OFF %d %d\n", channel, data1);
            break;
        case 0x90:  // Note On
            if (data2 == 0) {
                snprintf(buffer, size, "NOTE_OFF %d %d\n", channel, data1);
            } else {
                snprintf(buffer, size, "NOTE_ON %d %d %d\n", channel, data1, data2);
            }
            break;
        case 0xB0:  // Control Change
            snprintf(buffer, size, "CC %d %d %d\n", channel, data1, data2);
            break;
        case 0xC0:  // Program Change
            snprintf(buffer, size, "PROGRAM_CHANGE %d %d\n", channel, data1);
            break;
        case 0xE0:  // Pitch Bend
            {
                int bend = (data2 << 7) | data1;
                snprintf(buffer, size, "PITCH_BEND %d %d\n", channel, bend);
            }
            break;
        default:
            snprintf(buffer, size, "UNKNOWN 0x%02X %d %d\n", status, data1, data2);
            break;
    }
}

// Thread: Read from MIDI input and write to socket
void* midi_input_thread(void *arg) {
    PmEvent buffer[MIDI_BUFFER_SIZE];
    char msg_buffer[256];

    while (running && midi_in) {
        int count = Pm_Read(midi_in, buffer, MIDI_BUFFER_SIZE);

        if (count > 0) {
            for (int i = 0; i < count; i++) {
                format_midi_message(buffer[i].message, msg_buffer, sizeof(msg_buffer));

                if (config.verbose) {
                    printf("MIDI IN: %s", msg_buffer);
                }

                // Send to socket if connected
                if (socket_fd >= 0) {
                    if (write(socket_fd, msg_buffer, strlen(msg_buffer)) < 0) {
                        perror("write to socket");
                        running = 0;
                        break;
                    }
                }
            }
        } else if (count < 0) {
            fprintf(stderr, "ERROR: MIDI read error: %s\n",
                    Pm_GetErrorText((PmError)count));
            break;
        }

        usleep(1000);  // 1ms sleep to reduce CPU usage
    }

    return NULL;
}

// Parse socket command and send MIDI output
// Format: "CC channel controller value" or "NOTE_ON channel note velocity"
void send_midi_from_socket(const char *line) {
    char cmd[32];
    int args[4];
    int n = sscanf(line, "%31s %d %d %d %d", cmd, &args[0], &args[1], &args[2], &args[3]);

    if (n < 2 || !midi_out) {
        return;
    }

    PmMessage msg = 0;
    int channel = args[0] - 1;  // Convert to 0-indexed

    if (strcmp(cmd, "CC") == 0 && n >= 4) {
        msg = Pm_Message(0xB0 | (channel & 0x0F), args[1] & 0x7F, args[2] & 0x7F);
    } else if (strcmp(cmd, "NOTE_ON") == 0 && n >= 4) {
        msg = Pm_Message(0x90 | (channel & 0x0F), args[1] & 0x7F, args[2] & 0x7F);
    } else if (strcmp(cmd, "NOTE_OFF") == 0 && n >= 3) {
        msg = Pm_Message(0x80 | (channel & 0x0F), args[1] & 0x7F, 0);
    } else if (strcmp(cmd, "PROGRAM_CHANGE") == 0 && n >= 3) {
        msg = Pm_Message(0xC0 | (channel & 0x0F), args[1] & 0x7F, 0);
    }

    if (msg != 0) {
        PmError err = Pm_WriteShort(midi_out, 0, msg);
        if (err != pmNoError) {
            fprintf(stderr, "ERROR: MIDI write error: %s\n", Pm_GetErrorText(err));
        } else if (config.verbose) {
            printf("MIDI OUT: %s", line);
        }
    }
}

// Thread: Read from socket and write to MIDI output
void* socket_input_thread(void *arg) {
    char buffer[BUFFER_SIZE];
    char line_buffer[BUFFER_SIZE];
    int line_pos = 0;

    while (running && socket_fd >= 0) {
        ssize_t n = read(socket_fd, buffer, sizeof(buffer) - 1);

        if (n > 0) {
            buffer[n] = '\0';

            // Process line by line
            for (int i = 0; i < n; i++) {
                if (buffer[i] == '\n') {
                    line_buffer[line_pos] = '\0';
                    send_midi_from_socket(line_buffer);
                    line_pos = 0;
                } else if (line_pos < sizeof(line_buffer) - 1) {
                    line_buffer[line_pos++] = buffer[i];
                }
            }
        } else if (n == 0) {
            // Socket closed
            break;
        } else {
            perror("read from socket");
            break;
        }
    }

    return NULL;
}

// Cleanup
void cleanup() {
    running = 0;

    if (midi_in) {
        Pm_Close(midi_in);
        midi_in = NULL;
    }

    if (midi_out) {
        Pm_Close(midi_out);
        midi_out = NULL;
    }

    Pm_Terminate();

    if (socket_fd >= 0) {
        close(socket_fd);
        socket_fd = -1;
    }
}

void print_usage(const char *prog) {
    printf("Usage: %s [OPTIONS]\n\n", prog);
    printf("Options:\n");
    printf("  -l              List available MIDI devices and exit\n");
    printf("  -i DEVICE_ID    MIDI input device ID\n");
    printf("  -o DEVICE_ID    MIDI output device ID\n");
    printf("  -s SOCKET_PATH  Unix socket path for TMC communication\n");
    printf("  -v              Verbose output\n");
    printf("  -h              Show this help\n\n");
    printf("Example:\n");
    printf("  %s -i 0 -o 0 -s /tmp/tmc.sock -v\n\n", prog);
}

int main(int argc, char *argv[]) {
    int opt;
    int list_devices_only = 0;

    // Parse command line arguments
    while ((opt = getopt(argc, argv, "li:o:s:vh")) != -1) {
        switch (opt) {
            case 'l':
                list_devices_only = 1;
                break;
            case 'i':
                config.input_device_id = atoi(optarg);
                break;
            case 'o':
                config.output_device_id = atoi(optarg);
                break;
            case 's':
                strncpy(config.socket_path, optarg, sizeof(config.socket_path) - 1);
                break;
            case 'v':
                config.verbose = 1;
                break;
            case 'h':
            default:
                print_usage(argv[0]);
                return (opt == 'h') ? 0 : 1;
        }
    }

    // Initialize PortMIDI
    if (Pm_Initialize() != pmNoError) {
        fprintf(stderr, "ERROR: Failed to initialize PortMIDI\n");
        return 1;
    }

    // List devices if requested
    if (list_devices_only) {
        list_midi_devices();
        Pm_Terminate();
        return 0;
    }

    // Validate configuration
    if (strlen(config.socket_path) == 0) {
        fprintf(stderr, "ERROR: Socket path required (-s option)\n");
        print_usage(argv[0]);
        Pm_Terminate();
        return 1;
    }

    // Setup signal handlers
    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);

    // Initialize MIDI
    if (init_midi() < 0) {
        cleanup();
        return 1;
    }

    // Connect to socket
    if (connect_socket() < 0) {
        fprintf(stderr, "ERROR: Failed to connect to socket: %s\n", config.socket_path);
        cleanup();
        return 1;
    }

    printf("TMC Bridge running (Ctrl+C to stop)\n");

    // Start threads
    pthread_t midi_thread, socket_thread;

    if (midi_in) {
        pthread_create(&midi_thread, NULL, midi_input_thread, NULL);
    }

    if (midi_out) {
        pthread_create(&socket_thread, NULL, socket_input_thread, NULL);
    }

    // Wait for shutdown signal
    while (running) {
        sleep(1);
    }

    printf("\nShutting down...\n");

    // Wait for threads to finish
    if (midi_in) {
        pthread_join(midi_thread, NULL);
    }
    if (midi_out) {
        pthread_join(socket_thread, NULL);
    }

    cleanup();

    return 0;
}

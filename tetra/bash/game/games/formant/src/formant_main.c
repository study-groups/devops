/**
 * formant_main.c
 *
 * Main entry point for formant synthesis engine.
 * Handles command-line arguments, IPC setup, and main loop.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <getopt.h>
#include "formant.h"

/* Global engine instance (for signal handler) */
static formant_engine_t* g_engine = NULL;
static volatile bool g_running = true;

/* Signal handler for clean shutdown */
static void signal_handler(int sig) {
    (void)sig;
    fprintf(stderr, "\nShutting down formant engine...\n");
    g_running = false;
}

/* Print usage information */
static void print_usage(const char* program_name) {
    printf("Formant Synthesis Engine v%d.%d.%d\n\n",
           FORMANT_VERSION_MAJOR,
           FORMANT_VERSION_MINOR,
           FORMANT_VERSION_PATCH);
    printf("Usage: %s [options]\n\n", program_name);
    printf("Options:\n");
    printf("  -i, --input FILE      Input command file or FIFO (default: stdin)\n");
    printf("  -s, --sample-rate HZ  Sample rate: 48000, 44100, 24000, 16000 (default: 48000)\n");
    printf("  -b, --buffer-size N   Buffer size in samples (default: 512)\n");
    printf("  -h, --help            Show this help message\n");
    printf("  -v, --version         Show version information\n");
    printf("\n");
    printf("Examples:\n");
    printf("  %s                           # Read from stdin\n", program_name);
    printf("  %s -i /tmp/estovox_fifo      # Read from named pipe\n", program_name);
    printf("  %s -s 24000 -b 256           # Low latency mode\n", program_name);
    printf("\n");
    printf("Estovox Command Language:\n");
    printf("  PH <ipa> [dur] [pitch] [intensity] [rate]   - Synthesize phoneme\n");
    printf("  FM <f1> <f2> <f3> [bw1] [bw2] [bw3] [dur]   - Set formants directly\n");
    printf("  PR <param> <value>                          - Set prosody parameter\n");
    printf("  EM <emotion> [intensity]                    - Set emotion\n");
    printf("  RESET                                       - Reset to neutral\n");
    printf("  STOP                                        - Stop engine\n");
    printf("\n");
}

/* Print version information */
static void print_version(void) {
    printf("Formant Synthesis Engine v%d.%d.%d\n",
           FORMANT_VERSION_MAJOR,
           FORMANT_VERSION_MINOR,
           FORMANT_VERSION_PATCH);
    printf("Real-time granular synthesis with vocal tract modeling\n");
    printf("Target latency: < 20ms\n");
    printf("\n");
}

/* Process command line from input */
static void process_command_line(formant_engine_t* engine, const char* line) {
    /* Skip empty lines and comments */
    if (line[0] == '\0' || line[0] == '#' || line[0] == '\n') {
        return;
    }

    /* Parse and queue command */
    formant_command_t* cmd = formant_parse_command(line);
    if (cmd) {
        formant_queue_command(engine, cmd);
        free(cmd);
    } else {
        fprintf(stderr, "ERROR: Failed to parse command: %s", line);
    }
}

/* Main function */
int main(int argc, char** argv) {
    const char* input_file = NULL;
    float sample_rate = FORMANT_SAMPLE_RATE_DEFAULT;
    int buffer_size = FORMANT_BUFFER_SIZE_DEFAULT;

    /* Parse command-line arguments */
    bool enable_diagnostics = false;

    static struct option long_options[] = {
        {"input",       required_argument, 0, 'i'},
        {"sample-rate", required_argument, 0, 's'},
        {"buffer-size", required_argument, 0, 'b'},
        {"diag",        no_argument,       0, 'd'},
        {"help",        no_argument,       0, 'h'},
        {"version",     no_argument,       0, 'v'},
        {0, 0, 0, 0}
    };

    int opt;
    int option_index = 0;

    while ((opt = getopt_long(argc, argv, "i:s:b:dhv", long_options, &option_index)) != -1) {
        switch (opt) {
            case 'i':
                input_file = optarg;
                break;
            case 's':
                sample_rate = atof(optarg);
                if (sample_rate != 48000.0f && sample_rate != 44100.0f &&
                    sample_rate != 24000.0f && sample_rate != 16000.0f) {
                    fprintf(stderr, "ERROR: Invalid sample rate. Use 48000, 44100, 24000, or 16000\n");
                    return 1;
                }
                break;
            case 'b':
                buffer_size = atoi(optarg);
                if (buffer_size < 64 || buffer_size > 4096) {
                    fprintf(stderr, "ERROR: Buffer size must be between 64 and 4096\n");
                    return 1;
                }
                break;
            case 'd':
                enable_diagnostics = true;
                break;
            case 'h':
                print_usage(argv[0]);
                return 0;
            case 'v':
                print_version();
                return 0;
            default:
                print_usage(argv[0]);
                return 1;
        }
    }

    /* Setup signal handlers */
    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);

    /* Create and initialize engine */
    fprintf(stderr, "Initializing formant engine (%.0f Hz, %d samples)...\n",
            sample_rate, buffer_size);

    g_engine = formant_engine_create(sample_rate);
    if (!g_engine) {
        fprintf(stderr, "ERROR: Failed to create formant engine\n");
        return 1;
    }

    g_engine->enable_diagnostics = enable_diagnostics;
    if (enable_diagnostics) {
        fprintf(stderr, "Diagnostics enabled - RMS stats will print every second\n");
        formant_diagnostics_reset_rms();
    }

    /* Start audio engine */
    if (formant_engine_start(g_engine) != 0) {
        fprintf(stderr, "ERROR: Failed to start audio engine\n");
        formant_engine_destroy(g_engine);
        return 1;
    }

    fprintf(stderr, "Formant engine running. Reading commands from %s\n",
            input_file ? input_file : "stdin");
    fprintf(stderr, "Latency: ~%.1f ms\n",
            (buffer_size * 1000.0f) / sample_rate);

    /* Open input stream */
    FILE* input = stdin;
    if (input_file) {
        input = fopen(input_file, "r");
        if (!input) {
            fprintf(stderr, "ERROR: Failed to open input file: %s\n", input_file);
            formant_engine_stop(g_engine);
            formant_engine_destroy(g_engine);
            return 1;
        }
    }

    /* Main command processing loop */
    char line[1024];
    while (g_running && fgets(line, sizeof(line), input)) {
        process_command_line(g_engine, line);

        /* Check for STOP command */
        if (strncmp(line, "STOP", 4) == 0) {
            fprintf(stderr, "STOP command received\n");
            break;
        }
    }

    /* Cleanup */
    if (input != stdin) {
        fclose(input);
    }

    fprintf(stderr, "Stopping formant engine...\n");
    formant_engine_stop(g_engine);
    formant_engine_destroy(g_engine);

    fprintf(stderr, "Formant engine shutdown complete\n");
    return 0;
}

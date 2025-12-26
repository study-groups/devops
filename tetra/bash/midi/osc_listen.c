/*
 * osc_listen.c - Minimal OSC Multicast Listener
 *
 * Replaces osc_repl_listener.js with zero dependencies.
 * Listens on UDP multicast and outputs __STATE__ and __EVENT__ lines
 * for consumption by bash REPLs.
 *
 * Build:
 *   cc -O2 -o osc_listen osc_listen.c
 *
 * Usage:
 *   ./osc_listen [-p PORT] [-m MULTICAST_ADDR] [-v]
 *
 * Output Format:
 *   __STATE__ controller=vmx8 instance=0 variant=a last_cc=7 last_val=64
 *   __EVENT__ 42 15 1234 raw CC 1 7 64
 *   __EVENT__ 43 12 1246 mapped a volume 0.503937
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include <time.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <netinet/in.h>
#include <arpa/inet.h>

#define DEFAULT_PORT 1983
#define DEFAULT_MULTICAST "239.1.1.1"
#define BUFFER_SIZE 2048
#define MAX_STATE_LEN 1024

/* State tracking */
typedef struct {
    char controller[64];
    int instance;
    char variant[16];
    char variant_name[64];
    int last_cc;
    int last_val;
    char last_semantic[64];
    double last_semantic_val;
    char input_device[128];
    char output_device[128];
} OscState;

/* Timing */
static long event_id = 0;
static struct timeval start_time;
static struct timeval last_event_time;

/* Verbose flag */
static int verbose = 0;

/* Get milliseconds since epoch */
static long get_ms(struct timeval *tv) {
    return tv->tv_sec * 1000 + tv->tv_usec / 1000;
}

/* Get current time in ms (reserved for future use) */
/*
static long now_ms(void) {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return get_ms(&tv);
}
*/

/* Output state line */
static void output_state(OscState *state) {
    printf("__STATE__ controller=%s instance=%d variant=%s variant_name=%s "
           "last_cc=%d last_val=%d last_semantic=%s last_semantic_val=%.6f "
           "input_device=%s output_device=%s\n",
           state->controller, state->instance, state->variant, state->variant_name,
           state->last_cc, state->last_val, state->last_semantic, state->last_semantic_val,
           state->input_device, state->output_device);
    fflush(stdout);
}

/* OSC type tag parsing */
static int osc_read_int32(const unsigned char *buf) {
    return (buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3];
}

static float osc_read_float32(const unsigned char *buf) {
    union { float f; unsigned int i; } u;
    u.i = osc_read_int32(buf);
    return u.f;
}

/* Skip to 4-byte boundary */
static int osc_pad4(int n) {
    return (n + 3) & ~3;
}

/* Parse OSC string (null-terminated, padded to 4 bytes) */
static int osc_read_string(const unsigned char *buf, int buflen, char *out, int outlen) {
    int len = 0;
    while (len < buflen && len < outlen - 1 && buf[len] != '\0') {
        out[len] = buf[len];
        len++;
    }
    out[len] = '\0';
    return osc_pad4(len + 1);  /* include null, pad to 4 */
}

/* Parse OSC message */
static void parse_osc_message(const unsigned char *buf, int len, OscState *state) {
    char address[256];
    char typetag[64];
    int pos = 0;

    /* Read address pattern */
    pos += osc_read_string(buf + pos, len - pos, address, sizeof(address));
    if (pos >= len) return;

    /* Read type tag string (starts with ',') */
    pos += osc_read_string(buf + pos, len - pos, typetag, sizeof(typetag));
    if (typetag[0] != ',') return;

    /* Parse address: /midi/category/... */
    char *parts[8];
    int nparts = 0;
    char addr_copy[256];
    strncpy(addr_copy, address, sizeof(addr_copy) - 1);
    addr_copy[sizeof(addr_copy) - 1] = '\0';

    char *tok = strtok(addr_copy, "/");
    while (tok && nparts < 8) {
        parts[nparts++] = tok;
        tok = strtok(NULL, "/");
    }

    if (nparts < 2 || strcmp(parts[0], "midi") != 0) return;

    /* Calculate timing */
    struct timeval now_tv;
    gettimeofday(&now_tv, NULL);
    long now = get_ms(&now_tv);
    long delta = now - get_ms(&last_event_time);
    long elapsed = now - get_ms(&start_time);
    last_event_time = now_tv;
    event_id++;

    const char *category = parts[1];

    /* Parse arguments based on type tags */
    int arg_pos = pos;
    int tag_idx = 1;  /* skip ',' */

    if (strcmp(category, "state") == 0 && nparts >= 3) {
        /* /midi/state/{key} {value} */
        const char *key = parts[2];
        char str_val[128] = "";
        int int_val = 0;
        float float_val = 0;

        if (typetag[tag_idx] == 's') {
            osc_read_string(buf + arg_pos, len - arg_pos, str_val, sizeof(str_val));
        } else if (typetag[tag_idx] == 'i') {
            int_val = osc_read_int32(buf + arg_pos);
            snprintf(str_val, sizeof(str_val), "%d", int_val);
        } else if (typetag[tag_idx] == 'f') {
            float_val = osc_read_float32(buf + arg_pos);
            snprintf(str_val, sizeof(str_val), "%.6f", float_val);
        }

        /* Update state */
        if (strcmp(key, "controller") == 0) strncpy(state->controller, str_val, sizeof(state->controller) - 1);
        else if (strcmp(key, "instance") == 0) state->instance = atoi(str_val);
        else if (strcmp(key, "variant") == 0) strncpy(state->variant, str_val, sizeof(state->variant) - 1);
        else if (strcmp(key, "variant_name") == 0) strncpy(state->variant_name, str_val, sizeof(state->variant_name) - 1);
        else if (strcmp(key, "input_device") == 0) strncpy(state->input_device, str_val, sizeof(state->input_device) - 1);
        else if (strcmp(key, "output_device") == 0) strncpy(state->output_device, str_val, sizeof(state->output_device) - 1);

        output_state(state);

        if (verbose) {
            fprintf(stderr, "State update: %s=%s\n", key, str_val);
        }
    }
    else if (strcmp(category, "raw") == 0 && nparts >= 4) {
        /* /midi/raw/{type}/{channel}[/{controller}] {value} */
        const char *type = parts[2];
        int channel = atoi(parts[3]);
        int value = 0;

        if (typetag[tag_idx] == 'i') {
            value = osc_read_int32(buf + arg_pos);
        } else if (typetag[tag_idx] == 'f') {
            value = (int)osc_read_float32(buf + arg_pos);
        }

        if (strcmp(type, "cc") == 0 && nparts >= 5) {
            int controller = atoi(parts[4]);
            state->last_cc = controller;
            state->last_val = value;

            printf("__EVENT__ %ld %ld %ld raw CC %d %d %d\n",
                   event_id, delta, elapsed, channel, controller, value);
            fflush(stdout);
            output_state(state);

            if (verbose) {
                fprintf(stderr, "[%ld] Δ%ldms: CC ch=%d ctrl=%d val=%d\n",
                        event_id, delta, channel, controller, value);
            }
        }
        else if (strcmp(type, "note") == 0 && nparts >= 5) {
            int note = atoi(parts[4]);
            state->last_cc = note;  /* Store as N{note} conceptually */
            state->last_val = value;

            if (value > 0) {
                printf("__EVENT__ %ld %ld %ld raw NOTE_ON %d %d %d\n",
                       event_id, delta, elapsed, channel, note, value);
            } else {
                printf("__EVENT__ %ld %ld %ld raw NOTE_OFF %d %d\n",
                       event_id, delta, elapsed, channel, note);
            }
            fflush(stdout);
            output_state(state);
        }
        else if (strcmp(type, "program") == 0) {
            printf("__EVENT__ %ld %ld %ld raw PROGRAM_CHANGE %d %d\n",
                   event_id, delta, elapsed, channel, value);
            fflush(stdout);
        }
        else if (strcmp(type, "pitchbend") == 0) {
            printf("__EVENT__ %ld %ld %ld raw PITCH_BEND %d %d\n",
                   event_id, delta, elapsed, channel, value);
            fflush(stdout);
        }
    }
    else if (strcmp(category, "mapped") == 0 && nparts >= 4) {
        /* /midi/mapped/{variant}/{semantic} {value} */
        const char *variant = parts[2];
        const char *semantic = parts[3];
        float value = 0;

        if (typetag[tag_idx] == 'f') {
            value = osc_read_float32(buf + arg_pos);
        } else if (typetag[tag_idx] == 'i') {
            value = (float)osc_read_int32(buf + arg_pos);
        }

        strncpy(state->last_semantic, semantic, sizeof(state->last_semantic) - 1);
        state->last_semantic_val = value;

        printf("__EVENT__ %ld %ld %ld mapped %s %s %.6f\n",
               event_id, delta, elapsed, variant, semantic, value);
        fflush(stdout);
        output_state(state);

        if (verbose) {
            fprintf(stderr, "[%ld] Δ%ldms: %s=%0.6f\n",
                    event_id, delta, semantic, value);
        }
    }
}

/* Print usage */
static void usage(const char *progname) {
    fprintf(stderr,
        "Usage: %s [OPTIONS]\n"
        "\n"
        "Options:\n"
        "  -p PORT       UDP port to listen on (default: %d)\n"
        "  -m ADDR       Multicast group address (default: %s)\n"
        "  -v            Verbose output to stderr\n"
        "  -h            Show this help\n"
        "\n"
        "Output Format:\n"
        "  __STATE__ controller=vmx8 instance=0 variant=a ...\n"
        "  __EVENT__ ID DELTA_MS ELAPSED_MS raw|mapped ...\n"
        "\n"
        "Designed as a drop-in replacement for osc_repl_listener.js\n"
        "with zero dependencies (pure C, no libraries).\n",
        progname, DEFAULT_PORT, DEFAULT_MULTICAST);
}

int main(int argc, char *argv[]) {
    int port = DEFAULT_PORT;
    const char *multicast_addr = DEFAULT_MULTICAST;
    int opt;

    while ((opt = getopt(argc, argv, "p:m:vh")) != -1) {
        switch (opt) {
            case 'p':
                port = atoi(optarg);
                break;
            case 'm':
                multicast_addr = optarg;
                break;
            case 'v':
                verbose = 1;
                break;
            case 'h':
            default:
                usage(argv[0]);
                return opt == 'h' ? 0 : 1;
        }
    }

    /* Initialize timing */
    gettimeofday(&start_time, NULL);
    last_event_time = start_time;

    /* Initialize state */
    OscState state = {0};
    strcpy(state.controller, "");
    strcpy(state.variant, "");
    strcpy(state.variant_name, "");
    strcpy(state.last_semantic, "");
    strcpy(state.input_device, "");
    strcpy(state.output_device, "");

    /* Create UDP socket */
    int sock = socket(AF_INET, SOCK_DGRAM, 0);
    if (sock < 0) {
        perror("socket");
        return 1;
    }

    /* Allow multiple listeners on same port */
    int reuse = 1;
    if (setsockopt(sock, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse)) < 0) {
        perror("setsockopt SO_REUSEADDR");
    }
#ifdef SO_REUSEPORT
    if (setsockopt(sock, SOL_SOCKET, SO_REUSEPORT, &reuse, sizeof(reuse)) < 0) {
        perror("setsockopt SO_REUSEPORT");
    }
#endif

    /* Bind to port */
    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_ANY);
    addr.sin_port = htons(port);

    if (bind(sock, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        perror("bind");
        close(sock);
        return 1;
    }

    /* Join multicast group */
    struct ip_mreq mreq;
    mreq.imr_multiaddr.s_addr = inet_addr(multicast_addr);
    mreq.imr_interface.s_addr = htonl(INADDR_ANY);

    if (setsockopt(sock, IPPROTO_IP, IP_ADD_MEMBERSHIP, &mreq, sizeof(mreq)) < 0) {
        perror("setsockopt IP_ADD_MEMBERSHIP");
        close(sock);
        return 1;
    }

    fprintf(stderr, "✓ OSC listener ready - multicast %s:%d\n", multicast_addr, port);

    /* Main receive loop */
    unsigned char buffer[BUFFER_SIZE];

    while (1) {
        ssize_t n = recv(sock, buffer, sizeof(buffer), 0);
        if (n < 0) {
            if (errno == EINTR) continue;
            perror("recv");
            break;
        }

        if (n > 0) {
            parse_osc_message(buffer, (int)n, &state);
        }
    }

    close(sock);
    return 0;
}

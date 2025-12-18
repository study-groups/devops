/*
 * game_bridge.c - Universal game bridge for Quasar
 *
 * Spawns a game via PTY, parses output for state, calculates TIA sound,
 * and sends frames to quasar_server via WebSocket.
 *
 * Usage:
 *   game_bridge <game>              # loads $TETRA_DIR/orgs/tetra/games/<game>/bridge.json
 *   game_bridge --config <path>     # loads specific config
 *
 * Build:
 *   cc -o game_bridge game_bridge.c cJSON.c -lutil -lpthread
 *
 * Config format (bridge.json):
 *   {
 *     "name": "trax",
 *     "command": "bash trax.sh",
 *     "pty": { "cols": 60, "rows": 24 },
 *     "quasar": "ws://localhost:1985/ws?role=game",
 *     "sound": { ... }
 *   }
 */

#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>
#include <signal.h>
#include <sys/select.h>
#include <sys/wait.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <netinet/in.h>
#include <netdb.h>
#include <termios.h>
#include <regex.h>
#include <time.h>
#include <pthread.h>

#ifdef __APPLE__
#include <util.h>
#else
#include <pty.h>
#endif

#include "../midi/cJSON.h"

/* ============================================================================
 * Configuration
 * ============================================================================ */

#define MAX_FRAME_SIZE 8192
#define MAX_PATH_LEN 512
#define MAX_PATTERN_LEN 256
#define WS_BUFFER_SIZE 16384
#define FRAME_INTERVAL_MS 66  /* ~15 FPS */

typedef struct {
    int gate;
    int freq;
    int wave;
    int vol;
} voice_t;

typedef struct {
    int speeds[8][4];  /* [speed][gate,freq,wave,vol] */
    int voice;
    int waveform;
    int waveform_max;
} engine_sound_t;

typedef struct {
    char name[64];
    char command[256];
    char game_dir[MAX_PATH_LEN];  /* Directory to run game from */
    int pty_cols;
    int pty_rows;
    char quasar_host[128];
    int quasar_port;
    char quasar_path[128];

    /* State parsing */
    char velocity_pattern[MAX_PATTERN_LEN];
    regex_t velocity_regex;
    int velocity_regex_compiled;

    /* Sound config */
    engine_sound_t p1_engine;
    engine_sound_t p2_engine;

    /* Event triggers */
    char event_scored[32];
    char event_hit[32];
    char event_fire[32];
} bridge_config_t;

typedef struct {
    int p1_velocity;
    int p2_velocity;
    int game_running;
    voice_t voices[4];
} game_state_t;

/* Global state */
static bridge_config_t config;
static game_state_t state;
static int master_fd = -1;
static pid_t child_pid = -1;
static int ws_fd = -1;
static volatile int running = 1;
static char frame_buffer[MAX_FRAME_SIZE];
static int frame_len = 0;

/* Latest frame buffer for pull mode */
static char latest_frame_json[MAX_FRAME_SIZE * 2];
static int latest_frame_json_len = 0;
static uint64_t latest_frame_ts = 0;

/* ============================================================================
 * JSON Config Loading
 * ============================================================================ */

static int load_sound_speeds(cJSON *speeds_obj, engine_sound_t *eng) {
    if (!speeds_obj) return 0;

    for (int i = 0; i < 8; i++) {
        char key[4];
        snprintf(key, sizeof(key), "%d", i);
        cJSON *speed = cJSON_GetObjectItem(speeds_obj, key);
        if (speed) {
            cJSON *g = cJSON_GetObjectItem(speed, "gate");
            cJSON *f = cJSON_GetObjectItem(speed, "freq");
            cJSON *w = cJSON_GetObjectItem(speed, "wave");
            cJSON *v = cJSON_GetObjectItem(speed, "vol");

            eng->speeds[i][0] = g ? g->valueint : 0;
            eng->speeds[i][1] = f ? f->valueint : 28;
            eng->speeds[i][2] = w ? w->valueint : eng->waveform;
            eng->speeds[i][3] = v ? v->valueint : 0;
        }
    }
    return 1;
}

static int load_config(const char *path) {
    FILE *f = fopen(path, "r");
    if (!f) {
        fprintf(stderr, "[bridge] Cannot open config: %s\n", path);
        return -1;
    }

    fseek(f, 0, SEEK_END);
    long len = ftell(f);
    fseek(f, 0, SEEK_SET);

    char *json_str = malloc(len + 1);
    fread(json_str, 1, len, f);
    json_str[len] = '\0';
    fclose(f);

    cJSON *root = cJSON_Parse(json_str);
    free(json_str);

    if (!root) {
        fprintf(stderr, "[bridge] JSON parse error: %s\n", cJSON_GetErrorPtr());
        return -1;
    }

    /* Basic config */
    cJSON *name = cJSON_GetObjectItem(root, "name");
    cJSON *cmd = cJSON_GetObjectItem(root, "command");
    cJSON *pty = cJSON_GetObjectItem(root, "pty");
    cJSON *quasar = cJSON_GetObjectItem(root, "quasar");

    if (name) strncpy(config.name, name->valuestring, sizeof(config.name) - 1);
    if (cmd) strncpy(config.command, cmd->valuestring, sizeof(config.command) - 1);

    /* PTY dimensions */
    config.pty_cols = 60;
    config.pty_rows = 24;
    if (pty) {
        cJSON *cols = cJSON_GetObjectItem(pty, "cols");
        cJSON *rows = cJSON_GetObjectItem(pty, "rows");
        if (cols) config.pty_cols = cols->valueint;
        if (rows) config.pty_rows = rows->valueint;
    }

    /* Quasar URL parsing */
    strcpy(config.quasar_host, "localhost");
    config.quasar_port = 1985;
    strcpy(config.quasar_path, "/ws?role=game");

    if (quasar && quasar->valuestring) {
        /* Parse ws://host:port/path */
        char *url = quasar->valuestring;
        if (strncmp(url, "ws://", 5) == 0) url += 5;

        char *colon = strchr(url, ':');
        char *slash = strchr(url, '/');

        if (colon) {
            int host_len = colon - url;
            strncpy(config.quasar_host, url, host_len);
            config.quasar_host[host_len] = '\0';
            config.quasar_port = atoi(colon + 1);
        }
        if (slash) {
            strncpy(config.quasar_path, slash, sizeof(config.quasar_path) - 1);
        }
    }

    /* State parsing patterns */
    cJSON *state_obj = cJSON_GetObjectItem(root, "state");
    if (state_obj) {
        cJSON *vel_pat = cJSON_GetObjectItem(state_obj, "velocity_pattern");
        if (vel_pat && vel_pat->valuestring) {
            strncpy(config.velocity_pattern, vel_pat->valuestring,
                    sizeof(config.velocity_pattern) - 1);
            if (regcomp(&config.velocity_regex, config.velocity_pattern,
                        REG_EXTENDED) == 0) {
                config.velocity_regex_compiled = 1;
            }
        }

        cJSON *events = cJSON_GetObjectItem(state_obj, "events");
        if (events) {
            cJSON *scored = cJSON_GetObjectItem(events, "scored");
            cJSON *hit = cJSON_GetObjectItem(events, "hit");
            cJSON *fire = cJSON_GetObjectItem(events, "fire");
            if (scored) strncpy(config.event_scored, scored->valuestring, 31);
            if (hit) strncpy(config.event_hit, hit->valuestring, 31);
            if (fire) strncpy(config.event_fire, fire->valuestring, 31);
        }
    }

    /* Sound config */
    cJSON *sound = cJSON_GetObjectItem(root, "sound");
    if (sound) {
        cJSON *engine = cJSON_GetObjectItem(sound, "engine");
        if (engine) {
            cJSON *voice = cJSON_GetObjectItem(engine, "voice");
            cJSON *wave = cJSON_GetObjectItem(engine, "waveform");
            cJSON *wave_max = cJSON_GetObjectItem(engine, "waveform_max");
            cJSON *speeds = cJSON_GetObjectItem(engine, "speeds");

            config.p1_engine.voice = voice ? voice->valueint : 0;
            config.p1_engine.waveform = wave ? wave->valueint : 3;
            config.p1_engine.waveform_max = wave_max ? wave_max->valueint : 5;

            /* P2 is same config but voice 1 */
            config.p2_engine = config.p1_engine;
            config.p2_engine.voice = 1;

            load_sound_speeds(speeds, &config.p1_engine);
            load_sound_speeds(speeds, &config.p2_engine);
        }
    }

    cJSON_Delete(root);

    printf("[bridge] Loaded config: %s\n", config.name);
    printf("[bridge]   Command: %s\n", config.command);
    printf("[bridge]   PTY: %dx%d\n", config.pty_cols, config.pty_rows);
    printf("[bridge]   Quasar: %s:%d%s\n", config.quasar_host,
           config.quasar_port, config.quasar_path);

    return 0;
}

/* ============================================================================
 * PTY Management
 * ============================================================================ */

static int spawn_game(void) {
    struct winsize ws = {
        .ws_row = config.pty_rows,
        .ws_col = config.pty_cols,
        .ws_xpixel = 0,
        .ws_ypixel = 0
    };

    child_pid = forkpty(&master_fd, NULL, NULL, &ws);

    if (child_pid < 0) {
        perror("[bridge] forkpty failed");
        return -1;
    }

    if (child_pid == 0) {
        /* Child process */
        setenv("TERM", "xterm-256color", 1);

        /* Ensure TETRA_SRC and TETRA_DIR are set for gamepak wrappers */
        const char *tetra_src = getenv("TETRA_SRC");
        const char *tetra_dir = getenv("TETRA_DIR");
        if (!tetra_src) {
            const char *home = getenv("HOME");
            char src_path[512];
            snprintf(src_path, sizeof(src_path), "%s/src/devops/tetra", home ? home : ".");
            setenv("TETRA_SRC", src_path, 1);
        }
        if (!tetra_dir) {
            const char *home = getenv("HOME");
            char dir_path[512];
            snprintf(dir_path, sizeof(dir_path), "%s/tetra", home ? home : ".");
            setenv("TETRA_DIR", dir_path, 1);
        }

        /* Change to game directory */
        if (config.game_dir[0] && chdir(config.game_dir) < 0) {
            perror("[bridge] chdir failed");
            exit(1);
        }

        /* Execute command via login shell to get full environment */
        execlp("bash", "bash", "-l", "-c", config.command, NULL);
        perror("[bridge] exec failed");
        exit(1);
    }

    /* Parent - set non-blocking */
    int flags = fcntl(master_fd, F_GETFL, 0);
    fcntl(master_fd, F_SETFL, flags | O_NONBLOCK);

    printf("[bridge] Spawned game PID %d\n", child_pid);
    return 0;
}

/* ============================================================================
 * WebSocket Client (Simple Implementation)
 * ============================================================================ */

static char ws_buffer[WS_BUFFER_SIZE];
static int ws_connected = 0;

/* Base64 encoding for WebSocket key */
static const char b64_table[] =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static void base64_encode(const unsigned char *in, int len, char *out) {
    int i, j;
    for (i = 0, j = 0; i < len; i += 3) {
        int val = (in[i] << 16) + (i+1 < len ? in[i+1] << 8 : 0) +
                  (i+2 < len ? in[i+2] : 0);
        out[j++] = b64_table[(val >> 18) & 0x3F];
        out[j++] = b64_table[(val >> 12) & 0x3F];
        out[j++] = (i+1 < len) ? b64_table[(val >> 6) & 0x3F] : '=';
        out[j++] = (i+2 < len) ? b64_table[val & 0x3F] : '=';
    }
    out[j] = '\0';
}

static int ws_connect(void) {
    struct hostent *he = gethostbyname(config.quasar_host);
    if (!he) {
        fprintf(stderr, "[bridge] Cannot resolve host: %s\n", config.quasar_host);
        return -1;
    }

    ws_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (ws_fd < 0) {
        perror("[bridge] socket failed");
        return -1;
    }

    struct sockaddr_in addr;
    addr.sin_family = AF_INET;
    addr.sin_port = htons(config.quasar_port);
    memcpy(&addr.sin_addr, he->h_addr, he->h_length);

    if (connect(ws_fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        perror("[bridge] connect failed");
        close(ws_fd);
        ws_fd = -1;
        return -1;
    }

    /* WebSocket handshake */
    unsigned char key_bytes[16];
    for (int i = 0; i < 16; i++) key_bytes[i] = rand() & 0xFF;
    char key_b64[32];
    base64_encode(key_bytes, 16, key_b64);

    char request[512];
    snprintf(request, sizeof(request),
        "GET %s HTTP/1.1\r\n"
        "Host: %s:%d\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        "Sec-WebSocket-Key: %s\r\n"
        "Sec-WebSocket-Version: 13\r\n"
        "\r\n",
        config.quasar_path, config.quasar_host, config.quasar_port, key_b64);

    send(ws_fd, request, strlen(request), 0);

    /* Read response */
    char response[1024];
    int n = recv(ws_fd, response, sizeof(response) - 1, 0);
    if (n <= 0 || strstr(response, "101") == NULL) {
        fprintf(stderr, "[bridge] WebSocket handshake failed\n");
        close(ws_fd);
        ws_fd = -1;
        return -1;
    }

    /* Set non-blocking */
    int flags = fcntl(ws_fd, F_GETFL, 0);
    fcntl(ws_fd, F_SETFL, flags | O_NONBLOCK);

    ws_connected = 1;
    printf("[bridge] Connected to Quasar\n");
    return 0;
}

static int ws_send(const char *data, int len) {
    if (!ws_connected || ws_fd < 0) return -1;

    unsigned char frame[WS_BUFFER_SIZE + 14];
    int frame_len = 0;

    /* Opcode: text frame */
    frame[frame_len++] = 0x81;

    /* Length + mask bit */
    if (len < 126) {
        frame[frame_len++] = 0x80 | len;
    } else if (len < 65536) {
        frame[frame_len++] = 0x80 | 126;
        frame[frame_len++] = (len >> 8) & 0xFF;
        frame[frame_len++] = len & 0xFF;
    } else {
        frame[frame_len++] = 0x80 | 127;
        for (int i = 7; i >= 0; i--) {
            frame[frame_len++] = (len >> (i * 8)) & 0xFF;
        }
    }

    /* Masking key */
    unsigned char mask[4];
    for (int i = 0; i < 4; i++) mask[i] = rand() & 0xFF;
    memcpy(frame + frame_len, mask, 4);
    frame_len += 4;

    /* Masked payload */
    for (int i = 0; i < len; i++) {
        frame[frame_len++] = data[i] ^ mask[i % 4];
    }

    return send(ws_fd, frame, frame_len, 0);
}

static int ws_recv(char *buf, int max_len) {
    if (!ws_connected || ws_fd < 0) return -1;

    unsigned char header[14];
    int n = recv(ws_fd, header, 2, MSG_PEEK);
    if (n <= 0) return n;

    int payload_len = header[1] & 0x7F;
    int header_len = 2;

    if (payload_len == 126) header_len = 4;
    else if (payload_len == 127) header_len = 10;

    n = recv(ws_fd, header, header_len, 0);
    if (n < header_len) return -1;

    if (payload_len == 126) {
        payload_len = (header[2] << 8) | header[3];
    } else if (payload_len == 127) {
        payload_len = 0;
        for (int i = 0; i < 8; i++) {
            payload_len = (payload_len << 8) | header[2 + i];
        }
    }

    if (payload_len > max_len) payload_len = max_len;

    n = recv(ws_fd, buf, payload_len, 0);
    buf[n > 0 ? n : 0] = '\0';
    return n;
}

/* ============================================================================
 * Frame Parsing and Sound Calculation
 * ============================================================================ */

static void parse_frame(const char *output, int len) {
    /* Detect game running */
    if (strstr(output, "speed") || strstr(output, "P1") || strstr(output, "P2")) {
        if (!state.game_running) {
            printf("[bridge] Game detected as running\n");
        }
        state.game_running = 1;
    }

    /* Parse velocity from output */
    if (config.velocity_regex_compiled) {
        regmatch_t matches[3];
        if (regexec(&config.velocity_regex, output, 3, matches, 0) == 0) {
            if (matches[1].rm_so >= 0) {
                char vel_str[16];
                int vel_len = matches[1].rm_eo - matches[1].rm_so;
                strncpy(vel_str, output + matches[1].rm_so, vel_len);
                vel_str[vel_len] = '\0';
                state.p1_velocity = atoi(vel_str);
            }
        }
    }

    /* Simple pattern matching fallback */
    const char *p1_speed = strstr(output, "P1[WASD]: speed ");
    if (p1_speed) {
        state.p1_velocity = atoi(p1_speed + 16);
    } else if (strstr(output, "P1[WASD]: stopped")) {
        state.p1_velocity = 0;
    }

    const char *p2_speed = strstr(output, "P2[IJKL]: speed ");
    if (p2_speed) {
        state.p2_velocity = atoi(p2_speed + 16);
    } else if (strstr(output, "P2[IJKL]: stopped")) {
        state.p2_velocity = 0;
    }
}

static void calculate_sound(void) {
    if (!state.game_running) {
        /* Silent until game running */
        for (int i = 0; i < 4; i++) {
            state.voices[i].gate = 0;
            state.voices[i].vol = 0;
        }
        return;
    }

    /* P1 engine */
    int v1 = abs(state.p1_velocity);
    if (v1 > 7) v1 = 7;
    state.voices[0].gate = config.p1_engine.speeds[v1][0];
    state.voices[0].freq = config.p1_engine.speeds[v1][1];
    state.voices[0].wave = config.p1_engine.speeds[v1][2];
    state.voices[0].vol = config.p1_engine.speeds[v1][3];

    /* P2 engine */
    int v2 = abs(state.p2_velocity);
    if (v2 > 7) v2 = 7;
    state.voices[1].gate = config.p2_engine.speeds[v2][0];
    state.voices[1].freq = config.p2_engine.speeds[v2][1];
    state.voices[1].wave = config.p2_engine.speeds[v2][2];
    state.voices[1].vol = config.p2_engine.speeds[v2][3];
}

/* ============================================================================
 * UTF-8 Sanitization
 * ============================================================================ */

/*
 * Sanitize PTY output for WebSocket transmission.
 * Terminal games are ASCII-only, so we strip all bytes >= 0x80.
 * Keeps: printable ASCII, newlines/tabs, and ANSI CSI escape sequences.
 * Converts: ESC to literal "\x1b" for JSON safety.
 */
static void sanitize_for_json(const char *src, int src_len, char *dst, int max_len) {
    const unsigned char *s = (const unsigned char *)src;
    const unsigned char *src_end = s + src_len;
    unsigned char *d = (unsigned char *)dst;
    unsigned char *end = d + max_len - 10;  /* Leave room for escape sequences */

    while (s < src_end && d < end) {
        unsigned char c = *s;

        /* Skip any byte >= 0x80 (non-ASCII) */
        if (c >= 0x80) {
            s++;
            continue;
        }

        /* Handle ESC - start of ANSI sequence */
        if (c == 0x1B) {
            /* Check for CSI sequence: ESC [ */
            if (s + 1 < src_end && s[1] == '[') {
                /* Find end of CSI sequence */
                const unsigned char *seq_start = s;
                s += 2;  /* Skip ESC [ */

                /* Skip parameter bytes (0x30-0x3F: digits, semicolon, etc) */
                while (s < src_end && *s >= 0x30 && *s <= 0x3F) s++;

                /* Skip intermediate bytes (0x20-0x2F) */
                while (s < src_end && *s >= 0x20 && *s <= 0x2F) s++;

                /* Final byte should be 0x40-0x7E */
                if (s < src_end && *s >= 0x40 && *s <= 0x7E) {
                    s++;  /* Include final byte */

                    /* Copy entire sequence */
                    int seq_len = s - seq_start;
                    if (d + seq_len < end) {
                        memcpy(d, seq_start, seq_len);
                        d += seq_len;
                    }
                }
                /* If malformed, we've skipped it */
                continue;
            }

            /* Other ESC sequences - skip the ESC and next char */
            s++;
            if (s < src_end) s++;
            continue;
        }

        /* Printable ASCII (space 0x20 to tilde 0x7E) */
        if (c >= 0x20 && c <= 0x7E) {
            *d++ = c;
            s++;
            continue;
        }

        /* Whitespace */
        if (c == '\n' || c == '\r' || c == '\t') {
            *d++ = c;
            s++;
            continue;
        }

        /* Skip all other control characters (0x00-0x1F except above) */
        s++;
    }

    *d = '\0';
}

/* ============================================================================
 * Frame Sending
 * ============================================================================ */

static int frame_seq = 0;
static char sanitized_display[MAX_FRAME_SIZE];

/* Get high-resolution timestamp in milliseconds */
static uint64_t get_timestamp_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_REALTIME, &ts);
    return (uint64_t)ts.tv_sec * 1000 + ts.tv_nsec / 1000000;
}

static void send_frame(const char *display, int display_len) {
    calculate_sound();

    /* Sanitize display for WebSocket (ASCII only, strip high bytes) */
    sanitize_for_json(display, display_len, sanitized_display, sizeof(sanitized_display));

    /* Get high-res timestamp */
    uint64_t ts_ms = get_timestamp_ms();

    /* Build JSON frame */
    cJSON *root = cJSON_CreateObject();
    cJSON_AddStringToObject(root, "t", "frame");
    cJSON_AddNumberToObject(root, "seq", ++frame_seq);
    cJSON_AddNumberToObject(root, "ts", (double)ts_ms);

    /* Add sanitized display */
    cJSON_AddStringToObject(root, "display", sanitized_display);

    /* Sound state */
    cJSON *snd = cJSON_CreateObject();
    cJSON_AddStringToObject(snd, "mode", "tia");

    cJSON *voices = cJSON_CreateArray();
    for (int i = 0; i < 4; i++) {
        cJSON *v = cJSON_CreateObject();
        cJSON_AddNumberToObject(v, "g", state.voices[i].gate);
        cJSON_AddNumberToObject(v, "f", state.voices[i].freq);
        cJSON_AddNumberToObject(v, "w", state.voices[i].wave);
        cJSON_AddNumberToObject(v, "v", state.voices[i].vol);
        cJSON_AddItemToArray(voices, v);
    }
    cJSON_AddItemToObject(snd, "v", voices);
    cJSON_AddItemToObject(root, "snd", snd);

    char *json = cJSON_PrintUnformatted(root);
    int json_len = strlen(json);

    /* Store in latest frame buffer for pull mode */
    if (json_len < sizeof(latest_frame_json)) {
        memcpy(latest_frame_json, json, json_len + 1);
        latest_frame_json_len = json_len;
        latest_frame_ts = ts_ms;
    }

    /* Send frame (push mode) */
    ws_send(json, json_len);

    if (frame_seq <= 3) {
        printf("[bridge] Sent frame #%d, %d bytes\n", frame_seq, json_len);
    }

    free(json);
    cJSON_Delete(root);
}

/* Send latest frame immediately (for poll requests) */
static void send_latest_frame(void) {
    if (latest_frame_json_len > 0) {
        ws_send(latest_frame_json, latest_frame_json_len);
    }
}

/* ============================================================================
 * Signal Handling
 * ============================================================================ */

static void signal_handler(int sig) {
    printf("\n[bridge] Received signal %d, shutting down...\n", sig);
    running = 0;
}

/* ============================================================================
 * Main Loop
 * ============================================================================ */

int main(int argc, char **argv) {
    char config_path[MAX_PATH_LEN];

    /* Parse arguments */
    if (argc < 2) {
        fprintf(stderr, "Usage: %s <game> | --config <path>\n", argv[0]);
        return 1;
    }

    if (strcmp(argv[1], "--config") == 0 && argc > 2) {
        strncpy(config_path, argv[2], sizeof(config_path) - 1);
    } else {
        /* Build path: $TETRA_DIR/orgs/tetra/games/<game>/bridge.json */
        const char *tetra_dir = getenv("TETRA_DIR");
        if (!tetra_dir) {
            /* Fallback to $HOME/tetra */
            const char *home = getenv("HOME");
            static char fallback[MAX_PATH_LEN];
            snprintf(fallback, sizeof(fallback), "%s/tetra", home ? home : ".");
            tetra_dir = fallback;
        }
        snprintf(config_path, sizeof(config_path),
                 "%s/orgs/tetra/games/%s/bridge.json", tetra_dir, argv[1]);
    }

    /* Initialize */
    memset(&config, 0, sizeof(config));
    memset(&state, 0, sizeof(state));
    srand(time(NULL));

    /* Extract game directory from config path */
    strncpy(config.game_dir, config_path, sizeof(config.game_dir) - 1);
    char *last_slash = strrchr(config.game_dir, '/');
    if (last_slash) *last_slash = '\0';

    /* Set default sound values */
    for (int i = 0; i < 4; i++) {
        state.voices[i].freq = 28;
        state.voices[i].wave = 3;
    }

    /* Load config */
    if (load_config(config_path) < 0) {
        return 1;
    }
    printf("[bridge]   Game dir: %s\n", config.game_dir);

    /* Setup signal handlers */
    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);
    signal(SIGCHLD, SIG_IGN);

    /* Connect to Quasar */
    printf("[bridge] Connecting to Quasar...\n");
    while (running && ws_connect() < 0) {
        sleep(2);
    }

    if (!running) return 0;

    /* Register as game source */
    char reg_msg[128];
    snprintf(reg_msg, sizeof(reg_msg),
             "{\"t\":\"register\",\"gameType\":\"%s\"}", config.name);
    ws_send(reg_msg, strlen(reg_msg));

    /* Spawn game */
    if (spawn_game() < 0) {
        return 1;
    }

    printf("\n========================================\n");
    printf("  Game Bridge - %s\n", config.name);
    printf("========================================\n\n");

    /* Main loop - frame rate limited */
    fd_set read_fds;
    struct timeval tv;
    char read_buf[4096];
    struct timespec last_frame_time, now;
    clock_gettime(CLOCK_MONOTONIC, &last_frame_time);
    int frame_pending = 0;

    while (running) {
        FD_ZERO(&read_fds);
        FD_SET(master_fd, &read_fds);
        if (ws_fd >= 0) FD_SET(ws_fd, &read_fds);

        /* Short timeout to check for data frequently */
        tv.tv_sec = 0;
        tv.tv_usec = 10000;  /* 10ms poll */

        int max_fd = master_fd > ws_fd ? master_fd : ws_fd;
        int ready = select(max_fd + 1, &read_fds, NULL, NULL, &tv);

        if (ready < 0) {
            if (errno == EINTR) continue;
            break;
        }

        /* Read from game PTY - accumulate in buffer */
        if (FD_ISSET(master_fd, &read_fds)) {
            int n = read(master_fd, read_buf, sizeof(read_buf) - 1);
            if (n > 0) {
                /* Append to frame buffer */
                if (frame_len + n < MAX_FRAME_SIZE) {
                    memcpy(frame_buffer + frame_len, read_buf, n);
                    frame_len += n;
                    frame_buffer[frame_len] = '\0';
                }
                frame_pending = 1;
            } else if (n == 0) {
                printf("[bridge] Game process ended\n");
                break;
            }
        }

        /* Send frame at fixed interval */
        clock_gettime(CLOCK_MONOTONIC, &now);
        long elapsed_ms = (now.tv_sec - last_frame_time.tv_sec) * 1000 +
                          (now.tv_nsec - last_frame_time.tv_nsec) / 1000000;

        if (elapsed_ms >= FRAME_INTERVAL_MS && frame_pending && frame_len > 0) {
            parse_frame(frame_buffer, frame_len);
            send_frame(frame_buffer, frame_len);
            frame_len = 0;
            frame_pending = 0;
            last_frame_time = now;
        }

        /* Read from WebSocket (input forwarding) */
        if (ws_fd >= 0 && FD_ISSET(ws_fd, &read_fds)) {
            char ws_msg[1024];
            int n = ws_recv(ws_msg, sizeof(ws_msg) - 1);
            if (n > 0) {
                ws_msg[n] = '\0';

                /* Parse input message */
                cJSON *msg = cJSON_Parse(ws_msg);
                if (msg) {
                    cJSON *type = cJSON_GetObjectItem(msg, "t");
                    if (type && type->valuestring) {
                        if (strcmp(type->valuestring, "input") == 0) {
                            cJSON *key = cJSON_GetObjectItem(msg, "key");
                            if (key && key->valuestring) {
                                /* Forward key to game */
                                write(master_fd, key->valuestring,
                                      strlen(key->valuestring));
                            }
                        } else if (strcmp(type->valuestring, "poll") == 0) {
                            /* Respond with latest frame immediately */
                            send_latest_frame();
                        }
                    }
                    cJSON_Delete(msg);
                }
            } else if (n == 0) {
                printf("[bridge] WebSocket disconnected\n");
                ws_connected = 0;
                close(ws_fd);
                ws_fd = -1;

                /* Reconnect */
                sleep(2);
                ws_connect();
            }
        }

        /* Check if child is still running */
        int status;
        if (waitpid(child_pid, &status, WNOHANG) > 0) {
            printf("[bridge] Game exited with status %d\n",
                   WEXITSTATUS(status));
            break;
        }
    }

    /* Cleanup */
    if (master_fd >= 0) close(master_fd);
    if (ws_fd >= 0) close(ws_fd);
    if (child_pid > 0) kill(child_pid, SIGTERM);
    if (config.velocity_regex_compiled) regfree(&config.velocity_regex);

    printf("[bridge] Shutdown complete\n");
    return 0;
}

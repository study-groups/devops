/*
 * midi_bridge.c - Unified low-latency MIDI + Gamepad bridge
 *
 * Combines MIDI and gamepad input into a single high-performance binary.
 * Outputs to both OSC (for network) and Unix socket (for local games).
 *
 * Build (macOS):
 *   clang midi_bridge.c -o midi_bridge \
 *     $(pkg-config --cflags --libs sdl2) \
 *     -framework CoreMIDI -framework CoreFoundation
 *
 * Usage:
 *   ./midi_bridge [options]
 *     -s PATH    Unix socket path (default: /tmp/estoface_gamepad.sock)
 *     -p PORT    OSC UDP port (default: 1983)
 *     -m GROUP   OSC multicast group (default: 239.1.1.1)
 *     -g         Enable gamepad input
 *     -M         Enable MIDI input
 *     -v         Verbose output
 *     -l         List devices and exit
 *
 * Examples:
 *   ./midi_bridge -g -M -v              # Both inputs, verbose
 *   ./midi_bridge -g -s /tmp/game.sock  # Gamepad only, custom socket
 */

#define _DARWIN_C_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <stdbool.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <time.h>
#include <errno.h>
#include <fcntl.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <netinet/in.h>
#include <arpa/inet.h>

#include <SDL.h>
#include <CoreMIDI/CoreMIDI.h>
#include <CoreFoundation/CoreFoundation.h>
#include "cJSON.h"

/* ============================================================================
 * PROTOCOL - gp_msg for games
 * ============================================================================ */

#define AXES_MAX 6

struct gp_msg {
    uint32_t version;        /* = 1 */
    uint32_t player_id;      /* 0-3 */
    uint32_t seq;            /* sequence number */
    uint32_t buttons;        /* button bitfield */
    int16_t  axes[AXES_MAX]; /* LX, LY, RX, RY, LT, RT */
    uint16_t n_axes;         /* = 6 */
    uint16_t _pad;           /* alignment */
    uint64_t t_mono_ns;      /* timestamp */
};

/* ============================================================================
 * CONFIGURATION
 * ============================================================================ */

/* Velocity range: maps displacement to ordinal */
typedef struct {
    int min;
    int max;
    int value;
} VelRange;

#define MAX_VEL_RANGES 16
#define MAX_CONTROLS 32

typedef struct {
    char socket_path[256];
    char osc_multicast[64];
    char map_file[256];      /* -j: JSON map file */
    int osc_port;
    bool enable_gamepad;
    bool enable_midi;
    bool verbose;
    bool list_devices;
    bool stdout_output;      /* -O: output tank commands to stdout */

    /* MIDI CC to axis mapping */
    int midi_channel;        /* 1-16, 0 = any */
    int cc_base;             /* First CC number (default 40) */

    /* Tank control - MIDI CC inputs */
    int p1_left_cc;
    int p1_right_cc;
    int p2_left_cc;
    int p2_right_cc;

    /* Tank control - Gamepad axis inputs (-1 = disabled) */
    int p1_left_axis;
    int p1_right_axis;
    int p2_left_axis;
    int p2_right_axis;

    /* Range settings */
    int deadzone;
    int center;
    int turn_threshold;
    int turn_debounce_ms;

    /* Velocity ranges (displacement -> ordinal) */
    VelRange vel_ranges[MAX_VEL_RANGES];
    int num_vel_ranges;

    /* Button controls: CC -> char mapping */
    struct { int cc; char key; } controls[MAX_CONTROLS];
    int num_controls;
} Config;

static Config config = {
    .socket_path = "/tmp/estoface_gamepad.sock",
    .osc_multicast = "239.1.1.1",
    .map_file = "",
    .osc_port = 1983,
    .enable_gamepad = false,
    .enable_midi = false,
    .verbose = false,
    .list_devices = false,
    .stdout_output = false,
    .midi_channel = 0,
    .cc_base = 40,
    /* MIDI CC inputs */
    .p1_left_cc = 40,
    .p1_right_cc = 41,
    .p2_left_cc = 46,
    .p2_right_cc = 47,
    /* Gamepad axis inputs (1=LY, 3=RY for typical controller) */
    .p1_left_axis = 1,
    .p1_right_axis = 3,
    .p2_left_axis = -1,
    .p2_right_axis = -1,
    /* Range settings */
    .deadzone = 20,
    .center = 64,
    .turn_threshold = 40,
    .turn_debounce_ms = 200,
    /* Default velocity ranges */
    .vel_ranges = {
        { -64, -50, -3 },
        { -50, -30, -2 },
        { -30, -20, -1 },
        { -20,  20,  0 },
        {  20,  30,  1 },
        {  30,  50,  2 },
        {  50,  64,  3 },
    },
    .num_vel_ranges = 7,
    .num_controls = 0,
};

/* ============================================================================
 * STATE
 * ============================================================================ */

static volatile bool running = true;

static struct {
    /* Current axis values */
    int16_t axes[AXES_MAX];
    uint32_t buttons;
    uint32_t prev_buttons;  /* Previous frame for edge detection */
    uint32_t seq;

    /* Sockets */
    int socket_fd;
    struct sockaddr_un socket_addr;
    int osc_fd;
    struct sockaddr_in osc_addr;

    /* SDL */
    SDL_GameController *gamepad;

    /* MIDI */
    MIDIClientRef midi_client;
    MIDIPortRef midi_port;

    /* Tank control state (for -O stdout mode) */
    int p1_left_fader;
    int p1_right_fader;
    int p2_left_fader;
    int p2_right_fader;
    int p1_last_vel;
    int p2_last_vel;
    uint64_t p1_last_turn_ns;
    uint64_t p2_last_turn_ns;

    /* Timing */
    uint64_t last_send_ns;
    uint64_t send_interval_ns;
} state = {
    .socket_fd = -1,
    .osc_fd = -1,
    .gamepad = NULL,
    .p1_left_fader = 64,
    .p1_right_fader = 64,
    .p2_left_fader = 64,
    .p2_right_fader = 64,
    .send_interval_ns = 2000000,  /* 2ms = 500Hz */
};

/* ============================================================================
 * UTILITIES
 * ============================================================================ */

static void handle_signal(int sig) {
    (void)sig;
    running = false;
}

static uint64_t now_ns(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (uint64_t)ts.tv_sec * 1000000000ULL + (uint64_t)ts.tv_nsec;
}

static void log_msg(const char *fmt, ...) {
    if (!config.verbose) return;
    va_list args;
    va_start(args, fmt);
    vfprintf(stderr, fmt, args);
    va_end(args);
}

/* ============================================================================
 * JSON MAP FILE LOADER
 * ============================================================================ */

static int load_map_file(const char *path) {
    FILE *f = fopen(path, "rb");
    if (!f) {
        fprintf(stderr, "Cannot open map file: %s\n", path);
        return -1;
    }

    fseek(f, 0, SEEK_END);
    long len = ftell(f);
    fseek(f, 0, SEEK_SET);

    char *data = malloc(len + 1);
    if (!data) { fclose(f); return -1; }

    fread(data, 1, len, f);
    data[len] = '\0';
    fclose(f);

    cJSON *root = cJSON_Parse(data);
    free(data);

    if (!root) {
        fprintf(stderr, "JSON parse error: %s\n", cJSON_GetErrorPtr());
        return -1;
    }

    /* Load tank.p1/p2 */
    cJSON *tank = cJSON_GetObjectItem(root, "tank");
    if (tank) {
        cJSON *p1 = cJSON_GetObjectItem(tank, "p1");
        if (p1) {
            cJSON *left = cJSON_GetObjectItem(p1, "left_track");
            cJSON *right = cJSON_GetObjectItem(p1, "right_track");
            if (left) config.p1_left_cc = left->valueint;
            if (right) config.p1_right_cc = right->valueint;
        }
        cJSON *p2 = cJSON_GetObjectItem(tank, "p2");
        if (p2) {
            cJSON *left = cJSON_GetObjectItem(p2, "left_track");
            cJSON *right = cJSON_GetObjectItem(p2, "right_track");
            if (left) config.p2_left_cc = left->valueint;
            if (right) config.p2_right_cc = right->valueint;
        }
    }

    /* Load global settings */
    cJSON *item;
    if ((item = cJSON_GetObjectItem(root, "deadzone"))) config.deadzone = item->valueint;
    if ((item = cJSON_GetObjectItem(root, "center"))) config.center = item->valueint;
    if ((item = cJSON_GetObjectItem(root, "turn_threshold"))) config.turn_threshold = item->valueint;

    /* Load controls (CC -> key mappings) */
    cJSON *controls = cJSON_GetObjectItem(root, "controls");
    if (controls) {
        config.num_controls = 0;
        cJSON *ctrl = NULL;
        cJSON_ArrayForEach(ctrl, controls) {
            if (config.num_controls >= 16) break;
            int cc = atoi(ctrl->string);
            const char *key = ctrl->valuestring;
            if (cc > 0 && key && key[0]) {
                config.controls[config.num_controls].cc = cc;
                config.controls[config.num_controls].key = key[0];
                config.num_controls++;
            }
        }
    }

    cJSON_Delete(root);

    fprintf(stderr, "Map: %s\n", path);
    fprintf(stderr, "  P1: CC%d/%d  P2: CC%d/%d\n",
            config.p1_left_cc, config.p1_right_cc,
            config.p2_left_cc, config.p2_right_cc);
    fprintf(stderr, "  deadzone=%d center=%d turn=%d controls=%d\n",
            config.deadzone, config.center, config.turn_threshold, config.num_controls);

    return 0;
}

/* Load controls.json format (game-colocated control definitions) */
static int load_controls_json(const char *path) {
    FILE *f = fopen(path, "rb");
    if (!f) {
        fprintf(stderr, "Cannot open controls file: %s\n", path);
        return -1;
    }

    fseek(f, 0, SEEK_END);
    long len = ftell(f);
    fseek(f, 0, SEEK_SET);

    char *data = malloc(len + 1);
    if (!data) { fclose(f); return -1; }

    fread(data, 1, len, f);
    data[len] = '\0';
    fclose(f);

    cJSON *root = cJSON_Parse(data);
    free(data);

    if (!root) {
        fprintf(stderr, "JSON parse error: %s\n", cJSON_GetErrorPtr());
        return -1;
    }

    /* Get game name for logging */
    cJSON *name = cJSON_GetObjectItem(root, "name");
    if (name && name->valuestring) {
        fprintf(stderr, "Controls: %s\n", name->valuestring);
    }

    /* Load MIDI defaults */
    cJSON *defaults = cJSON_GetObjectItem(root, "defaults");
    if (defaults) {
        cJSON *midi = cJSON_GetObjectItem(defaults, "midi");
        if (midi) {
            /* p1_forward uses fader_pair with left_cc/right_cc */
            cJSON *p1_fwd = cJSON_GetObjectItem(midi, "p1_forward");
            if (p1_fwd) {
                cJSON *left = cJSON_GetObjectItem(p1_fwd, "left_cc");
                cJSON *right = cJSON_GetObjectItem(p1_fwd, "right_cc");
                if (left) config.p1_left_cc = left->valueint;
                if (right) config.p1_right_cc = right->valueint;
            }

            cJSON *p2_fwd = cJSON_GetObjectItem(midi, "p2_forward");
            if (p2_fwd) {
                cJSON *left = cJSON_GetObjectItem(p2_fwd, "left_cc");
                cJSON *right = cJSON_GetObjectItem(p2_fwd, "right_cc");
                if (left) config.p2_left_cc = left->valueint;
                if (right) config.p2_right_cc = right->valueint;
            }

            /* Also check p1_left/p1_right for turn threshold */
            cJSON *p1_left = cJSON_GetObjectItem(midi, "p1_left");
            if (p1_left) {
                cJSON *thresh = cJSON_GetObjectItem(p1_left, "threshold");
                if (thresh) config.turn_threshold = abs(thresh->valueint);
            }
        }

        /* Load gamepad defaults */
        cJSON *gamepad = cJSON_GetObjectItem(defaults, "gamepad");
        if (gamepad) {
            cJSON *p1_fwd = cJSON_GetObjectItem(gamepad, "p1_forward");
            if (p1_fwd) {
                cJSON *axis = cJSON_GetObjectItem(p1_fwd, "axis");
                if (axis) config.p1_left_axis = axis->valueint;
            }

            cJSON *p2_fwd = cJSON_GetObjectItem(gamepad, "p2_forward");
            if (p2_fwd) {
                cJSON *axis = cJSON_GetObjectItem(p2_fwd, "axis");
                if (axis) config.p2_left_axis = axis->valueint;
            }
        }
    }

    /* Load transform settings */
    cJSON *transforms = cJSON_GetObjectItem(root, "transforms");
    if (transforms) {
        cJSON *tank_vel = cJSON_GetObjectItem(transforms, "tank_velocity");
        if (tank_vel) {
            cJSON *dz = cJSON_GetObjectItem(tank_vel, "deadzone");
            cJSON *ctr = cJSON_GetObjectItem(tank_vel, "center");
            if (dz) config.deadzone = dz->valueint;
            if (ctr) config.center = ctr->valueint;

            /* Load velocity ranges */
            cJSON *ranges = cJSON_GetObjectItem(tank_vel, "ranges");
            if (ranges && cJSON_IsArray(ranges)) {
                config.num_vel_ranges = 0;
                cJSON *range = NULL;
                cJSON_ArrayForEach(range, ranges) {
                    if (config.num_vel_ranges >= MAX_VEL_RANGES) break;
                    cJSON *min = cJSON_GetObjectItem(range, "min");
                    cJSON *max = cJSON_GetObjectItem(range, "max");
                    cJSON *val = cJSON_GetObjectItem(range, "value");
                    if (min && max && val) {
                        config.vel_ranges[config.num_vel_ranges].min = min->valueint;
                        config.vel_ranges[config.num_vel_ranges].max = max->valueint;
                        config.vel_ranges[config.num_vel_ranges].value = val->valueint;
                        config.num_vel_ranges++;
                    }
                }
            }
        }
    }

    /* Load settings */
    cJSON *settings = cJSON_GetObjectItem(root, "settings");
    if (settings) {
        cJSON *debounce = cJSON_GetObjectItem(settings, "turn_debounce_ms");
        if (debounce) config.turn_debounce_ms = debounce->valueint;
    }

    cJSON_Delete(root);

    fprintf(stderr, "  MIDI: P1=CC%d/%d  P2=CC%d/%d\n",
            config.p1_left_cc, config.p1_right_cc,
            config.p2_left_cc, config.p2_right_cc);
    fprintf(stderr, "  Gamepad: P1=axis%d  P2=axis%d\n",
            config.p1_left_axis, config.p2_left_axis);
    fprintf(stderr, "  deadzone=%d center=%d turn=%d debounce=%dms\n",
            config.deadzone, config.center, config.turn_threshold, config.turn_debounce_ms);

    return 0;
}

/* ============================================================================
 * TANK CONTROL STDOUT OUTPUT (-O mode)
 * Converts fader pairs to velocity/turn commands for trax
 * ============================================================================ */

/* Convert fader pair average to velocity using loaded ranges */
static int faders_to_velocity(int left, int right) {
    int avg = ((left - config.center) + (right - config.center)) / 2;

    /* Use loaded velocity ranges */
    for (int i = 0; i < config.num_vel_ranges; i++) {
        if (avg >= config.vel_ranges[i].min && avg < config.vel_ranges[i].max) {
            return config.vel_ranges[i].value;
        }
    }

    /* Fallback: clamp to -3..+3 */
    if (avg > 50) return 3;
    if (avg < -50) return -3;
    return 0;
}

/* Detect turn from fader differential */
static int faders_to_turn(int left, int right) {
    int diff = right - left;
    if (abs(diff) < config.turn_threshold) return 0;
    return diff > 0 ? 1 : -1;
}

/* Process tank controls and output to stdout */
static void process_tank_output(void) {
    if (!config.stdout_output) return;

    uint64_t now = now_ns();
    uint64_t debounce_ns = (uint64_t)config.turn_debounce_ms * 1000000ULL;

    /* Player 1 */
    int vel1 = faders_to_velocity(state.p1_left_fader, state.p1_right_fader);
    if (vel1 != state.p1_last_vel) {
        printf("V:1:%d\n", vel1);
        fflush(stdout);
        state.p1_last_vel = vel1;
    }

    int turn1 = faders_to_turn(state.p1_left_fader, state.p1_right_fader);
    if (turn1 != 0 && (now - state.p1_last_turn_ns) > debounce_ns) {
        printf("%c\n", turn1 < 0 ? 'a' : 'd');
        fflush(stdout);
        state.p1_last_turn_ns = now;
    }

    /* Player 2 */
    int vel2 = faders_to_velocity(state.p2_left_fader, state.p2_right_fader);
    if (vel2 != state.p2_last_vel) {
        printf("V:2:%d\n", vel2);
        fflush(stdout);
        state.p2_last_vel = vel2;
    }

    int turn2 = faders_to_turn(state.p2_left_fader, state.p2_right_fader);
    if (turn2 != 0 && (now - state.p2_last_turn_ns) > debounce_ns) {
        printf("%c\n", turn2 < 0 ? 'j' : 'l');
        fflush(stdout);
        state.p2_last_turn_ns = now;
    }

    log_msg("P1: L=%d R=%d v=%d  P2: L=%d R=%d v=%d\n",
            state.p1_left_fader, state.p1_right_fader, vel1,
            state.p2_left_fader, state.p2_right_fader, vel2);
}

/* Update fader state from CC message */
static void update_tank_fader(int cc, int value) {
    if (cc == config.p1_left_cc) state.p1_left_fader = value;
    else if (cc == config.p1_right_cc) state.p1_right_fader = value;
    else if (cc == config.p2_left_cc) state.p2_left_fader = value;
    else if (cc == config.p2_right_cc) state.p2_right_fader = value;
}

/* ============================================================================
 * UNIX SOCKET OUTPUT (fast path for local games)
 * ============================================================================ */

static int init_socket(void) {
    state.socket_fd = socket(AF_UNIX, SOCK_DGRAM, 0);
    if (state.socket_fd < 0) {
        perror("socket");
        return -1;
    }

    /* Set non-blocking */
    int flags = fcntl(state.socket_fd, F_GETFL, 0);
    fcntl(state.socket_fd, F_SETFL, flags | O_NONBLOCK);

    memset(&state.socket_addr, 0, sizeof(state.socket_addr));
    state.socket_addr.sun_family = AF_UNIX;
    strncpy(state.socket_addr.sun_path, config.socket_path,
            sizeof(state.socket_addr.sun_path) - 1);

    fprintf(stderr, "Socket: %s\n", config.socket_path);
    return 0;
}

static void send_gp_msg(void) {
    if (state.socket_fd < 0) return;

    struct gp_msg msg = {
        .version = 1,
        .player_id = 0,
        .seq = state.seq++,
        .buttons = state.buttons,
        .n_axes = AXES_MAX,
        .t_mono_ns = now_ns(),
    };
    memcpy(msg.axes, state.axes, sizeof(msg.axes));

    ssize_t n = sendto(state.socket_fd, &msg, sizeof(msg), 0,
                       (struct sockaddr *)&state.socket_addr,
                       sizeof(state.socket_addr));
    if (n < 0 && errno != ENOENT && errno != ECONNREFUSED) {
        /* Ignore if target not listening */
    }
}

/* ============================================================================
 * OSC OUTPUT (for network listeners)
 * ============================================================================ */

static int init_osc(void) {
    state.osc_fd = socket(AF_INET, SOCK_DGRAM, 0);
    if (state.osc_fd < 0) {
        perror("osc socket");
        return -1;
    }

    /* Enable multicast */
    int ttl = 1;
    setsockopt(state.osc_fd, IPPROTO_IP, IP_MULTICAST_TTL, &ttl, sizeof(ttl));

    memset(&state.osc_addr, 0, sizeof(state.osc_addr));
    state.osc_addr.sin_family = AF_INET;
    state.osc_addr.sin_port = htons(config.osc_port);
    inet_pton(AF_INET, config.osc_multicast, &state.osc_addr.sin_addr);

    fprintf(stderr, "OSC: %s:%d\n", config.osc_multicast, config.osc_port);
    return 0;
}

/*
 * Send OSC message: /midi/raw/cc/{channel}/{cc} {value}
 * Minimal OSC encoding - no external library needed
 */
static void send_osc_cc(int channel, int cc, int value) {
    if (state.osc_fd < 0) return;

    char buf[64];
    int len = 0;

    /* Address: /midi/raw/cc/CH/CC (null-padded to 4-byte boundary) */
    len = snprintf(buf, sizeof(buf), "/midi/raw/cc/%d/%d", channel, cc);
    int addr_len = ((len + 4) / 4) * 4;  /* Pad to 4 bytes */
    memset(buf + len, 0, addr_len - len);
    len = addr_len;

    /* Type tag: ,i (integer) */
    buf[len++] = ',';
    buf[len++] = 'i';
    buf[len++] = 0;
    buf[len++] = 0;  /* Pad to 4 bytes */

    /* Value: big-endian int32 */
    buf[len++] = (value >> 24) & 0xFF;
    buf[len++] = (value >> 16) & 0xFF;
    buf[len++] = (value >> 8) & 0xFF;
    buf[len++] = value & 0xFF;

    sendto(state.osc_fd, buf, len, 0,
           (struct sockaddr *)&state.osc_addr, sizeof(state.osc_addr));
}

/*
 * Send OSC float message: /gamepad/axis/{n} {value}
 * Full precision for 16-bit gamepad axes (-1.0 to 1.0)
 */
static void send_osc_axis(int axis, float value) {
    if (state.osc_fd < 0) return;

    char buf[64];
    int len = 0;

    /* Address: /gamepad/axis/N */
    len = snprintf(buf, sizeof(buf), "/gamepad/axis/%d", axis);
    int addr_len = ((len + 4) / 4) * 4;
    memset(buf + len, 0, addr_len - len);
    len = addr_len;

    /* Type tag: ,f (float) */
    buf[len++] = ',';
    buf[len++] = 'f';
    buf[len++] = 0;
    buf[len++] = 0;

    /* Value: big-endian float32 */
    union { float f; uint32_t i; } u;
    u.f = value;
    uint32_t be = htonl(u.i);
    memcpy(buf + len, &be, 4);
    len += 4;

    sendto(state.osc_fd, buf, len, 0,
           (struct sockaddr *)&state.osc_addr, sizeof(state.osc_addr));
}

/*
 * Send OSC trigger message: /quasar/trigger/{name}
 * No arguments - just the address pattern triggers the sound
 */
static void send_osc_trigger(const char *trigger_name) {
    if (state.osc_fd < 0) return;

    char buf[64];
    int len = 0;

    /* Address: /quasar/trigger/NAME */
    len = snprintf(buf, sizeof(buf), "/quasar/trigger/%s", trigger_name);
    int addr_len = ((len + 4) / 4) * 4;
    memset(buf + len, 0, addr_len - len);
    len = addr_len;

    /* Type tag: , (no arguments) */
    buf[len++] = ',';
    buf[len++] = 0;
    buf[len++] = 0;
    buf[len++] = 0;

    sendto(state.osc_fd, buf, len, 0,
           (struct sockaddr *)&state.osc_addr, sizeof(state.osc_addr));

    log_msg("TRIGGER: /quasar/trigger/%s\n", trigger_name);
}

/* ============================================================================
 * GAMEPAD INPUT (SDL2)
 * ============================================================================ */

static void list_gamepads(void) {
    printf("Gamepads:\n");
    int count = 0;
    for (int i = 0; i < SDL_NumJoysticks(); i++) {
        if (SDL_IsGameController(i)) {
            printf("  [%d] %s\n", i, SDL_GameControllerNameForIndex(i));
            count++;
        }
    }
    if (count == 0) {
        printf("  (none found)\n");
    }
}

static int init_gamepad(void) {
    if (SDL_Init(SDL_INIT_GAMECONTROLLER) != 0) {
        fprintf(stderr, "SDL_Init: %s\n", SDL_GetError());
        return -1;
    }

    /* Find first gamepad */
    for (int i = 0; i < SDL_NumJoysticks(); i++) {
        if (SDL_IsGameController(i)) {
            state.gamepad = SDL_GameControllerOpen(i);
            if (state.gamepad) {
                fprintf(stderr, "Gamepad: %s\n", SDL_GameControllerName(state.gamepad));
                return 0;
            }
        }
    }

    fprintf(stderr, "No gamepad found\n");
    return -1;
}

/* Button bit → Quasar trigger name mapping
 * Available triggers: pew boom clank pickup hit score engine_idle engine_rev
 */
static const struct {
    uint32_t bit;
    const char *trigger;
} button_triggers[] = {
    { 1u << 0,  "pew" },         /* A - laser pew */
    { 1u << 1,  "boom" },        /* B - explosion */
    { 1u << 2,  "clank" },       /* X - metal clank */
    { 1u << 3,  "pickup" },      /* Y - item pickup */
    { 1u << 11, "engine_rev" },  /* D-pad Up */
    { 1u << 12, "engine_idle" }, /* D-pad Down */
    { 1u << 13, "hit" },         /* D-pad Left */
    { 1u << 14, "score" },       /* D-pad Right */
    { 0, NULL }                  /* sentinel */
};

static void poll_gamepad(void) {
    if (!state.gamepad) return;

    SDL_GameControllerUpdate();

    /* Read axes */
    state.axes[0] = SDL_GameControllerGetAxis(state.gamepad, SDL_CONTROLLER_AXIS_LEFTX);
    state.axes[1] = SDL_GameControllerGetAxis(state.gamepad, SDL_CONTROLLER_AXIS_LEFTY);
    state.axes[2] = SDL_GameControllerGetAxis(state.gamepad, SDL_CONTROLLER_AXIS_RIGHTX);
    state.axes[3] = SDL_GameControllerGetAxis(state.gamepad, SDL_CONTROLLER_AXIS_RIGHTY);
    state.axes[4] = SDL_GameControllerGetAxis(state.gamepad, SDL_CONTROLLER_AXIS_TRIGGERLEFT);
    state.axes[5] = SDL_GameControllerGetAxis(state.gamepad, SDL_CONTROLLER_AXIS_TRIGGERRIGHT);

    /* Read buttons */
    uint32_t b = 0;
    b |= SDL_GameControllerGetButton(state.gamepad, SDL_CONTROLLER_BUTTON_A) ? (1u << 0) : 0;
    b |= SDL_GameControllerGetButton(state.gamepad, SDL_CONTROLLER_BUTTON_B) ? (1u << 1) : 0;
    b |= SDL_GameControllerGetButton(state.gamepad, SDL_CONTROLLER_BUTTON_X) ? (1u << 2) : 0;
    b |= SDL_GameControllerGetButton(state.gamepad, SDL_CONTROLLER_BUTTON_Y) ? (1u << 3) : 0;
    b |= SDL_GameControllerGetButton(state.gamepad, SDL_CONTROLLER_BUTTON_DPAD_UP) ? (1u << 11) : 0;
    b |= SDL_GameControllerGetButton(state.gamepad, SDL_CONTROLLER_BUTTON_DPAD_DOWN) ? (1u << 12) : 0;
    b |= SDL_GameControllerGetButton(state.gamepad, SDL_CONTROLLER_BUTTON_DPAD_LEFT) ? (1u << 13) : 0;
    b |= SDL_GameControllerGetButton(state.gamepad, SDL_CONTROLLER_BUTTON_DPAD_RIGHT) ? (1u << 14) : 0;

    /* Detect rising edges (new button presses) and send Quasar triggers */
    uint32_t pressed = b & ~state.prev_buttons;  /* Bits that just became 1 */
    if (pressed) {
        for (int i = 0; button_triggers[i].trigger != NULL; i++) {
            if (pressed & button_triggers[i].bit) {
                send_osc_trigger(button_triggers[i].trigger);
            }
        }
    }

    state.prev_buttons = state.buttons;
    state.buttons = b;

    /* Broadcast full-precision floats: /gamepad/axis/{0-5} */
    for (int i = 0; i < 6; i++) {
        float value;
        if (i < 4) {
            /* Sticks: -32768..32767 -> -1.0..1.0 */
            value = state.axes[i] / 32767.0f;
        } else {
            /* Triggers: 0..32767 -> 0.0..1.0 */
            value = state.axes[i] / 32767.0f;
        }
        send_osc_axis(i, value);
    }
}

/* ============================================================================
 * MIDI INPUT (CoreMIDI)
 * ============================================================================ */

static void list_midi_devices(void) {
    printf("MIDI Inputs:\n");
    ItemCount n = MIDIGetNumberOfSources();
    for (ItemCount i = 0; i < n; i++) {
        MIDIEndpointRef src = MIDIGetSource(i);
        CFStringRef name = NULL;
        MIDIObjectGetStringProperty(src, kMIDIPropertyName, &name);
        if (name) {
            char buf[256];
            CFStringGetCString(name, buf, sizeof(buf), kCFStringEncodingUTF8);
            printf("  [%lu] %s\n", (unsigned long)i, buf);
            CFRelease(name);
        }
    }
    if (n == 0) {
        printf("  (none found)\n");
    }
}

static void midi_read_proc(const MIDIPacketList *pktlist, void *readProcRefCon, void *srcConnRefCon) {
    (void)readProcRefCon;
    (void)srcConnRefCon;

    const MIDIPacket *pkt = &pktlist->packet[0];

    for (UInt32 i = 0; i < pktlist->numPackets; i++) {
        for (UInt16 j = 0; j < pkt->length; j++) {
            uint8_t byte = pkt->data[j];

            /* Look for CC messages (0xB0-0xBF) */
            if ((byte & 0xF0) == 0xB0) {
                int channel = (byte & 0x0F) + 1;
                if (j + 2 < pkt->length) {
                    int cc = pkt->data[j + 1];
                    int value = pkt->data[j + 2];

                    /* Check channel filter */
                    if (config.midi_channel != 0 && channel != config.midi_channel) {
                        j += 2;
                        continue;
                    }

                    /* Map CC to axis */
                    int axis_index = cc - config.cc_base;
                    if (axis_index >= 0 && axis_index < AXES_MAX) {
                        /* Convert 0-127 to int16 */
                        if (axis_index < 4) {
                            /* Sticks: 0..127 -> -32768..32767 */
                            state.axes[axis_index] = (int16_t)((value - 64) * 32767 / 63);
                        } else {
                            /* Triggers: 0..127 -> 0..32767 */
                            state.axes[axis_index] = (int16_t)(value * 32767 / 127);
                        }

                        log_msg("MIDI ch%d CC%d=%d -> axis[%d]=%d\n",
                                channel, cc, value, axis_index, state.axes[axis_index]);
                    }

                    /* Broadcast raw CC to OSC */
                    send_osc_cc(channel, cc, value);

                    /* Update tank fader state for stdout mode */
                    update_tank_fader(cc, value);

                    /* Immediate tank output on CC change */
                    process_tank_output();

                    j += 2;
                }
            }
        }
        pkt = MIDIPacketNext(pkt);
    }
}

static int init_midi(void) {
    OSStatus status;

    status = MIDIClientCreate(CFSTR("midi_bridge"), NULL, NULL, &state.midi_client);
    if (status != noErr) {
        fprintf(stderr, "MIDIClientCreate failed: %d\n", (int)status);
        return -1;
    }

    status = MIDIInputPortCreate(state.midi_client, CFSTR("Input"),
                                  midi_read_proc, NULL, &state.midi_port);
    if (status != noErr) {
        fprintf(stderr, "MIDIInputPortCreate failed: %d\n", (int)status);
        return -1;
    }

    /* Connect to all MIDI sources */
    ItemCount n = MIDIGetNumberOfSources();
    for (ItemCount i = 0; i < n; i++) {
        MIDIEndpointRef src = MIDIGetSource(i);
        MIDIPortConnectSource(state.midi_port, src, NULL);

        CFStringRef name = NULL;
        MIDIObjectGetStringProperty(src, kMIDIPropertyName, &name);
        if (name) {
            char buf[256];
            CFStringGetCString(name, buf, sizeof(buf), kCFStringEncodingUTF8);
            fprintf(stderr, "MIDI: %s\n", buf);
            CFRelease(name);
        }
    }

    if (n == 0) {
        fprintf(stderr, "No MIDI sources found\n");
        return -1;
    }

    return 0;
}

/* ============================================================================
 * MAIN LOOP
 * ============================================================================ */

static void main_loop(void) {
    fprintf(stderr, "Running (Ctrl+C to stop)...\n");

    while (running) {
        uint64_t now = now_ns();

        /* Poll SDL events (required for gamepad) */
        SDL_Event e;
        while (SDL_PollEvent(&e)) {
            if (e.type == SDL_QUIT) running = false;
        }

        /* Poll gamepad */
        if (config.enable_gamepad) {
            poll_gamepad();
        }

        /* MIDI is handled via callbacks, no polling needed */

        /* Send to local socket at fixed rate */
        if (now - state.last_send_ns >= state.send_interval_ns) {
            send_gp_msg();
            state.last_send_ns = now;

            if (config.verbose && state.seq % 500 == 0) {
                fprintf(stderr, "\rseq=%u axes=[%d,%d,%d,%d,%d,%d]    ",
                        state.seq,
                        state.axes[0], state.axes[1], state.axes[2],
                        state.axes[3], state.axes[4], state.axes[5]);
            }
        }

        /* Small sleep to avoid busy-waiting */
        usleep(500);  /* 0.5ms */
    }
}

static void cleanup(void) {
    if (state.gamepad) {
        SDL_GameControllerClose(state.gamepad);
    }
    SDL_Quit();

    if (state.midi_port) {
        MIDIPortDispose(state.midi_port);
    }
    if (state.midi_client) {
        MIDIClientDispose(state.midi_client);
    }

    if (state.socket_fd >= 0) close(state.socket_fd);
    if (state.osc_fd >= 0) close(state.osc_fd);
}

/* ============================================================================
 * CLI
 * ============================================================================ */

static void usage(const char *prog) {
    printf("Usage: %s [options]\n\n", prog);
    printf("Low-latency MIDI + Gamepad bridge\n\n");
    printf("Options:\n");
    printf("  -g          Enable gamepad input\n");
    printf("  -M          Enable MIDI input\n");
    printf("  -O          Output tank commands to stdout (for games)\n");
    printf("  -c FILE     Load controls.json mapping file\n");
    printf("  -s PATH     Unix socket path (default: %s)\n", config.socket_path);
    printf("  -p PORT     OSC UDP port (default: %d)\n", config.osc_port);
    printf("  -m GROUP    OSC multicast group (default: %s)\n", config.osc_multicast);
    printf("  -C CHANNEL  MIDI channel filter (1-16, default: all)\n");
    printf("  -b CC       MIDI CC base number (default: %d)\n", config.cc_base);
    printf("  -v          Verbose output\n");
    printf("  -l          List devices and exit\n");
    printf("  -h          Show this help\n");
    printf("\n");
    printf("Tank CC assignments (env vars or controls.json):\n");
    printf("  P1_LEFT=%d  P1_RIGHT=%d  P2_LEFT=%d  P2_RIGHT=%d\n",
           config.p1_left_cc, config.p1_right_cc, config.p2_left_cc, config.p2_right_cc);
    printf("\n");
    printf("Examples:\n");
    printf("  %s -g -M -v                  # Both inputs, verbose\n", prog);
    printf("  %s -M -O | trax              # MIDI to trax tank control\n", prog);
    printf("  %s -M -O -c controls.json    # Load mappings from JSON\n", prog);
    printf("\n");
    printf("Latency: ~2-3ms (vs ~20-40ms with Node.js)\n");
}

int main(int argc, char **argv) {
    /* Load CC assignments from environment */
    char *env;
    if ((env = getenv("P1_LEFT"))) config.p1_left_cc = atoi(env);
    if ((env = getenv("P1_RIGHT"))) config.p1_right_cc = atoi(env);
    if ((env = getenv("P2_LEFT"))) config.p2_left_cc = atoi(env);
    if ((env = getenv("P2_RIGHT"))) config.p2_right_cc = atoi(env);

    int opt;
    while ((opt = getopt(argc, argv, "gMOc:s:p:m:C:b:vlh")) != -1) {
        switch (opt) {
            case 'g': config.enable_gamepad = true; break;
            case 'M': config.enable_midi = true; break;
            case 'O': config.stdout_output = true; break;
            case 'c': strncpy(config.map_file, optarg, sizeof(config.map_file) - 1); break;
            case 's': strncpy(config.socket_path, optarg, sizeof(config.socket_path) - 1); break;
            case 'p': config.osc_port = atoi(optarg); break;
            case 'm': strncpy(config.osc_multicast, optarg, sizeof(config.osc_multicast) - 1); break;
            case 'C': config.midi_channel = atoi(optarg); break;
            case 'b': config.cc_base = atoi(optarg); break;
            case 'v': config.verbose = true; break;
            case 'l': config.list_devices = true; break;
            case 'h':
            default:
                usage(argv[0]);
                return opt == 'h' ? 0 : 1;
        }
    }

    /* Load controls.json if specified */
    if (config.map_file[0] != '\0') {
        if (load_controls_json(config.map_file) < 0) {
            fprintf(stderr, "Warning: failed to load %s, using defaults\n", config.map_file);
        }
    }

    if (config.list_devices) {
        SDL_Init(SDL_INIT_GAMECONTROLLER);
        list_gamepads();
        printf("\n");
        list_midi_devices();
        SDL_Quit();
        return 0;
    }

    if (!config.enable_gamepad && !config.enable_midi) {
        fprintf(stderr, "No input enabled. Use -g for gamepad, -M for MIDI.\n");
        return 1;
    }

    signal(SIGINT, handle_signal);
    signal(SIGTERM, handle_signal);

    fprintf(stderr, "midi_bridge starting...\n");

    if (config.stdout_output) {
        fprintf(stderr, "Tank stdout mode: P1=CC%d,%d  P2=CC%d,%d\n",
                config.p1_left_cc, config.p1_right_cc,
                config.p2_left_cc, config.p2_right_cc);
    }

    /* Initialize outputs */
    if (init_socket() < 0) return 1;
    if (init_osc() < 0) return 1;

    /* Initialize inputs */
    if (config.enable_gamepad) {
        if (init_gamepad() < 0) {
            fprintf(stderr, "Gamepad init failed, continuing without it\n");
            config.enable_gamepad = false;
        }
    }

    if (config.enable_midi) {
        if (init_midi() < 0) {
            fprintf(stderr, "MIDI init failed, continuing without it\n");
            config.enable_midi = false;
        }
    }

    if (!config.enable_gamepad && !config.enable_midi) {
        fprintf(stderr, "No inputs available\n");
        cleanup();
        return 1;
    }

    main_loop();

    fprintf(stderr, "\nShutting down...\n");
    cleanup();
    return 0;
}

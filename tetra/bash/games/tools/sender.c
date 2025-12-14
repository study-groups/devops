// sender.c — "gamepad feeder" (SDL2 → Unix domain datagram)
// deps: brew install sdl2
// build: clang sender.c -o sender `pkg-config --cflags --libs sdl2`
// run:   ./sender /tmp/gamepad.sock 0

#define _DARWIN_C_SOURCE
#include <SDL.h>
#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <unistd.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <time.h>
#include <errno.h>
#include <signal.h>

#define AXES_MAX 6

struct gp_msg {
    uint32_t version;     // = 1
    uint32_t player_id;
    uint32_t seq;
    uint32_t buttons;     // bitfield
    int16_t  axes[AXES_MAX]; // [-32768,32767] : LX, LY, RX, RY, LT, RT
    uint16_t n_axes;
    uint64_t t_mono_ns;   // CLOCK_MONOTONIC at send time
};

static volatile int running = 1;

static void handle_signal(int sig) {
    (void)sig;
    running = 0;
}

static uint64_t now_ns(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (uint64_t)ts.tv_sec*1000000000ull + (uint64_t)ts.tv_nsec;
}

static int open_dgram(const char *path, struct sockaddr_un *dst) {
    int fd = socket(AF_UNIX, SOCK_DGRAM, 0);
    if (fd < 0) { perror("socket"); return -1; }
    memset(dst, 0, sizeof(*dst));
    dst->sun_family = AF_UNIX;
    strncpy(dst->sun_path, path, sizeof(dst->sun_path)-1);
    return fd;
}

// Map SDL state to bitfield and axes
static void read_state(SDL_GameController *gc, uint32_t *buttons, int16_t axes[AXES_MAX]) {
    uint32_t b = 0;
    b |= SDL_GameControllerGetButton(gc, SDL_CONTROLLER_BUTTON_A)      ? (1u<<0) : 0;
    b |= SDL_GameControllerGetButton(gc, SDL_CONTROLLER_BUTTON_B)      ? (1u<<1) : 0;
    b |= SDL_GameControllerGetButton(gc, SDL_CONTROLLER_BUTTON_X)      ? (1u<<2) : 0;
    b |= SDL_GameControllerGetButton(gc, SDL_CONTROLLER_BUTTON_Y)      ? (1u<<3) : 0;
    b |= SDL_GameControllerGetButton(gc, SDL_CONTROLLER_BUTTON_LEFTSHOULDER)  ? (1u<<4) : 0;
    b |= SDL_GameControllerGetButton(gc, SDL_CONTROLLER_BUTTON_RIGHTSHOULDER) ? (1u<<5) : 0;
    b |= SDL_GameControllerGetButton(gc, SDL_CONTROLLER_BUTTON_BACK)   ? (1u<<6) : 0;
    b |= SDL_GameControllerGetButton(gc, SDL_CONTROLLER_BUTTON_START)  ? (1u<<7) : 0;
    b |= SDL_GameControllerGetButton(gc, SDL_CONTROLLER_BUTTON_GUIDE)  ? (1u<<8) : 0;
    b |= SDL_GameControllerGetButton(gc, SDL_CONTROLLER_BUTTON_LEFTSTICK)  ? (1u<<9) : 0;
    b |= SDL_GameControllerGetButton(gc, SDL_CONTROLLER_BUTTON_RIGHTSTICK) ? (1u<<10): 0;
    // D-pad as buttons
    b |= SDL_GameControllerGetButton(gc, SDL_CONTROLLER_BUTTON_DPAD_UP)    ? (1u<<11):0;
    b |= SDL_GameControllerGetButton(gc, SDL_CONTROLLER_BUTTON_DPAD_DOWN)  ? (1u<<12):0;
    b |= SDL_GameControllerGetButton(gc, SDL_CONTROLLER_BUTTON_DPAD_LEFT)  ? (1u<<13):0;
    b |= SDL_GameControllerGetButton(gc, SDL_CONTROLLER_BUTTON_DPAD_RIGHT) ? (1u<<14):0;

    *buttons = b;

    axes[0] = SDL_GameControllerGetAxis(gc, SDL_CONTROLLER_AXIS_LEFTX);
    axes[1] = SDL_GameControllerGetAxis(gc, SDL_CONTROLLER_AXIS_LEFTY);
    axes[2] = SDL_GameControllerGetAxis(gc, SDL_CONTROLLER_AXIS_RIGHTX);
    axes[3] = SDL_GameControllerGetAxis(gc, SDL_CONTROLLER_AXIS_RIGHTY);
    axes[4] = SDL_GameControllerGetAxis(gc, SDL_CONTROLLER_AXIS_TRIGGERLEFT);
    axes[5] = SDL_GameControllerGetAxis(gc, SDL_CONTROLLER_AXIS_TRIGGERRIGHT);
}

int main(int argc, char **argv) {
    if (argc < 2 || argc > 3) {
        fprintf(stderr, "usage: %s /tmp/gamepad.sock [player_id]\n", argv[0]);
        fprintf(stderr, "  player_id defaults to 0\n");
        return 2;
    }
    const char *sockpath = argv[1];
    uint32_t player_id = (argc == 3) ? (uint32_t)strtoul(argv[2], NULL, 10) : 0;

    signal(SIGINT, handle_signal);
    signal(SIGTERM, handle_signal);

    if (SDL_Init(SDL_INIT_VIDEO | SDL_INIT_GAMECONTROLLER | SDL_INIT_HAPTIC) != 0) {
        fprintf(stderr, "SDL_Init: %s\n", SDL_GetError());
        return 1;
    }

    fprintf(stderr, "Scanning for game controllers...\n");
    int idx = -1;
    for (int i = 0; i < SDL_NumJoysticks(); i++) {
        if (SDL_IsGameController(i)) {
            SDL_GameController *gc = SDL_GameControllerOpen(i);
            if (gc) {
                const char *name = SDL_GameControllerName(gc);
                fprintf(stderr, "  [%d] %s\n", i, name ? name : "Unknown");
                if (idx < 0) idx = i; // Use first found
                SDL_GameControllerClose(gc);
            }
        }
    }

    if (idx < 0) {
        fprintf(stderr, "ERROR: No game controller found\n");
        fprintf(stderr, "  - Make sure gamepad is connected\n");
        fprintf(stderr, "  - Check with: system_profiler SPUSBDataType | grep -i game\n");
        return 1;
    }

    SDL_GameController *gc = SDL_GameControllerOpen(idx);
    if (!gc) {
        fprintf(stderr, "ERROR: Cannot open controller: %s\n", SDL_GetError());
        return 1;
    }

    const char *name = SDL_GameControllerName(gc);
    fprintf(stderr, "Using controller: %s (player_id=%u)\n", name ? name : "Unknown", player_id);

    struct sockaddr_un dst;
    int fd = open_dgram(sockpath, &dst);
    if (fd < 0) {
        SDL_GameControllerClose(gc);
        SDL_Quit();
        return 1;
    }

    fprintf(stderr, "Sending to: %s\n", sockpath);
    fprintf(stderr, "Press Ctrl+C to exit\n\n");

    struct gp_msg msg = { .version = 1, .player_id = player_id, .seq = 0, .n_axes = AXES_MAX };

    uint32_t last_buttons = 0xffffffffu;
    int16_t  last_axes[AXES_MAX] = {0};
    memset(last_axes, 0x7f, sizeof(last_axes)); // force first send

    uint32_t last_send_ms = 0;
    uint32_t packets_sent = 0;

    while (running) {
        SDL_Event e;
        while (SDL_PollEvent(&e)) {
            if (e.type == SDL_QUIT) running = 0;
        }

        uint32_t buttons;
        int16_t axes[AXES_MAX];
        read_state(gc, &buttons, axes);

        // Change detection or heartbeat at 50 ms
        uint32_t now_ms = SDL_GetTicks();
        int changed = (buttons != last_buttons);
        for (int i = 0; i < AXES_MAX && !changed; i++) {
            if (axes[i] != last_axes[i]) changed = 1;
        }

        if (changed || (now_ms - last_send_ms) >= 50) {
            msg.seq++;
            msg.buttons = buttons;
            memcpy(msg.axes, axes, sizeof(axes));
            msg.t_mono_ns = now_ns();

            ssize_t n = sendto(fd, &msg, sizeof(msg), 0, (struct sockaddr*)&dst, sizeof(dst));
            if (n != sizeof(msg)) {
                perror("sendto");
            } else {
                packets_sent++;
                if (packets_sent % 100 == 0) {
                    fprintf(stderr, "\rPackets sent: %u (seq=%u)", packets_sent, msg.seq);
                    fflush(stderr);
                }
            }

            last_buttons = buttons;
            memcpy(last_axes, axes, sizeof(axes));
            last_send_ms = now_ms;
        }

        SDL_Delay(2); // ~500 Hz poll
    }

    fprintf(stderr, "\n\nShutting down...\n");
    fprintf(stderr, "Total packets sent: %u\n", packets_sent);

    close(fd);
    SDL_GameControllerClose(gc);
    SDL_Quit();
    return 0;
}

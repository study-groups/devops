/*
 * input.c - Input handling (keyboard, gamepad)
 */

#include "input.h"
#include "utils.h"
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <math.h>

/* Initialize input manager */
int input_init(InputManager *input) {
    memset(input, 0, sizeof(InputManager));
    input->tty_fd = -1;
    input->gamepad_sock = -1;
    input->kbd_sim_enabled = 1;  /* Enable by default */
    return 0;
}

/* Cleanup input manager */
void input_cleanup(InputManager *input) {
    if (input->tty_fd >= 0) {
        input_disable_raw_mode(input);
        close(input->tty_fd);
        input->tty_fd = -1;
    }

    if (input->gamepad_sock >= 0) {
        close(input->gamepad_sock);
        input->gamepad_sock = -1;
    }
}

/* Enable raw terminal mode */
void input_enable_raw_mode(InputManager *input) {
    if (input->tty_fd < 0) {
        /* Try /dev/tty first, fall back to stdin if not available */
        input->tty_fd = open("/dev/tty", O_RDONLY | O_NONBLOCK);
        if (input->tty_fd < 0) {
            /* No /dev/tty, try stdin (fd 0) */
            input->tty_fd = dup(STDIN_FILENO);
            if (input->tty_fd < 0) return;
            /* Make it non-blocking */
            int flags = fcntl(input->tty_fd, F_GETFL, 0);
            fcntl(input->tty_fd, F_SETFL, flags | O_NONBLOCK);
        }
    }

    tcgetattr(input->tty_fd, &input->orig_termios);
    struct termios raw = input->orig_termios;
    raw.c_lflag &= ~(ECHO | ICANON);
    raw.c_cc[VMIN] = 0;
    raw.c_cc[VTIME] = 0;
    tcsetattr(input->tty_fd, TCSANOW, &raw);

    /* Set fd to non-blocking */
    int flags = fcntl(input->tty_fd, F_GETFL, 0);
    fcntl(input->tty_fd, F_SETFL, flags | O_NONBLOCK);
}

/* Disable raw terminal mode */
void input_disable_raw_mode(InputManager *input) {
    if (input->tty_fd >= 0) {
        tcsetattr(input->tty_fd, TCSANOW, &input->orig_termios);

        /* Restore fd to blocking */
        int flags = fcntl(input->tty_fd, F_GETFL, 0);
        fcntl(input->tty_fd, F_SETFL, flags & ~O_NONBLOCK);
    }
}

/* Open gamepad socket */
int input_open_gamepad_socket(InputManager *input, const char *path) {
    /* Remove old socket file if exists */
    unlink(path);

    int fd = socket(AF_UNIX, SOCK_DGRAM, 0);
    if (fd < 0) return -1;

    /* Make non-blocking */
    int flags = fcntl(fd, F_GETFL, 0);
    fcntl(fd, F_SETFL, flags | O_NONBLOCK);

    struct sockaddr_un addr;
    memset(&addr, 0, sizeof(addr));
    addr.sun_family = AF_UNIX;
    strncpy(addr.sun_path, path, sizeof(addr.sun_path) - 1);

    if (bind(fd, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
        close(fd);
        return -1;
    }

    /* Increase receive buffer */
    int rcvbuf = 256 * 1024;
    setsockopt(fd, SOL_SOCKET, SO_RCVBUF, &rcvbuf, sizeof(rcvbuf));

    input->gamepad_sock = fd;
    return 0;
}

/* Process one gamepad datagram */
static void process_gamepad_datagram(InputManager *input, const struct gp_msg *msg) {
    if (msg->version != 1) return;

    uint32_t player = msg->player_id;
    if (player >= MAX_PLAYERS) return;

    /* Update state */
    input->gamepads[player].buttons = msg->buttons;
    input->gamepads[player].last_seq = msg->seq;
    input->gamepads[player].last_update_ns = now_ns();

    /* Normalize axes */
    for (int i = 0; i < AXES_MAX && i < msg->n_axes; i++) {
        input->gamepads[player].axes[i] = msg->axes[i] / 32767.0f;
    }

    /* Log button changes */
    static uint32_t last_logged_buttons[MAX_PLAYERS] = {0};
    if (msg->buttons != last_logged_buttons[player]) {
        char event_data[64];
        snprintf(event_data, sizeof(event_data), "btn=%08x seq=%u",
                 msg->buttons, msg->seq);
        log_event("GAMEPAD", player, event_data);
        last_logged_buttons[player] = msg->buttons;
    }

    /* Log axis movements with debouncing */
    uint64_t now = now_ns();
    uint64_t time_since_last_log = now - input->last_axis_log_time[player];

    float mag = sqrtf(input->gamepads[player].axes[0] * input->gamepads[player].axes[0] +
                      input->gamepads[player].axes[1] * input->gamepads[player].axes[1]);

    if (mag > 0.3f && time_since_last_log > 100000000ULL) {
        float delta = 0.0f;
        for (int i = 0; i < 4; i++) {
            float d = fabsf(input->gamepads[player].axes[i] -
                           input->last_logged_axes[player][i]);
            if (d > delta) delta = d;
        }

        if (delta > 0.1f) {
            char event_data[64];
            snprintf(event_data, sizeof(event_data), "L[%.2f,%.2f] R[%.2f,%.2f]",
                     input->gamepads[player].axes[0], input->gamepads[player].axes[1],
                     input->gamepads[player].axes[2], input->gamepads[player].axes[3]);
            log_event("GAMEPAD", player, event_data);

            for (int i = 0; i < AXES_MAX; i++) {
                input->last_logged_axes[player][i] = input->gamepads[player].axes[i];
            }
            input->last_axis_log_time[player] = now;
        }
    }
}

/* Poll gamepad input (non-blocking) */
void input_poll_gamepad(InputManager *input) {
    if (input->gamepad_sock < 0) return;

    struct gp_msg msg;
    struct sockaddr_un peer;
    socklen_t plen = sizeof(peer);

    /* Read all available datagrams */
    while (1) {
        ssize_t n = recvfrom(input->gamepad_sock, &msg, sizeof(msg), 0,
                            (struct sockaddr*)&peer, &plen);

        if (n < 0) {
            if (errno == EAGAIN || errno == EWOULDBLOCK) break;
            if (errno == EINTR) continue;
            break;
        }

        if ((size_t)n < sizeof(struct gp_msg)) continue;

        process_gamepad_datagram(input, &msg);
    }
}

/* Update keyboard->gamepad simulation */
void input_update_keyboard_simulation(InputManager *input) {
    if (!input->kbd_sim_enabled) return;

    /* Calculate synthetic axes */
    float left_x = 0.0f, left_y = 0.0f;
    float right_x = 0.0f, right_y = 0.0f;

    /* Left stick from WASD */
    if (input->kbd_state.d) left_x += 1.0f;
    if (input->kbd_state.a) left_x -= 1.0f;
    if (input->kbd_state.s) left_y += 1.0f;
    if (input->kbd_state.w) left_y -= 1.0f;

    /* Right stick from IJKL */
    if (input->kbd_state.l) right_x += 1.0f;
    if (input->kbd_state.j) right_x -= 1.0f;
    if (input->kbd_state.k) right_y += 1.0f;
    if (input->kbd_state.i) right_y -= 1.0f;

    /* Normalize diagonal movement */
    float left_mag = sqrtf(left_x * left_x + left_y * left_y);
    if (left_mag > 1.0f) {
        left_x /= left_mag;
        left_y /= left_mag;
    }
    float right_mag = sqrtf(right_x * right_x + right_y * right_y);
    if (right_mag > 1.0f) {
        right_x /= right_mag;
        right_y /= right_mag;
    }

    /* Update Player 0 gamepad state */
    input->gamepads[0].axes[0] = left_x;
    input->gamepads[0].axes[1] = left_y;
    input->gamepads[0].axes[2] = right_x;
    input->gamepads[0].axes[3] = right_y;
    input->gamepads[0].axes[4] = 0.0f;
    input->gamepads[0].axes[5] = 0.0f;

    /* Button simulation */
    uint32_t buttons = 0;
    if (input->kbd_state.space) buttons |= (1u << 0);
    input->gamepads[0].buttons = buttons;
    input->gamepads[0].last_update_ns = now_ns();
}

/* Read keyboard input (non-blocking) */
char input_read_keyboard(InputManager *input) {
    if (input->tty_fd < 0) return 0;

    char c;
    if (read(input->tty_fd, &c, 1) > 0) {
        return c;
    }
    return 0;
}

/* Process keyboard key (update state) */
void input_process_key(InputManager *input, char key) {
    /* Update keyboard state for WASD/IJKL */
    if (key == 'w' || key == 'W') input->kbd_state.w = 1;
    else if (key == 'a' || key == 'A') input->kbd_state.a = 1;
    else if (key == 's' || key == 'S') input->kbd_state.s = 1;
    else if (key == 'd' || key == 'D') input->kbd_state.d = 1;
    else if (key == 'i' || key == 'I') input->kbd_state.i = 1;
    else if (key == 'j' || key == 'J') input->kbd_state.j = 1;
    else if (key == 'k' || key == 'K') input->kbd_state.k = 1;
    else if (key == 'l' || key == 'L') input->kbd_state.l = 1;
    else if (key == ' ') input->kbd_state.space = 1;

    /* Log keyboard events (with debouncing) */
    if (key != input->last_key_pressed) {
        char kbd_event[64];
        snprintf(kbd_event, sizeof(kbd_event), "key='%c' (0x%02x)",
                 (key >= 32 && key < 127) ? key : '?', (unsigned char)key);
        log_event("KEYBOARD", 0, kbd_event);
        input->last_key_pressed = key;
        input->last_key_time_ns = now_ns();
    }
}

/* Get gamepad state for player */
const GamepadState* input_get_gamepad(const InputManager *input, int player) {
    if (player < 0 || player >= MAX_PLAYERS) return NULL;
    return &input->gamepads[player];
}

/*
 * input.h - Input handling (keyboard, gamepad)
 */

#ifndef INPUT_H
#define INPUT_H

#include "types.h"
#include <termios.h>

/* Input manager state */
typedef struct {
    int tty_fd;                    /* TTY file descriptor for input */
    struct termios orig_termios;   /* Original terminal settings */
    int gamepad_sock;              /* Unix domain datagram socket */
    int kbd_sim_enabled;           /* Keyboard simulation enabled */
    KeyboardState kbd_state;       /* Current keyboard state */
    char last_key_pressed;         /* Last key for debouncing */
    uint64_t last_key_time_ns;     /* Time of last key press */
    GamepadState gamepads[MAX_PLAYERS];
    float last_logged_axes[MAX_PLAYERS][AXES_MAX];
    uint64_t last_axis_log_time[MAX_PLAYERS];
} InputManager;

/* Initialize input manager */
int input_init(InputManager *input);

/* Cleanup input manager */
void input_cleanup(InputManager *input);

/* Enable raw terminal mode */
void input_enable_raw_mode(InputManager *input);

/* Disable raw terminal mode */
void input_disable_raw_mode(InputManager *input);

/* Open gamepad socket */
int input_open_gamepad_socket(InputManager *input, const char *path);

/* Poll gamepad input (non-blocking) */
void input_poll_gamepad(InputManager *input);

/* Update keyboard->gamepad simulation */
void input_update_keyboard_simulation(InputManager *input);

/* Read keyboard input (non-blocking, returns key or 0) */
char input_read_keyboard(InputManager *input);

/* Process keyboard key (update state) */
void input_process_key(InputManager *input, char key);

/* Get gamepad state for player */
const GamepadState* input_get_gamepad(const InputManager *input, int player);

#endif /* INPUT_H */

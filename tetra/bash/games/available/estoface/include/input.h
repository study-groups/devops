/*
 * input.h - Terminal input handling
 */

#ifndef ESTOFACE_INPUT_H
#define ESTOFACE_INPUT_H

#include "types.h"
#include <termios.h>

/* Terminal state */
typedef struct {
    struct termios orig_termios;  /* Original terminal settings */
    int tty_fd;                   /* TTY file descriptor */
} TerminalState;

/* Initialize terminal for raw input */
int input_init(TerminalState *term);

/* Restore terminal to original state */
void input_cleanup(TerminalState *term);

/* Read a single key (non-blocking, returns '\0' if no key available) */
char input_read_key(TerminalState *term);

/* Handle interactive mode key press */
void input_handle_interactive(EstofaceContext *ctx, char key);

#endif /* ESTOFACE_INPUT_H */

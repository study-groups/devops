/*
 * input.c - Terminal input handling
 */

#include "input.h"
#include "state.h"
#include "panels.h"
#include <unistd.h>
#include <fcntl.h>
#include <stdio.h>

#define KEY_STEP 0.1f

/* Initialize terminal for raw input */
int input_init(TerminalState *term) {
    /* Open TTY */
    term->tty_fd = open("/dev/tty", O_RDWR);
    if (term->tty_fd < 0) {
        return -1;
    }
    
    /* Save original terminal settings */
    if (tcgetattr(term->tty_fd, &term->orig_termios) < 0) {
        close(term->tty_fd);
        return -1;
    }
    
    /* Set raw mode */
    struct termios raw = term->orig_termios;
    raw.c_lflag &= ~(ECHO | ICANON | ISIG);
    raw.c_cc[VMIN] = 0;   /* Non-blocking read */
    raw.c_cc[VTIME] = 0;  /* No timeout */
    
    if (tcsetattr(term->tty_fd, TCSANOW, &raw) < 0) {
        close(term->tty_fd);
        return -1;
    }
    
    return 0;
}

/* Restore terminal to original state */
void input_cleanup(TerminalState *term) {
    if (term->tty_fd >= 0) {
        tcsetattr(term->tty_fd, TCSANOW, &term->orig_termios);
        close(term->tty_fd);
        term->tty_fd = -1;
    }
}

/* Read a single key (non-blocking) */
char input_read_key(TerminalState *term) {
    char c = '\0';
    read(term->tty_fd, &c, 1);
    return c;
}

/* Handle interactive mode key press */
void input_handle_interactive(EstofaceContext *ctx, char key) {
    FacialState *state = &ctx->current;
    
    switch (key) {
        /* Tongue height (WS) - W=up, S=down */
        case 'w': case 'W':
            state->tongue_height = state_clamp(state->tongue_height + KEY_STEP);
            break;
        case 's': case 'S':
            state->tongue_height = state_clamp(state->tongue_height - KEY_STEP);
            break;

        /* Tongue frontness (AD) - A=back, D=forward */
        case 'a': case 'A':
            state->tongue_frontness = state_clamp(state->tongue_frontness - KEY_STEP);
            break;
        case 'd': case 'D':
            state->tongue_frontness = state_clamp(state->tongue_frontness + KEY_STEP);
            break;

        /* Jaw openness (IK) - I=close (pout automatic), K=open
         * Pout is now automatically tied to jaw position in mouth rendering */
        case 'i': case 'I':
            state->jaw_openness = state_clamp(state->jaw_openness - KEY_STEP);
            break;
        case 'k': case 'K':
            state->jaw_openness = state_clamp(state->jaw_openness + KEY_STEP);
            break;

        /* Lip protrusion (JL) - J=retract, L=protrude */
        case 'j': case 'J':
            state->lip_protrusion = state_clamp(state->lip_protrusion - KEY_STEP);
            break;
        case 'l': case 'L':
            state->lip_protrusion = state_clamp(state->lip_protrusion + KEY_STEP);
            break;

        /* Lip control (UO) - U=rounding, O=corner height */
        case 'u': case 'U':
            state->lip_rounding = state_clamp(state->lip_rounding + KEY_STEP);
            break;
        case 'o': case 'O':
            state->lip_corner_height = state_clamp(state->lip_corner_height + KEY_STEP);
            break;
            
        /* Reset */
        case 'r': case 'R':
            state_reset(state);
            break;
            
        /* Mode switch */
        case ':':
            ctx->mode = MODE_COMMAND;
            break;

        /* Toggle panels (1-5) */
        case '1':
            panels_toggle(ctx->panels, 0);
            break;
        case '2':
            panels_toggle(ctx->panels, 1);
            break;
        case '3':
            panels_toggle(ctx->panels, 2);
            break;
        case '4':
            panels_toggle(ctx->panels, 3);
            break;
        case '5':
            panels_toggle(ctx->panels, 4);
            break;
    }
}

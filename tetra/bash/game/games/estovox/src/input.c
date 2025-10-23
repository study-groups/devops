/*
 * input.c - Terminal input handling
 */

#include "input.h"
#include "state.h"
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
void input_handle_interactive(EstovoxContext *ctx, char key) {
    FacialState *state = &ctx->current;
    
    switch (key) {
        /* Jaw control (WASD) */
        case 'w': case 'W':
            state->jaw_openness = state_clamp(state->jaw_openness - KEY_STEP);
            break;
        case 's': case 'S':
            state->jaw_openness = state_clamp(state->jaw_openness + KEY_STEP);
            break;
            
        /* Tongue height (IK) */
        case 'i': case 'I':
            state->tongue_height = state_clamp(state->tongue_height + KEY_STEP);
            break;
        case 'k': case 'K':
            state->tongue_height = state_clamp(state->tongue_height - KEY_STEP);
            break;
            
        /* Tongue frontness (JL) */
        case 'j': case 'J':
            state->tongue_frontness = state_clamp(state->tongue_frontness - KEY_STEP);
            break;
        case 'l': case 'L':
            state->tongue_frontness = state_clamp(state->tongue_frontness + KEY_STEP);
            break;
            
        /* Lip control (QE) */
        case 'q': case 'Q':
            state->lip_rounding = state_clamp(state->lip_rounding + KEY_STEP);
            break;
        case 'e': case 'E':
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
            
        /* Quick vowels (1-5) */
        case '1':
            /* TODO: Apply 'i' phoneme */
            break;
        case '2':
            /* TODO: Apply 'e' phoneme */
            break;
        case '3':
            /* TODO: Apply 'a' phoneme */
            break;
        case '4':
            /* TODO: Apply 'o' phoneme */
            break;
        case '5':
            /* TODO: Apply 'u' phoneme */
            break;
    }
}

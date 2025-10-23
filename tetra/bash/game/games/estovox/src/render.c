/*
 * render.c - TUI rendering system
 */

#include "render.h"
#include <stdio.h>
#include <unistd.h>
#include <sys/ioctl.h>

/* ANSI escape codes */
#define ESC "\x1b"
#define CSI ESC "["

/* Terminal control sequences */
#define CLEAR_SCREEN CSI "2J"
#define HIDE_CURSOR CSI "?25l"
#define SHOW_CURSOR CSI "?25h"
#define ALT_SCREEN CSI "?1049h"
#define NORMAL_SCREEN CSI "?1049l"
#define MOVE_HOME CSI "H"

/* Initialize terminal for rendering */
void render_init(int *cols, int *rows) {
    /* Enter alternate screen buffer */
    printf(ALT_SCREEN);
    
    /* Hide cursor */
    printf(HIDE_CURSOR);
    
    /* Clear screen */
    printf(CLEAR_SCREEN MOVE_HOME);
    
    /* Get terminal size */
    struct winsize ws;
    if (ioctl(STDOUT_FILENO, TIOCGWINSZ, &ws) == 0) {
        *cols = ws.ws_col;
        *rows = ws.ws_row;
    } else {
        *cols = 80;
        *rows = 24;
    }
    
    fflush(stdout);
}

/* Cleanup and restore terminal */
void render_cleanup(void) {
    /* Show cursor */
    printf(SHOW_CURSOR);
    
    /* Return to normal screen */
    printf(NORMAL_SCREEN);
    
    fflush(stdout);
}

/* Move cursor to position */
static void move_cursor(int row, int col) {
    printf(CSI "%d;%dH", row, col);
}

/* Clear current line */
static void clear_line(void) {
    printf(CSI "K");
}

/* Get eyebrow character based on height */
char render_get_eyebrow_char(float height, int is_left) {
    if (height < 0.3f) return '_';      /* Low */
    if (height > 0.7f) return '^';      /* Raised */
    return is_left ? '/' : '\\';        /* Normal */
}

/* Get eye character based on openness */
char render_get_eye_char(float openness) {
    if (openness < 0.3f) return '-';    /* Closed */
    if (openness > 0.7f) return 'O';    /* Wide open */
    return 'o';                          /* Normal */
}

/* Get mouth shape character based on jaw/lip state */
char render_get_mouth_char(const FacialState *state) {
    float jaw = state->jaw_openness;
    float corners = state->lip_corner_height;
    float rounding = state->lip_rounding;
    
    /* Closed mouth variants */
    if (jaw < 0.2f) {
        if (corners > 0.7f) return '_';     /* Smile */
        if (corners < 0.3f) return '^';     /* Frown */
        if (rounding > 0.5f) return 'o';    /* Rounded */
        return '-';                          /* Neutral */
    }
    
    /* Open mouth variants */
    if (jaw > 0.5f) {
        if (rounding > 0.5f) return 'O';    /* Rounded open */
        return 'D';                          /* Wide open */
    }
    
    /* Mid-open variants */
    if (corners > 0.7f) return 'u';         /* Slight smile */
    if (rounding > 0.5f) return 'o';        /* Rounded */
    return 'o';                              /* Neutral open */
}

/* Render face based on current state */
void render_face(const FacialState *state, int center_x, int center_y) {
    char eyebrow_l = render_get_eyebrow_char(state->eyebrow_l_height, 1);
    char eyebrow_r = render_get_eyebrow_char(state->eyebrow_r_height, 0);
    char eye_l = render_get_eye_char(state->eye_l_openness);
    char eye_r = render_get_eye_char(state->eye_r_openness);
    char mouth = render_get_mouth_char(state);
    
    /* Eyebrows */
    move_cursor(center_y - 3, center_x - 12);
    printf("%c%c%c", eyebrow_l, eyebrow_l, eyebrow_l);
    
    move_cursor(center_y - 3, center_x + 10);
    printf("%c%c%c", eyebrow_r, eyebrow_r, eyebrow_r);
    
    /* Eyes */
    move_cursor(center_y, center_x - 10);
    printf("%c", eye_l);
    
    move_cursor(center_y, center_x + 10);
    printf("%c", eye_r);
    
    /* Mouth */
    move_cursor(center_y + 4, center_x);
    printf("%c", mouth);
}

/* Render status bar with parameter values */
void render_status(const FacialState *state, int row) {
    move_cursor(row, 1);
    clear_line();
    printf("JAW:%.3f RND:%.3f CRN:%.3f TNG_H:%.3f TNG_F:%.3f",
           state->jaw_openness,
           state->lip_rounding,
           state->lip_corner_height,
           state->tongue_height,
           state->tongue_frontness);
}

/* Render mode indicator bar */
void render_mode_bar(EngineMode mode, int row) {
    move_cursor(row, 1);
    clear_line();
    
    if (mode == MODE_INTERACTIVE) {
        printf("INTERACTIVE - WS:Jaw IK:Tongue JL:TngFB QE:Lips R:Reset ::Cmd");
    } else {
        printf("COMMAND MODE - Type commands ('int' interactive, 'quit')");
    }
}

/* Render complete screen */
void render_full(const EstovoxContext *ctx) {
    int center_x = ctx->cols / 2;
    int center_y = 8;
    
    /* Render face */
    render_face(&ctx->current, center_x, center_y);
    
    /* Render status */
    render_status(&ctx->current, ctx->rows - 8);
    
    /* Render mode bar */
    render_mode_bar(ctx->mode, ctx->rows - 4);
    
    /* Prompt if in command mode */
    if (ctx->mode == MODE_COMMAND) {
        move_cursor(ctx->rows - 1, 1);
        clear_line();
        printf("estovox> ");
    }
    
    /* Force cursor to bottom to prevent flicker */
    move_cursor(ctx->rows - 1, 1);
    
    fflush(stdout);
}

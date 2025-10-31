/*
 * render.c - Enhanced TUI rendering with cartoon mouth and IPA panels
 */

#include "render.h"
#include "mouth.h"
#include "panels.h"
#include "phonemes.h"
#include "color.h"
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

/* Move cursor to position */
static void move_cursor(int row, int col) {
    printf(CSI "%d;%dH", row, col);
}

/* Clear current line */
static void clear_line(void) {
    printf(CSI "K");
}

/* Initialize terminal for rendering */
void render_init(int *cols, int *rows) {
    printf(ALT_SCREEN);
    printf(HIDE_CURSOR);
    printf(CLEAR_SCREEN MOVE_HOME);
    
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
    printf(SHOW_CURSOR);
    printf(NORMAL_SCREEN);
    fflush(stdout);
}

/* Get eyebrow character */
char render_get_eyebrow_char(float height, int is_left) {
    if (height < 0.3f) return '_';
    if (height > 0.7f) return '^';
    return is_left ? '/' : '\\';
}

/* Get eye character */
char render_get_eye_char(float openness) {
    if (openness < 0.3f) return '-';
    if (openness > 0.7f) return 'O';
    return 'o';
}

/* Legacy single-char mouth (kept for compatibility) */
char render_get_mouth_char(const FacialState *state) {
    if (state->jaw_openness < 0.2f) {
        if (state->lip_corner_height > 0.7f) return '_';
        if (state->lip_rounding > 0.5f) return 'o';
        return '-';
    }
    if (state->jaw_openness > 0.5f) {
        if (state->lip_rounding > 0.5f) return 'O';
        return 'D';
    }
    return 'o';
}

/* Render front-view face with parametric mouth */
void render_front_face(const FacialState *state, int center_x, int center_y) {
    char eyebrow_l = render_get_eyebrow_char(state->eyebrow_l_height, 1);
    char eyebrow_r = render_get_eyebrow_char(state->eyebrow_r_height, 0);
    char eye_l = render_get_eye_char(state->eye_l_openness);
    char eye_r = render_get_eye_char(state->eye_r_openness);

    /* Eyebrows */
    move_cursor(center_y - 2, center_x - 5);
    printf("%c%c", eyebrow_l, eyebrow_l);
    move_cursor(center_y - 2, center_x + 4);
    printf("%c%c", eyebrow_r, eyebrow_r);

    /* Eyes - moved down to avoid text overlap */
    move_cursor(center_y, center_x - 4);
    printf("%c", eye_l);
    move_cursor(center_y, center_x + 4);
    printf("%c", eye_r);

    /* Nose */
    move_cursor(center_y + 1, center_x);
    printf("v");

    /* Mouth - use original parametric rendering */
    FrontMouthBuffer mouth_buf;
    mouth_render_front(&mouth_buf, state);

    int mouth_start_y = center_y + 3;  /* Adjusted for new eye position */
    int mouth_start_x = center_x - (FRONT_MOUTH_WIDTH / 2);

    for (int y = 0; y < FRONT_MOUTH_HEIGHT; y++) {
        move_cursor(mouth_start_y + y, mouth_start_x);
        printf("%s", mouth_buf.grid[y]);
    }
}

/* Render side-view vocal tract */
void render_vocal_tract(const FacialState *state, int start_x, int start_y) {
    MouthBuffer tract_buf;
    mouth_render(&tract_buf, state);

    for (int y = 0; y < MOUTH_HEIGHT; y++) {
        move_cursor(start_y + y, start_x);
        printf("%s", tract_buf.grid[y]);
    }
}

/* Render both views with labels */
void render_face(const FacialState *state, int center_x, int center_y) {
    /* Left side: Side-view vocal tract */
    int tract_x = center_x - 35;
    int tract_y = center_y;

    move_cursor(tract_y - 4, tract_x);
    printf("Side View:");
    render_vocal_tract(state, tract_x, tract_y);

    /* Right side: Front-view face */
    int face_x = center_x + 15;
    int face_y = center_y;

    move_cursor(face_y - 4, face_x - 5);
    printf("Front View:");
    render_front_face(state, face_x, face_y);
}

/* Render status bar - DEPRECATED: Now shown in Panel 1 */
void render_status(const FacialState *state, int row) {
    (void)state;
    (void)row;
    /* Status now shown in panels */
}

/* Render mode bar */
void render_mode_bar(EngineMode mode, int row, const FacialState *state) {
    move_cursor(row, 1);
    clear_line();

    if (mode == MODE_INTERACTIVE) {
        /* Calculate vocal tract resonance (F1 approximation) */
        float tract_length = calculate_vocal_tract_length(state);
        int freq_hz = (int)(35000.0f / (4.0f * tract_length));  /* Quarter-wave resonance */

        printf("%sINTERACTIVE%s - %sWSAD%s:Tongue %sIK%s:Jaw %sJL%s:Lips %sUO%s:Round/Corner %sR%s:Reset (%d Hz)",
               COLOR_MODE_ACTIVE, COLOR_RESET,
               COLOR_ACCENT, COLOR_RESET,
               COLOR_ACCENT, COLOR_RESET,
               COLOR_ACCENT, COLOR_RESET,
               COLOR_ACCENT, COLOR_RESET,
               COLOR_ACCENT, COLOR_RESET,
               freq_hz);
    } else {
        printf("%sCOMMAND MODE%s - 'int' interactive, 'quit' exit",
               COLOR_WARNING, COLOR_RESET);
    }
}

/* Render complete screen (extended version) */
void render_full(EstofaceContext *ctx) {
    int center_x = ctx->cols / 2;
    int center_y = 8;  /* Higher up to make room for bottom panels */

    /* Clear screen */
    printf(CLEAR_SCREEN MOVE_HOME);

    /* Update panel positions for current terminal size */
    panels_update_positions(ctx->panels, ctx->rows);

    /* Render face FIRST (clean background) */
    render_face(&ctx->current, center_x, center_y);

    /* Update panels with current state */
    const PhonemePreset *closest = phoneme_find_closest(&ctx->current);
    panels_update_all(ctx->panels, &ctx->current, closest);

    /* Render panels at bottom (only if visible) */
    panels_render_all(ctx->panels);

    /* Render mode bar at VERY BOTTOM */
    render_mode_bar(ctx->mode, ctx->rows - 1, &ctx->current);

    /* Prompt if command mode */
    if (ctx->mode == MODE_COMMAND) {
        move_cursor(ctx->rows, 1);
        clear_line();
        printf("estoface> ");
    }

    /* Force cursor position */
    move_cursor(ctx->rows, 1);

    fflush(stdout);
}

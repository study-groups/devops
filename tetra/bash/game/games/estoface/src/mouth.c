/*
 * mouth.c - Side-view vocal tract rendering
 *
 * Renders an anatomical cross-section showing articulator positions
 */

#include "mouth.h"
#include <math.h>
#include <string.h>

/* Clear mouth buffer */
void mouth_clear(MouthBuffer *buf) {
    for (int y = 0; y < MOUTH_HEIGHT; y++) {
        for (int x = 0; x < MOUTH_WIDTH; x++) {
            buf->grid[y][x] = ' ';
        }
        buf->grid[y][MOUTH_WIDTH] = '\0';
    }
}

/* Helper: Set character at position if in bounds */
static void set_char(MouthBuffer *buf, int row, int col, char c) {
    if (row >= 0 && row < MOUTH_HEIGHT && col >= 0 && col < MOUTH_WIDTH) {
        buf->grid[row][col] = c;
    }
}

/* Render side-view vocal tract diagram */
void mouth_render(MouthBuffer *buf, const FacialState *state) {
    mouth_clear(buf);

    /* Calculate dynamic positions based on state */
    int jaw_drop = (int)(state->jaw_openness * 3);  /* 0-3 rows */
    int tongue_height_row = 7 - (int)(state->tongue_height * 3);  /* row 4-7 */
    int tongue_front_col = 8 + (int)(state->tongue_frontness * 6);  /* col 8-14 */
    int lip_round = state->lip_rounding > 0.5f ? 1 : 0;

    /* Draw head outline (back of head/neck) */
    set_char(buf, 0, 0, '.');
    set_char(buf, 1, 0, '|');
    set_char(buf, 2, 0, '|');
    set_char(buf, 3, 0, '|');
    set_char(buf, 4, 0, '|');
    set_char(buf, 5, 0, '|');
    set_char(buf, 6, 0, '\\');
    set_char(buf, 7, 1, '\\');
    set_char(buf, 8, 2, '\\');

    /* Draw top of head / nasal cavity */
    set_char(buf, 0, 1, '-');
    set_char(buf, 0, 2, '-');
    set_char(buf, 0, 3, '-');
    set_char(buf, 0, 4, '-');
    set_char(buf, 0, 5, '-');
    set_char(buf, 0, 6, '.');

    /* Draw hard palate (roof of mouth) - curves down */
    set_char(buf, 1, 6, '\\');
    set_char(buf, 2, 7, '\\');
    set_char(buf, 3, 8, '\'');
    set_char(buf, 4, 9, '\'');
    set_char(buf, 5, 10, '.');

    /* Draw soft palate (velum) */
    set_char(buf, 1, 5, '/');
    set_char(buf, 2, 4, '/');
    set_char(buf, 3, 3, '/');

    /* Draw lips (front of mouth) - shape changes with rounding */
    int lip_row = 7 + jaw_drop;
    if (lip_round) {
        /* Rounded lips */
        set_char(buf, lip_row - 1, 11, '(');
        set_char(buf, lip_row, 11, '(');
        set_char(buf, lip_row + 1, 11, '(');
    } else {
        /* Spread lips */
        if (jaw_drop > 1) {
            set_char(buf, lip_row - 1, 11, '/');
            set_char(buf, lip_row + 1, 11, '\\');
        } else {
            set_char(buf, lip_row, 11, '|');
        }
    }

    /* Draw jaw (lower outline) */
    for (int i = 0; i < 8; i++) {
        set_char(buf, 8 + jaw_drop, 3 + i, '_');
    }
    set_char(buf, 7 + jaw_drop, 11, '|');

    /* Draw tongue body - main feature that moves! */
    /* Tongue tip */
    set_char(buf, tongue_height_row, tongue_front_col, '*');

    /* Tongue body (3-5 chars trailing back) */
    set_char(buf, tongue_height_row, tongue_front_col - 1, '~');
    set_char(buf, tongue_height_row, tongue_front_col - 2, '~');
    if (tongue_front_col > 10) {
        set_char(buf, tongue_height_row, tongue_front_col - 3, '~');
    }

    /* Tongue root connects to back */
    set_char(buf, tongue_height_row + 1, tongue_front_col - 4, '\\');
    set_char(buf, tongue_height_row + 2, tongue_front_col - 5, '\\');

    /* Add reference markers */
    /* Alveolar ridge (where tongue touches for /t/, /d/, /n/) */
    set_char(buf, 5, 9, '.');

    /* Label hint - can be toggled with panels */
    /* (We'll use panels for detailed labels) */
}

/* Clear front mouth buffer */
void front_mouth_clear(FrontMouthBuffer *buf) {
    for (int y = 0; y < FRONT_MOUTH_HEIGHT; y++) {
        for (int x = 0; x < FRONT_MOUTH_WIDTH; x++) {
            buf->grid[y][x] = ' ';
        }
        buf->grid[y][FRONT_MOUTH_WIDTH] = '\0';
    }
}

/* Calculate upper lip curve for FRONT view */
float mouth_upper_lip(float x, const FacialState *state) {
    float neutral_center = 0.5f;  /* Shared neutral midpoint (rubber band center) */
    float center_x = 0.5f;
    float dx = x - center_x;

    /* Base curve: upper lip dips DOWN at center (parabola opening downward in y-space) */
    float base = dx * dx * 0.15f;  /* Positive: center has higher y (lower on screen) */

    /* Smile/frown: corner height adjustment (edge-weighted) */
    float corner_lift = (state->lip_corner_height - 0.5f) * 0.25f * (1.0f - fabsf(dx) * 2.0f);

    /* Rounding: pulls center up (lower y value) */
    float rounding = state->lip_rounding * 0.12f * (1.0f - fabsf(dx) * 2.0f);

    /* Jaw opening: upper lip moves UP from neutral (35% of total opening) */
    float jaw_offset = state->jaw_openness * 0.35f;

    /* Combine: start from neutral, add natural dip, subtract jaw/rounding to move up */
    return neutral_center + base + corner_lift - rounding - jaw_offset;
}

/* Calculate lower lip curve for FRONT view */
float mouth_lower_lip(float x, const FacialState *state) {
    float neutral_center = 0.5f;  /* Shared neutral midpoint (rubber band center) */
    float center_x = 0.5f;
    float dx = x - center_x;

    /* Base curve: lower lip curves UP at center (parabola opening upward in y-space) */
    float base = dx * dx * 0.15f;  /* Positive: edges have higher y (lower on screen) */

    /* Smile/frown: corner effect (edge-weighted) */
    float corner_effect = (state->lip_corner_height - 0.5f) * 0.15f * (1.0f - fabsf(dx) * 2.0f);

    /* Protrusion: makes lower lip fuller (pushes down slightly) */
    float protrusion = state->lip_protrusion * 0.08f * (1.0f - fabsf(dx) * 1.5f);

    /* Rounding: pulls center up (lower y value) */
    float rounding = state->lip_rounding * 0.1f * (1.0f - fabsf(dx) * 2.0f);

    /* Jaw opening: lower lip moves DOWN from neutral (65% of total opening) */
    float jaw_offset = state->jaw_openness * 0.65f;

    /* Combine: start from neutral, subtract natural curve, add jaw/protrusion to move down */
    return neutral_center - base - corner_effect + protrusion - rounding + jaw_offset;
}

/* Helper: Set character if empty or priority character */
static void set_front_char(FrontMouthBuffer *buf, int row, int col, char c) {
    if (row >= 0 && row < FRONT_MOUTH_HEIGHT && col >= 0 && col < FRONT_MOUTH_WIDTH) {
        if (buf->grid[row][col] == ' ') {
            buf->grid[row][col] = c;
        }
    }
}

/* Render front-view mouth with proper corner convergence */
void mouth_render_front(FrontMouthBuffer *buf, const FacialState *state) {
    front_mouth_clear(buf);

    /* For closed mouth (jaw < 0.15), draw single simple line */
    if (state->jaw_openness < 0.15f) {
        int mid_row = FRONT_MOUTH_HEIGHT / 2;
        for (int col = 2; col < FRONT_MOUTH_WIDTH - 2; col++) {
            buf->grid[mid_row][col] = '-';
        }
        /* Corners */
        buf->grid[mid_row][1] = '/';
        buf->grid[mid_row][FRONT_MOUTH_WIDTH - 2] = '\\';
        return;
    }

    /* Sample lip curves and store positions */
    int upper_positions[FRONT_MOUTH_WIDTH];
    int lower_positions[FRONT_MOUTH_WIDTH];

    for (int col = 0; col < FRONT_MOUTH_WIDTH; col++) {
        float x = (float)col / (float)(FRONT_MOUTH_WIDTH - 1);

        /* Calculate lip positions [0.0, 1.0] */
        float upper = mouth_upper_lip(x, state);
        float lower = mouth_lower_lip(x, state);

        /* Convert to grid coordinates */
        upper_positions[col] = (int)((1.0f - upper) * (FRONT_MOUTH_HEIGHT - 1));
        lower_positions[col] = (int)((1.0f - lower) * (FRONT_MOUTH_HEIGHT - 1));

        /* Clamp to grid bounds */
        if (upper_positions[col] < 0) upper_positions[col] = 0;
        if (upper_positions[col] >= FRONT_MOUTH_HEIGHT) upper_positions[col] = FRONT_MOUTH_HEIGHT - 1;
        if (lower_positions[col] < 0) lower_positions[col] = 0;
        if (lower_positions[col] >= FRONT_MOUTH_HEIGHT) lower_positions[col] = FRONT_MOUTH_HEIGHT - 1;
    }

    /* Draw smooth connected lines */
    for (int col = 0; col < FRONT_MOUTH_WIDTH; col++) {
        int upper_row = upper_positions[col];
        int lower_row = lower_positions[col];

        /* Determine character based on slope and position */
        char upper_char, lower_char;

        if (col == 0 || col == FRONT_MOUTH_WIDTH - 1) {
            /* Corners: use slash characters */
            if (upper_row == lower_row) {
                upper_char = (col == 0) ? '/' : '\\';
            } else {
                upper_char = (col == 0) ? '/' : '\\';
                lower_char = (col == 0) ? '\\' : '/';
            }
        } else {
            /* Middle: check slope for character choice */
            int prev_upper = (col > 0) ? upper_positions[col - 1] : upper_row;
            int next_upper = (col < FRONT_MOUTH_WIDTH - 1) ? upper_positions[col + 1] : upper_row;

            if (prev_upper < upper_row) {
                upper_char = '\\';
            } else if (next_upper < upper_row) {
                upper_char = '/';
            } else {
                upper_char = '_';
            }

            lower_char = '_';
        }

        /* Draw upper lip */
        set_front_char(buf, upper_row, col, upper_char);

        /* Draw lower lip (always, even when mouth is closed) */
        if (lower_row != upper_row) {
            int is_edge = (col == 0 || col == FRONT_MOUTH_WIDTH - 1);

            /* Always draw lower lip at all positions */
            set_front_char(buf, lower_row, col, lower_char);

            /* Connect corners with vertical edges if mouth is open */
            if (is_edge && lower_row > upper_row + 2) {
                for (int r = upper_row + 1; r < lower_row; r++) {
                    set_front_char(buf, r, col, '|');
                }
            }
        }
    }
}

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

    /* Draw lips (front of mouth) - shape changes with rounding, protrusion, and compression */
    int lip_row = 7 + jaw_drop;
    int lip_col = 11 + (int)(state->lip_protrusion * 2);  /* Protrusion extends forward 0-2 cols */
    int lip_vertical_offset = (int)(state->lip_corner_height * 1.5f);  /* Corner height affects vertical position */
    int compression_lift = (int)(state->lip_compression * 2);  /* Compression pushes lower lip up */

    /* Clamp lip column to stay within mouth bounds */
    if (lip_col > 13) lip_col = 13;

    /* Check if lips are compressed (pursed tightly) */
    if (state->lip_compression > 0.6f) {
        /* Compressed/pursed lips - show as vertical line */
        set_char(buf, lip_row - 1 - lip_vertical_offset - compression_lift, lip_col, '|');
        set_char(buf, lip_row - lip_vertical_offset - compression_lift, lip_col, '|');
        set_char(buf, lip_row + 1 - lip_vertical_offset - compression_lift, lip_col, '|');
    } else if (lip_round) {
        /* Rounded lips - side view shows lip edges protruding forward
         * Use '>' for strong rounding (u), ')' for moderate rounding (o) */
        char lip_char = (state->lip_rounding > 0.7f) ? '>' : ')';

        set_char(buf, lip_row - 1 - lip_vertical_offset - compression_lift, lip_col, lip_char);  /* Upper lip edge */
        /* Middle: blank space for opening, or '|' for closed, but only if jaw very closed */
        if (jaw_drop == 0) {
            set_char(buf, lip_row - lip_vertical_offset - compression_lift, lip_col, lip_char);
        }
        set_char(buf, lip_row + 1 - lip_vertical_offset - compression_lift, lip_col, lip_char);  /* Lower lip edge */
    } else {
        /* Spread lips - compression affects lower lip primarily */
        if (jaw_drop > 1) {
            set_char(buf, lip_row - 1 - lip_vertical_offset - compression_lift, lip_col, '/');
            set_char(buf, lip_row + 1 - lip_vertical_offset - compression_lift, lip_col, '\\');
        } else {
            set_char(buf, lip_row - lip_vertical_offset - compression_lift, lip_col, '|');
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

    /* Base curve with dynamic curvature
     * For rounded lips: increase curvature to make corners pull in (circular shape)
     * This creates the width reduction characteristic of rounded vowels */
    float base_curvature = 0.15f + (state->lip_rounding * 0.4f);  /* More curvature when rounded */
    float base = -(dx * dx * base_curvature);  /* Negative: center has lower y (higher on screen) */

    /* Smile/frown: corner height adjustment (edge-weighted) */
    float corner_lift = (state->lip_corner_height - 0.5f) * 0.25f * (1.0f - fabsf(dx) * 2.0f);

    /* Rounding: affects width more than height - only reduce opening if jaw is mostly closed */
    float rounding_reduction = 0.0f;
    if (state->jaw_openness < 0.3f) {
        /* Tight rounding for closed/nearly-closed mouth (ooh, u) */
        rounding_reduction = state->lip_rounding * 0.15f * (1.0f - fabsf(dx) * 2.0f);
    }

    /* Jaw opening: upper lip moves UP from neutral (35% of total opening) */
    float jaw_offset = state->jaw_openness * 0.35f;

    /* Combine: start from neutral, add natural dip, subtract jaw/rounding to move up */
    return neutral_center + base + corner_lift - rounding_reduction - jaw_offset;
}

/* Calculate lower lip curve for FRONT view */
float mouth_lower_lip(float x, const FacialState *state) {
    float neutral_center = 0.5f;  /* Shared neutral midpoint (rubber band center) */
    float center_x = 0.5f;
    float dx = x - center_x;

    /* Base curve with dynamic curvature
     * For rounded lips: increase curvature to make corners pull in (circular shape)
     * This creates the width reduction characteristic of rounded vowels */
    float base_curvature = 0.15f + (state->lip_rounding * 0.35f);  /* More curvature when rounded */
    float base = dx * dx * base_curvature;  /* Positive: edges have higher y (lower on screen) */

    /* Smile/frown: corner effect (edge-weighted) */
    float corner_effect = (state->lip_corner_height - 0.5f) * 0.15f * (1.0f - fabsf(dx) * 2.0f);

    /* Protrusion: makes lower lip fuller (pushes down slightly) */
    float protrusion = state->lip_protrusion * 0.08f * (1.0f - fabsf(dx) * 1.5f);

    /* Rounding: affects width/shape, only reduces opening for closed mouths */
    float rounding_reduction = 0.0f;
    if (state->jaw_openness < 0.3f) {
        /* Tight rounding for closed mouth (ooh) - pulls lower lip up */
        rounding_reduction = state->lip_rounding * 0.12f * (1.0f - fabsf(dx) * 2.0f);
    }

    /* POUT: Only from manual compression, NOT automatic from jaw
     * For open rounded vowels (ɔ, ɒ), we need jaw open + lips rounded
     * Auto-pout would fight against the jaw opening */
    float manual_compression = state->lip_compression * 0.25f;
    float total_pout = manual_compression * (1.0f - fabsf(dx) * 1.2f);

    /* Jaw opening: lower lip moves DOWN from neutral (65% of total opening) */
    float jaw_offset = state->jaw_openness * 0.65f;

    /* Combine: start from neutral, subtract natural curve, add jaw/protrusion to move down,
     * subtract rounding and pout to push up */
    return neutral_center - base - corner_effect + protrusion - rounding_reduction + jaw_offset - total_pout;
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

    /* Calculate how many edge columns to close for rounded lips (create oval) */
    int columns_to_close = (int)(state->lip_rounding * 4.0f);  /* 0-4 columns from each edge */
    if (columns_to_close > 4) columns_to_close = 4;

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

        /* For rounded lips: close off edge columns to create oval opening */
        int dist_from_edge = (col < FRONT_MOUTH_WIDTH / 2) ? col : (FRONT_MOUTH_WIDTH - 1 - col);
        if (dist_from_edge < columns_to_close) {
            /* Gradually close the edges: lips converge toward each other */
            float close_factor = 1.0f - ((float)dist_from_edge / (float)columns_to_close);
            int mid_row = (upper_positions[col] + lower_positions[col]) / 2;
            int gap = lower_positions[col] - upper_positions[col];
            int closed_gap = (int)(gap * (1.0f - close_factor));
            upper_positions[col] = mid_row - closed_gap / 2;
            lower_positions[col] = mid_row + closed_gap / 2;
        }
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

    /* Draw tongue if forward enough (frontness > 0.5) */
    if (state->tongue_frontness > 0.5f && state->jaw_openness > 0.15f) {
        /* Calculate tongue position */
        int center_col = FRONT_MOUTH_WIDTH / 2;
        int upper_row = upper_positions[center_col];
        int lower_row = lower_positions[center_col];

        /* Position tongue vertically based on tongue_height (0.0=low, 1.0=high) */
        int mouth_opening = lower_row - upper_row;
        if (mouth_opening > 0) {
            /* tongue_height: 1.0=high (near upper lip), 0.0=low (near lower lip) */
            float tongue_pos = 1.0f - state->tongue_height;  /* Invert so 0=top, 1=bottom */
            int tongue_row = upper_row + (int)(tongue_pos * mouth_opening);

            /* Clamp to mouth opening */
            if (tongue_row <= upper_row) tongue_row = upper_row + 1;
            if (tongue_row >= lower_row) tongue_row = lower_row - 1;

            /* Draw tongue tip with visibility based on frontness */
            if (state->tongue_frontness > 0.8f) {
                /* Very forward - show tongue tip protruding */
                set_front_char(buf, tongue_row, center_col, '*');
            } else if (state->tongue_frontness > 0.65f) {
                /* Moderately forward - show tongue behind lips */
                set_front_char(buf, tongue_row, center_col, '.');
            } else {
                /* Slightly forward - barely visible */
                set_front_char(buf, tongue_row, center_col, '\xb7');  /* Middle dot */
            }
        }
    }
}

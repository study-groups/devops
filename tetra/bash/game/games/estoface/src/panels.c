/*
 * panels.c - IPA information panel system
 */

#include "panels.h"
#include "phonemes.h"
#include "color.h"
#include <stdio.h>
#include <string.h>

#define ESC "\x1b"
#define CSI ESC "["

/* Panel dimensions for bottom strip */
#define PANEL_STRIP_HEIGHT 7
#define PANEL_STRIP_WIDTH 25

/* Panel positions - horizontal bottom strip, stacked left to right */
static int panel_positions[MAX_IPA_PANELS][2] = {
    {2, 0},      /* Panel 1: will be dynamically positioned */
    {27, 0},     /* Panel 2 */
    {52, 0},     /* Panel 3 */
    {77, 0},     /* Panel 4 */
    {102, 0}     /* Panel 5 */
};

/* Panel titles by type */
static const char *panel_titles[MAX_IPA_PANELS] = {
    "Status",
    "IPA Match",
    "Zones",      /* Gamepad zone visualization */
    "Sequence",   /* Recording/playback */
    "Esto Code"
};

/* Update panel positions for bottom strip */
void panels_update_positions(IPAPanel panels[MAX_IPA_PANELS], int terminal_rows) {
    /* Position panels at bottom of screen, leaving room for mode bar */
    int bottom_y = terminal_rows - PANEL_STRIP_HEIGHT - 2;  /* -2 for mode bar */

    for (int i = 0; i < MAX_IPA_PANELS; i++) {
        panels[i].y = bottom_y;
    }
}

/* Initialize panel system */
void panels_init(IPAPanel panels[MAX_IPA_PANELS]) {
    for (int i = 0; i < MAX_IPA_PANELS; i++) {
        panels[i].visible = 0;
        panels[i].x = panel_positions[i][0];
        panels[i].y = panel_positions[i][1];  /* Will be updated by panels_update_positions */
        panels[i].panel_type = i;  /* Map index to PanelType */
        panels[i].phoneme = NULL;
        snprintf(panels[i].title, sizeof(panels[i].title), "%s", panel_titles[i]);
        panels[i].esto_code[0] = '\0';
    }
}

/* Toggle panel visibility */
void panels_toggle(IPAPanel panels[MAX_IPA_PANELS], int panel_index) {
    if (panel_index < 0 || panel_index >= MAX_IPA_PANELS) return;
    panels[panel_index].visible = !panels[panel_index].visible;
}

/* Update all panels with current state */
void panels_update_all(IPAPanel panels[MAX_IPA_PANELS], const FacialState *state, const PhonemePreset *closest) {
    for (int i = 0; i < MAX_IPA_PANELS; i++) {
        panels[i].state_snapshot = *state;
        panels[i].phoneme = closest;

        if (closest && panels[i].panel_type == PANEL_ESTO_CODE) {
            int duration = 150;
            int pitch = 120;
            phoneme_to_esto(closest, duration, pitch, panels[i].esto_code, sizeof(panels[i].esto_code));
        }
    }
}

/* Move cursor */
static void move_cursor(int row, int col) {
    printf(CSI "%d;%dH", row, col);
}

/* Get color for panel title based on type */
static const char* get_panel_color(int panel_type) {
    switch (panel_type) {
        case PANEL_STATUS:     return COLOR_ACCENT;
        case PANEL_IPA_MATCH:  return COLOR_IPA_SYMBOL;
        case PANEL_ZONES:      return COLOR_SUCCESS;
        case PANEL_SEQUENCE:   return COLOR_WARNING;
        case PANEL_ESTO_CODE:  return COLOR_LABEL;
        default:               return COLOR_RESET;
    }
}

/* Render a single panel without borders */
static void panels_render_one(const IPAPanel *panel) {
    if (!panel->visible) return;

    int x = panel->x;
    int y = panel->y;
    const FacialState *s = &panel->state_snapshot;
    const char *title_color = get_panel_color(panel->panel_type);

    /* Title line */
    move_cursor(y, x);
    printf("%s%s%s", title_color, panel->title, COLOR_RESET);

    /* Content based on panel type - compact format for bottom strip */
    switch (panel->panel_type) {
        case PANEL_STATUS:
            move_cursor(y + 1, x);
            printf("JAW %.2f RND %.2f", s->jaw_openness, s->lip_rounding);
            move_cursor(y + 2, x);
            printf("TNG H:%.2f F:%.2f", s->tongue_height, s->tongue_frontness);
            move_cursor(y + 3, x);
            printf("LIP P:%.2f C:%.2f", s->lip_protrusion, s->lip_compression);
            break;

        case PANEL_IPA_MATCH:
            if (panel->phoneme) {
                const PhonemePreset *ph = panel->phoneme;
                move_cursor(y + 1, x);
                printf("%s[%s]%s", COLOR_IPA_SYMBOL, ph->symbol, COLOR_RESET);
                move_cursor(y + 2, x);
                /* Truncate description to fit */
                char desc[20];
                snprintf(desc, sizeof(desc), "%.18s", ph->description);
                printf("%s%s%s", COLOR_IPA_DESC, desc, COLOR_RESET);
            } else {
                move_cursor(y + 1, x);
                printf("%s(no match)%s", COLOR_DIM, COLOR_RESET);
            }
            break;

        case PANEL_ZONES:
            /* Gamepad zone visualization - show 4x4 grid */
            move_cursor(y + 1, x);
            printf("L-ZONE [%d,%d]", 0, 0);  /* TODO: Get from gamepad */
            move_cursor(y + 2, x);
            printf("R-ZONE [%d,%d]", 0, 0);
            move_cursor(y + 3, x);
            printf("Conf: %.0f%%", 0.0f);
            break;

        case PANEL_SEQUENCE:
            /* Recording/playback status */
            move_cursor(y + 1, x);
            printf("REC: OFF");  /* TODO: Get from sequence */
            move_cursor(y + 2, x);
            printf("PLAY: OFF");
            move_cursor(y + 3, x);
            printf("Frames: 0/10000");
            break;

        case PANEL_ESTO_CODE:
            if (panel->esto_code[0]) {
                move_cursor(y + 1, x);
                /* Truncate code to fit */
                char code[20];
                snprintf(code, sizeof(code), "%.18s", panel->esto_code);
                printf("%s%s%s", COLOR_ACCENT, code, COLOR_RESET);
            } else {
                move_cursor(y + 1, x);
                printf("%s(none)%s", COLOR_DIM, COLOR_RESET);
            }
            break;

        default:
            move_cursor(y + 1, x);
            printf("%s(unknown)%s", COLOR_DIM, COLOR_RESET);
            break;
    }
}

/* Render all panels (visible only, no clearing) */
void panels_render_all(const IPAPanel panels[MAX_IPA_PANELS]) {
    for (int i = 0; i < MAX_IPA_PANELS; i++) {
        if (panels[i].visible) {
            panels_render_one(&panels[i]);
        }
        /* Don't clear when hidden - screen is already cleared before render */
    }
}

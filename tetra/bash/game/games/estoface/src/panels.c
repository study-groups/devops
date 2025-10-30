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

/* Panel dimensions for bottom strip - single line per panel */
#define PANEL_STRIP_HEIGHT 1
#define PANEL_STRIP_WIDTH 80

/* Animation constants */
#define PANEL_FALL_GRAVITY 50.0f    /* Pixels per second squared */
#define PANEL_FALL_DAMPING 0.6f     /* Bounce damping factor */
#define PANEL_SETTLE_THRESHOLD 0.5f /* Velocity threshold for settling */

/* Panel positions - vertical stack at bottom-left */
static int panel_positions[MAX_IPA_PANELS][2] = {
    {2, 0},      /* Panel 1: will be dynamically positioned vertically */
    {2, 0},      /* Panel 2: stacked below panel 1 */
    {2, 0},      /* Panel 3: stacked below panel 2 */
    {2, 0},      /* Panel 4: stacked below panel 3 */
    {2, 0}       /* Panel 5: stacked below panel 4 */
};

/* Panel titles by type */
static const char *panel_titles[MAX_IPA_PANELS] = {
    "Status",
    "IPA Match",
    "Zones",      /* Gamepad zone visualization */
    "Sequence",   /* Recording/playback */
    "Esto Code"
};

/* Update panel positions for bottom strip - stack only visible panels */
void panels_update_positions(IPAPanel panels[MAX_IPA_PANELS], int terminal_rows) {
    /* Count visible panels */
    int visible_count = 0;
    for (int i = 0; i < MAX_IPA_PANELS; i++) {
        if (panels[i].visible) visible_count++;
    }

    /* Stack visible panels from bottom up, one row each
     * Bottom panel at row terminal_rows - (visible_count + 1)
     * Mode bar always at row terminal_rows - 1
     */
    int visible_index = 0;
    for (int i = 0; i < MAX_IPA_PANELS; i++) {
        if (panels[i].visible) {
            /* Position from bottom: terminal_rows - (visible_count + 1) + visible_index */
            panels[i].y = terminal_rows - (visible_count + 1) + visible_index;
            panels[i].x = 2;
            panels[i].anim_y = panels[i].y;  /* Update animation target immediately */
            visible_index++;
        }
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
        panels[i].anim_y = 0.0f;
        panels[i].anim_velocity = 0.0f;
        panels[i].just_shown = 0;
    }
}

/* Toggle panel visibility */
void panels_toggle(IPAPanel panels[MAX_IPA_PANELS], int panel_index) {
    if (panel_index < 0 || panel_index >= MAX_IPA_PANELS) return;
    panels[panel_index].visible = !panels[panel_index].visible;

    /* No animation - panels appear immediately at their position */
    /* Animation disabled because it causes positioning issues */
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

/* Update panel animation (call before rendering) */
void panels_update_animation(IPAPanel panels[MAX_IPA_PANELS], float delta_time) {
    for (int i = 0; i < MAX_IPA_PANELS; i++) {
        if (!panels[i].visible) continue;

        /* If panel was just shown, animate it falling into place */
        if (panels[i].just_shown || panels[i].anim_y < panels[i].y - 0.1f ||
            panels[i].anim_velocity < -PANEL_SETTLE_THRESHOLD) {

            /* Apply gravity */
            panels[i].anim_velocity += PANEL_FALL_GRAVITY * delta_time;

            /* Update position */
            panels[i].anim_y += panels[i].anim_velocity * delta_time;

            /* Check if we've reached or passed the target */
            if (panels[i].anim_y >= panels[i].y) {
                panels[i].anim_y = panels[i].y;

                /* Bounce effect */
                if (panels[i].anim_velocity > PANEL_SETTLE_THRESHOLD) {
                    panels[i].anim_velocity = -panels[i].anim_velocity * PANEL_FALL_DAMPING;
                } else {
                    /* Settle */
                    panels[i].anim_velocity = 0.0f;
                    panels[i].just_shown = 0;
                }
            }
        } else {
            /* Panel is settled */
            panels[i].anim_y = panels[i].y;
        }
    }
}

/* Render a single panel as a single line */
static void panels_render_one(const IPAPanel *panel) {
    if (!panel->visible) return;

    int x = panel->x;
    int y = (int)(panel->anim_y + 0.5f);  /* Use animated y position */
    const FacialState *s = &panel->state_snapshot;
    const char *title_color = get_panel_color(panel->panel_type);

    /* Single line format: "Title: content..." */
    move_cursor(y, x);

    switch (panel->panel_type) {
        case PANEL_STATUS:
            printf("%sStatus:%s JAW:%.2f RND:%.2f TNG:%.2f,%.2f LIP:%.2f,%.2f",
                   title_color, COLOR_RESET,
                   s->jaw_openness, s->lip_rounding,
                   s->tongue_height, s->tongue_frontness,
                   s->lip_protrusion, s->lip_compression);
            break;

        case PANEL_IPA_MATCH:
            if (panel->phoneme) {
                const PhonemePreset *ph = panel->phoneme;
                printf("%sIPA Match:%s [%s%s%s] %s%s%s",
                       title_color, COLOR_RESET,
                       COLOR_IPA_SYMBOL, ph->symbol, COLOR_RESET,
                       COLOR_IPA_DESC, ph->description, COLOR_RESET);
            } else {
                printf("%sIPA Match:%s %s(no match)%s",
                       title_color, COLOR_RESET,
                       COLOR_DIM, COLOR_RESET);
            }
            break;

        case PANEL_ZONES:
            /* Gamepad zone visualization */
            printf("%sZones:%s L:[%d,%d] R:[%d,%d] Conf:%.0f%%",
                   title_color, COLOR_RESET,
                   0, 0, 0, 0, 0.0f);  /* TODO: Get from gamepad */
            break;

        case PANEL_SEQUENCE:
            /* Recording/playback status */
            printf("%sSequence:%s REC:OFF PLAY:OFF Frames:0/10000",
                   title_color, COLOR_RESET);  /* TODO: Get from sequence */
            break;

        case PANEL_ESTO_CODE:
            if (panel->esto_code[0]) {
                printf("%sEsto Code:%s %s%s%s",
                       title_color, COLOR_RESET,
                       COLOR_ACCENT, panel->esto_code, COLOR_RESET);
            } else {
                printf("%sEsto Code:%s %s(none)%s",
                       title_color, COLOR_RESET,
                       COLOR_DIM, COLOR_RESET);
            }
            break;

        default:
            printf("%sUnknown:%s %s(unknown panel type)%s",
                   title_color, COLOR_RESET,
                   COLOR_DIM, COLOR_RESET);
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

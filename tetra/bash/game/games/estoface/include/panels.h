/*
 * panels.h - IPA information panel system
 */

#ifndef ESTOFACE_PANELS_H
#define ESTOFACE_PANELS_H

#include "types.h"

/* Panel types */
typedef enum {
    PANEL_STATUS,      /* Articulator values */
    PANEL_IPA_MATCH,   /* Closest IPA phoneme */
    PANEL_ZONES,       /* Gamepad zone visualization */
    PANEL_SEQUENCE,    /* Recording/playback status */
    PANEL_ESTO_CODE    /* Esto format code */
} PanelType;

/* Initialize panel system */
void panels_init(IPAPanel panels[MAX_IPA_PANELS]);

/* Toggle panel visibility (number keys 1-5) */
void panels_toggle(IPAPanel panels[MAX_IPA_PANELS], int panel_index);

/* Update all panels with current state */
void panels_update_all(IPAPanel panels[MAX_IPA_PANELS], const FacialState *state, const PhonemePreset *closest);

/* Render all visible panels */
void panels_render_all(const IPAPanel panels[MAX_IPA_PANELS]);

/* Update panel positions for bottom strip layout */
void panels_update_positions(IPAPanel panels[MAX_IPA_PANELS], int terminal_rows);

#endif /* ESTOFACE_PANELS_H */

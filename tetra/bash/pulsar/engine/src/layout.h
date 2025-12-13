/*
 * layout.h - Terminal layout management with resizing support
 */

#ifndef LAYOUT_H
#define LAYOUT_H

#include "types.h"

/* Layout regions */
typedef struct {
    int x, y;        /* Top-left corner */
    int width, height;
    int visible;
} LayoutRegion;

/* Panel types */
typedef enum {
    PANEL_DEBUG = 0,      /* Panel 1: Debug info (top) */
    PANEL_EVENT_LOG = 1,  /* Panel 2: Event log (bottom, sticky) */
    PANEL_PLAYER_STATS = 2, /* Panel 3: Player stats (right) */
    PANEL_MAPPING = 3,    /* Panel 4: Mapping debug (left) */
    PANEL_CONFIG = 4,     /* Panel 9: Configuration (tabbed center) */
    PANEL_COUNT
} PanelType;

/* Layout manager state */
typedef struct {
    int cols;           /* Terminal columns */
    int rows;           /* Terminal rows */
    int panel_flags;    /* Bitfield for panel visibility */
    int show_help;      /* Help overlay toggle */
    int show_config;    /* Config panel (9 key) */
    int show_mapping;   /* Mapping panel (4 key) */
    LayoutRegion panels[PANEL_COUNT];
    LayoutRegion play_area;  /* Main game area */
} LayoutManager;

/* Initialize layout manager */
void layout_init(LayoutManager *layout, int cols, int rows);

/* Update layout on terminal resize */
void layout_resize(LayoutManager *layout, int new_cols, int new_rows);

/* Calculate regions based on visible panels */
void layout_update_regions(LayoutManager *layout);

/* Toggle panel visibility */
void layout_toggle_panel(LayoutManager *layout, PanelType panel);

/* Get play area (excludes all visible panels) */
LayoutRegion layout_get_play_area(const LayoutManager *layout);

/* Check if point is in panel region */
int layout_point_in_region(const LayoutRegion *region, int x, int y);

#endif /* LAYOUT_H */

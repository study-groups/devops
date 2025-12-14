/*
 * layout.c - Terminal layout management with resizing support
 */

#include "layout.h"
#include <string.h>

/* Initialize layout manager */
void layout_init(LayoutManager *layout, int cols, int rows) {
    memset(layout, 0, sizeof(LayoutManager));
    layout->cols = cols;
    layout->rows = rows;
    /* Enable event log panel by default (sticky panel) */
    layout->panel_flags = (1 << PANEL_EVENT_LOG);
    layout->show_help = 0;
    layout->show_config = 0;
    layout->show_mapping = 0;

    layout_update_regions(layout);
}

/* Update layout on terminal resize */
void layout_resize(LayoutManager *layout, int new_cols, int new_rows) {
    layout->cols = new_cols;
    layout->rows = new_rows;
    layout_update_regions(layout);
}

/* Calculate regions based on visible panels */
void layout_update_regions(LayoutManager *layout) {
    int cols = layout->cols;
    int rows = layout->rows;

    /* Reset all regions */
    memset(layout->panels, 0, sizeof(layout->panels));

    /* Panel 1: Debug info (top 3 lines, full width) */
    if (layout->panel_flags & (1 << PANEL_DEBUG)) {
        layout->panels[PANEL_DEBUG].x = 0;
        layout->panels[PANEL_DEBUG].y = 0;
        layout->panels[PANEL_DEBUG].width = cols;
        layout->panels[PANEL_DEBUG].height = 3;
        layout->panels[PANEL_DEBUG].visible = 1;
    }

    /* Panel 2: Event log (bottom 4 lines, full width, STICKY) */
    if (layout->panel_flags & (1 << PANEL_EVENT_LOG)) {
        layout->panels[PANEL_EVENT_LOG].x = 0;
        layout->panels[PANEL_EVENT_LOG].y = rows - 4;  /* STICKY to bottom! */
        layout->panels[PANEL_EVENT_LOG].width = cols;
        layout->panels[PANEL_EVENT_LOG].height = 4;
        layout->panels[PANEL_EVENT_LOG].visible = 1;
    }

    /* Panel 3: Player stats (right side, 30 chars wide) */
    if (layout->panel_flags & (1 << PANEL_PLAYER_STATS)) {
        int width = 30;
        if (width > cols / 2) width = cols / 2;

        layout->panels[PANEL_PLAYER_STATS].x = cols - width;
        layout->panels[PANEL_PLAYER_STATS].y = 0;
        layout->panels[PANEL_PLAYER_STATS].width = width;
        layout->panels[PANEL_PLAYER_STATS].height = rows;
        layout->panels[PANEL_PLAYER_STATS].visible = 1;
    }

    /* Panel 4: Mapping debug (left side) */
    if (layout->show_mapping) {
        int width = 35;
        if (width > cols / 2) width = cols / 2;

        layout->panels[PANEL_MAPPING].x = 0;
        layout->panels[PANEL_MAPPING].y = rows / 2;
        layout->panels[PANEL_MAPPING].width = width;
        layout->panels[PANEL_MAPPING].height = rows / 2;
        layout->panels[PANEL_MAPPING].visible = 1;
    }

    /* Panel 9: Config (centered, 70% of screen) */
    if (layout->show_config) {
        int width = (cols * 70) / 100;
        int height = (rows * 70) / 100;

        layout->panels[PANEL_CONFIG].x = (cols - width) / 2;
        layout->panels[PANEL_CONFIG].y = (rows - height) / 2;
        layout->panels[PANEL_CONFIG].width = width;
        layout->panels[PANEL_CONFIG].height = height;
        layout->panels[PANEL_CONFIG].visible = 1;
    }

    /* Calculate play area (excludes all visible panels) */
    int top = 0, bottom = rows, left = 0, right = cols;

    /* Adjust for debug panel */
    if (layout->panels[PANEL_DEBUG].visible) {
        top = layout->panels[PANEL_DEBUG].height;
    }

    /* Adjust for event log (sticky bottom) */
    if (layout->panels[PANEL_EVENT_LOG].visible) {
        bottom = layout->panels[PANEL_EVENT_LOG].y;
    }

    /* Adjust for player stats */
    if (layout->panels[PANEL_PLAYER_STATS].visible) {
        right = layout->panels[PANEL_PLAYER_STATS].x;
    }

    /* Adjust for mapping panel */
    if (layout->panels[PANEL_MAPPING].visible) {
        /* Mapping panel only affects vertical space */
        /* Don't shrink horizontal play area */
    }

    layout->play_area.x = left;
    layout->play_area.y = top;
    layout->play_area.width = right - left;
    layout->play_area.height = bottom - top;
    layout->play_area.visible = 1;
}

/* Toggle panel visibility */
void layout_toggle_panel(LayoutManager *layout, PanelType panel) {
    if (panel == PANEL_CONFIG) {
        layout->show_config = !layout->show_config;
    } else if (panel == PANEL_MAPPING) {
        layout->show_mapping = !layout->show_mapping;
    } else if (panel < PANEL_COUNT) {
        layout->panel_flags ^= (1 << panel);
    }

    layout_update_regions(layout);
}

/* Get play area */
LayoutRegion layout_get_play_area(const LayoutManager *layout) {
    return layout->play_area;
}

/* Check if point is in panel region */
int layout_point_in_region(const LayoutRegion *region, int x, int y) {
    if (!region->visible) return 0;

    return (x >= region->x && x < region->x + region->width &&
            y >= region->y && y < region->y + region->height);
}

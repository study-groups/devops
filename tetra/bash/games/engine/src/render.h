/*
 * render.h - Sprite and game rendering
 */

#ifndef RENDER_H
#define RENDER_H

#include "types.h"
#include "layout.h"
#include <stdio.h>

/* Render context */
typedef struct {
    FILE *tty;
    int cols;
    int rows;
} RenderContext;

/* Initialize render context */
void render_init(RenderContext *ctx, FILE *tty, int cols, int rows);

/* Update screen dimensions */
void render_resize(RenderContext *ctx, int cols, int rows);

/* Render all sprites within play area */
void render_sprites(RenderContext *ctx, const Sprite *sprites, int max_sprites,
                    const LayoutRegion *play_area);

/* Render a single sprite */
void render_sprite(RenderContext *ctx, const Sprite *sprite,
                   const LayoutRegion *play_area);

/* Get ANSI color for valence */
const char* render_get_color(int valence);

#endif /* RENDER_H */

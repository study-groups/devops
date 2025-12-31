/*
 * render.c - Sprite and game rendering with isometric 3D support
 */

#include "render.h"
#include <math.h>

/* Isometric projection constants */
#define ISO_Z_SHIFT_X  4   /* Microgrid X shift per Z layer */
#define ISO_Z_SHIFT_Y  2   /* Microgrid Y shift per Z layer (up) */

/* Apply isometric projection to microgrid coordinates */
static void iso_project(int mx, int my, int mz, int *sx, int *sy) {
    /* Zaxxon-style: higher Z shifts right and up */
    int iso_mx = mx + (mz * ISO_Z_SHIFT_X);
    int iso_my = my - (mz * ISO_Z_SHIFT_Y);

    /* Convert microgrid to terminal cells */
    *sx = iso_mx / 2;   /* 2 microgrid = 1 terminal X */
    *sy = iso_my / 4;   /* 4 microgrid = 1 terminal Y */
}

/* Get Z-layer visual indicator character */
static char get_z_char(int mz) {
    static const char z_chars[] = ".oO@";
    if (mz < 0) mz = 0;
    if (mz > Z_MAX) mz = Z_MAX;
    return z_chars[mz];
}

/* Get Z-layer brightness modifier */
static const char* get_z_brightness(int mz) {
    static const char *brightness[] = {
        "\033[2m",   /* Z=0: dim */
        "",          /* Z=1: normal */
        "\033[1m",   /* Z=2: bold */
        "\033[1m"    /* Z=3: bold */
    };
    if (mz < 0) mz = 0;
    if (mz > Z_MAX) mz = Z_MAX;
    return brightness[mz];
}

/* Initialize render context */
void render_init(RenderContext *ctx, FILE *tty, int cols, int rows) {
    ctx->tty = tty;
    ctx->cols = cols;
    ctx->rows = rows;
}

/* Update screen dimensions */
void render_resize(RenderContext *ctx, int cols, int rows) {
    ctx->cols = cols;
    ctx->rows = rows;
}

/* Get ANSI color for valence */
const char* render_get_color(int valence) {
    static const char *colors[] = {
        "\033[37m",  /* neutral - gray */
        "\033[34m",  /* info - blue */
        "\033[32m",  /* success - green */
        "\033[33m",  /* warning - yellow */
        "\033[31m",  /* danger - red */
        "\033[35m"   /* accent - purple */
    };
    return colors[valence % 6];
}

/* Render a single sprite with isometric projection */
void render_sprite(RenderContext *ctx, const Sprite *sprite,
                   const LayoutRegion *play_area) {
    if (!ctx->tty || !sprite->active) return;

    /* Apply isometric projection (3D -> 2D) */
    int cx, cy;
    iso_project(sprite->mx, sprite->my, sprite->mz, &cx, &cy);

    /* Apply play area offset */
    cx += play_area->x;
    cy += play_area->y;

    const char *color = render_get_color(sprite->valence);
    const char *bright = get_z_brightness(sprite->mz);

    /* Draw pulsar with rotating arms (8 arms) */
    for (int arm = 0; arm < 8; arm++) {
        float angle = sprite->theta + (arm * 3.14159f * 2.0f / 8.0f);

        /* Calculate pulse effect */
        float pulse = 1.0f + sprite->amp * 0.05f * sinf(sprite->phase * 2.0f * 3.14159f);
        int len = (int)(sprite->len0 * 0.5f * pulse);
        if (len < 3) len = 3;

        /* Draw arm segments */
        for (int r = 1; r <= len && r <= 15; r++) {
            int ax = cx + (int)(r * cosf(angle));
            int ay = cy + (int)(r * sinf(angle) * 0.5f);  /* 0.5 for aspect ratio */

            /* Bounds check (within play area) */
            if (ax >= play_area->x && ax < play_area->x + play_area->width &&
                ay >= play_area->y && ay < play_area->y + play_area->height) {
                char ch = (r == len) ? '*' : (r % 2 == 0 ? 'o' : '.');
                /* Apply Z-layer brightness to color */
                fprintf(ctx->tty, "\033[%d;%dH%s%s%c\033[0m",
                        ay + 1, ax + 1, bright, color, ch);
            }
        }
    }
}

/* Render all sprites within play area with Z-ordering (painter's algorithm) */
void render_sprites(RenderContext *ctx, const Sprite *sprites, int max_sprites,
                    const LayoutRegion *play_area) {
    if (!ctx->tty) return;

    /* Render in Z-order: low Z first, high Z last (on top) */
    for (int z = 0; z <= Z_MAX; z++) {
        for (int i = 0; i < max_sprites; i++) {
            if (sprites[i].active && sprites[i].mz == z) {
                render_sprite(ctx, &sprites[i], play_area);
            }
        }
    }
}

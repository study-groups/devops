/*
 * render.c - Sprite and game rendering
 */

#include "render.h"
#include <math.h>

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

/* Render a single sprite */
void render_sprite(RenderContext *ctx, const Sprite *sprite,
                   const LayoutRegion *play_area) {
    if (!ctx->tty || !sprite->active) return;

    /* Convert microgrid to terminal coords */
    int cx = sprite->mx / 2;
    int cy = sprite->my / 4;

    /* Apply play area offset */
    cx += play_area->x;
    cy += play_area->y;

    const char *color = render_get_color(sprite->valence);

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
                fprintf(ctx->tty, "\033[%d;%dH%s%c\033[0m", ay + 1, ax + 1, color, ch);
            }
        }
    }
}

/* Render all sprites within play area */
void render_sprites(RenderContext *ctx, const Sprite *sprites, int max_sprites,
                    const LayoutRegion *play_area) {
    if (!ctx->tty) return;

    for (int i = 0; i < max_sprites; i++) {
        if (sprites[i].active) {
            render_sprite(ctx, &sprites[i], play_area);
        }
    }
}

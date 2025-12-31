/*
 * collision.c - Z-aware collision detection for isometric 3D
 *
 * Collision rules:
 * - Only entities on the SAME Z layer collide
 * - Projectiles collide with other projectiles and players
 * - Uses simple circle-circle intersection (radius-based)
 */

#include "collision.h"
#include <math.h>
#include <string.h>

/* Initialize collision context */
void collision_init(CollisionContext *ctx) {
    memset(ctx, 0, sizeof(CollisionContext));
}

/* Check all sprite collisions */
void collision_check(CollisionContext *ctx, Sprite *sprites, int max_sprites) {
    ctx->count = 0;

    for (int i = 0; i < max_sprites && ctx->count < MAX_COLLISIONS; i++) {
        if (!sprites[i].active) continue;

        /* Only check projectiles as collision sources */
        if (sprites[i].entity_type != ENTITY_PROJECTILE) continue;

        for (int j = i + 1; j < max_sprites; j++) {
            if (!sprites[j].active) continue;
            if (ctx->count >= MAX_COLLISIONS) break;

            /* Z-LAYER CHECK: only collide on same layer */
            if (sprites[i].mz != sprites[j].mz) continue;

            /* Skip if both are pulsars (decorative, no collision) */
            if (sprites[i].entity_type == ENTITY_PULSAR &&
                sprites[j].entity_type == ENTITY_PULSAR) continue;

            /* Calculate 2D distance on the X-Y plane (microgrid) */
            int dx = sprites[i].mx - sprites[j].mx;
            int dy = sprites[i].my - sprites[j].my;
            int dist_sq = dx * dx + dy * dy;

            /* Use radius for collision detection */
            int r_sum = sprites[i].radius + sprites[j].radius;
            if (r_sum <= 0) continue;  /* Skip if no collision radius */

            if (dist_sq < r_sum * r_sum) {
                /* Collision detected! */
                CollisionEvent *e = &ctx->events[ctx->count++];
                e->id1 = sprites[i].id;
                e->id2 = sprites[j].id;
                e->x = (sprites[i].mx + sprites[j].mx) / 2;
                e->y = (sprites[i].my + sprites[j].my) / 2;
                e->z = sprites[i].mz;  /* Same Z layer */

                /* Calculate energy from combined 3D velocities */
                float v1 = sqrtf((float)(sprites[i].vx * sprites[i].vx +
                                         sprites[i].vy * sprites[i].vy +
                                         sprites[i].vz * sprites[i].vz));
                float v2 = sqrtf((float)(sprites[j].vx * sprites[j].vx +
                                         sprites[j].vy * sprites[j].vy +
                                         sprites[j].vz * sprites[j].vz));
                e->energy = v1 + v2;

                /* Deactivate collided entities */
                sprites[i].active = 0;
                sprites[j].active = 0;
            }
        }
    }
}

/* Get collision count */
int collision_count(const CollisionContext *ctx) {
    return ctx->count;
}

/* Get collision event by index */
const CollisionEvent* collision_get(const CollisionContext *ctx, int index) {
    if (index < 0 || index >= ctx->count) return NULL;
    return &ctx->events[index];
}

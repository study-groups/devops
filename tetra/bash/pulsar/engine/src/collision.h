/*
 * collision.h - Z-aware collision detection for isometric 3D
 */

#ifndef COLLISION_H
#define COLLISION_H

#include "types.h"

/* Maximum collision events per frame */
#define MAX_COLLISIONS 16

/* Collision event structure */
typedef struct {
    int id1, id2;        /* Entity IDs that collided */
    int x, y, z;         /* Collision point (microgrid + layer) */
    float energy;        /* Combined velocity magnitude */
} CollisionEvent;

/* Collision detection context */
typedef struct {
    CollisionEvent events[MAX_COLLISIONS];
    int count;           /* Number of collisions this frame */
} CollisionContext;

/* Initialize collision context */
void collision_init(CollisionContext *ctx);

/* Check all sprite collisions (Z-aware: same layer only) */
void collision_check(CollisionContext *ctx, Sprite *sprites, int max_sprites);

/* Get collision count */
int collision_count(const CollisionContext *ctx);

/* Get collision event by index */
const CollisionEvent* collision_get(const CollisionContext *ctx, int index);

#endif /* COLLISION_H */

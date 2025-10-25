/*
 * mouth.h - Side-view vocal tract rendering
 *
 * Renders an anatomical side-view of the vocal tract showing:
 * - Hard and soft palate
 * - Tongue position (height and frontness)
 * - Jaw opening
 * - Lip shape (rounding/spreading)
 */

#ifndef ESTOFACE_MOUTH_H
#define ESTOFACE_MOUTH_H

#include "types.h"

#define MOUTH_WIDTH 28
#define MOUTH_HEIGHT 12

#define FRONT_MOUTH_WIDTH 16
#define FRONT_MOUTH_HEIGHT 8

/* Mouth rendering buffer (for side view) */
typedef struct {
    char grid[MOUTH_HEIGHT][MOUTH_WIDTH + 1];  /* +1 for null terminator */
} MouthBuffer;

/* Front mouth buffer (for front view) */
typedef struct {
    char grid[FRONT_MOUTH_HEIGHT][FRONT_MOUTH_WIDTH + 1];
} FrontMouthBuffer;

/* Generate side-view vocal tract based on facial parameters */
void mouth_render(MouthBuffer *buf, const FacialState *state);

/* Generate front-view mouth with parametric curves */
void mouth_render_front(FrontMouthBuffer *buf, const FacialState *state);

/* Helper: Calculate upper lip curve at horizontal position x (0.0-1.0) */
float mouth_upper_lip(float x, const FacialState *state);

/* Helper: Calculate lower lip curve at horizontal position x (0.0-1.0) */
float mouth_lower_lip(float x, const FacialState *state);

/* Clear mouth buffer */
void mouth_clear(MouthBuffer *buf);

/* Clear front mouth buffer */
void front_mouth_clear(FrontMouthBuffer *buf);

#endif /* ESTOFACE_MOUTH_H */

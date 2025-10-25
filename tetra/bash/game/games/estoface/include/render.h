/*
 * render.h - TUI rendering system
 */

#ifndef ESTOFACE_RENDER_H
#define ESTOFACE_RENDER_H

#include "types.h"

/* Initialize terminal for rendering */
void render_init(int *cols, int *rows);

/* Cleanup and restore terminal */
void render_cleanup(void);

/* Render complete screen */
void render_full(EstofaceContext *ctx);

/* Render face based on current state */
void render_face(const FacialState *state, int center_x, int center_y);

/* Render status bar with parameter values */
void render_status(const FacialState *state, int row);

/* Render mode indicator bar */
void render_mode_bar(EngineMode mode, int row);

/* Get mouth shape character based on jaw/lip state */
char render_get_mouth_char(const FacialState *state);

/* Get eye character based on openness */
char render_get_eye_char(float openness);

/* Get eyebrow character based on height */
char render_get_eyebrow_char(float height, int is_left);

#endif /* ESTOFACE_RENDER_H */

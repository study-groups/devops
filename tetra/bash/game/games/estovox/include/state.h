/*
 * state.h - Facial state management
 */

#ifndef ESTOVOX_STATE_H
#define ESTOVOX_STATE_H

#include "types.h"

/* Initialize facial state to neutral position */
void state_init(FacialState *state);

/* Reset state to neutral */
void state_reset(FacialState *state);

/* Get parameter value by index */
float state_get_param(const FacialState *state, FacialParam param);

/* Set parameter value (with clamping to [0.0, 1.0]) */
void state_set_param(FacialState *state, FacialParam param, float value);

/* Clamp value to [0.0, 1.0] */
float state_clamp(float value);

#endif /* ESTOVOX_STATE_H */

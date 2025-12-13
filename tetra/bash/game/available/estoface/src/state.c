/*
 * state.c - Facial state management implementation
 */

#include "state.h"
#include <string.h>

/* Initialize facial state to neutral position */
void state_init(FacialState *state) {
    memset(state, 0, sizeof(FacialState));

    /* Set neutral defaults - open "ah" mouth at rest */
    state->jaw_openness = 1.0f;        /* Open jaw for "ah" */
    state->lip_corner_height = 0.5f;   /* Neutral smile */
    state->tongue_height = 0.9f;       /* Tongue low for "ah" */
    state->tongue_frontness = 0.5f;    /* Central tongue */
    state->eyebrow_l_height = 0.5f;    /* Neutral eyebrows */
    state->eyebrow_r_height = 0.5f;
    state->eye_l_openness = 1.0f;      /* Eyes open */
    state->eye_r_openness = 1.0f;
}

/* Reset state to neutral */
void state_reset(FacialState *state) {
    state_init(state);
}

/* Clamp value to [0.0, 1.0] */
float state_clamp(float value) {
    if (value < 0.0f) return 0.0f;
    if (value > 1.0f) return 1.0f;
    return value;
}

/* Get parameter value by index */
float state_get_param(const FacialState *state, FacialParam param) {
    const float *params = (const float *)state;
    if (param < 0 || param >= NUM_FACIAL_PARAMS) {
        return 0.0f;
    }
    return params[param];
}

/* Set parameter value (with clamping) */
void state_set_param(FacialState *state, FacialParam param, float value) {
    float *params = (float *)state;
    if (param < 0 || param >= NUM_FACIAL_PARAMS) {
        return;
    }
    params[param] = state_clamp(value);
}

/*
 * animation.c - Animation and interpolation system
 */

#include "animation.h"
#include "state.h"
#include <string.h>
#include <math.h>

/* Initialize animation system */
void anim_init(AnimationTargets *anim) {
    memset(anim, 0, sizeof(AnimationTargets));
}

/* Set target value for a parameter */
void anim_set_target(AnimationTargets *anim, FacialParam param, float target, float rate) {
    if (param < 0 || param >= NUM_FACIAL_PARAMS) return;
    
    anim->targets[param] = state_clamp(target);
    anim->rates[param] = state_clamp(rate);
    anim->has_target[param] = 1;
}

/* Clear target for a parameter */
void anim_clear_target(AnimationTargets *anim, FacialParam param) {
    if (param < 0 || param >= NUM_FACIAL_PARAMS) return;
    anim->has_target[param] = 0;
}

/* Linear interpolation */
float lerp(float current, float target, float rate) {
    return current + (target - current) * rate;
}

/* Update one frame - interpolate current state toward targets */
void anim_update_frame(FacialState *state, AnimationTargets *anim) {
    for (int i = 0; i < NUM_FACIAL_PARAMS; i++) {
        if (!anim->has_target[i]) continue;
        
        float current = state_get_param(state, i);
        float target = anim->targets[i];
        float rate = anim->rates[i];
        
        float new_value = lerp(current, target, rate);
        state_set_param(state, i, new_value);
        
        /* Clear target if close enough (within 0.01) */
        if (fabsf(new_value - target) < 0.01f) {
            anim_clear_target(anim, i);
        }
    }
}

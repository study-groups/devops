/*
 * animation.h - Animation and interpolation system
 */

#ifndef ESTOFACE_ANIMATION_H
#define ESTOFACE_ANIMATION_H

#include "types.h"

/* Initialize animation system */
void anim_init(AnimationTargets *anim);

/* Set target value for a parameter */
void anim_set_target(AnimationTargets *anim, FacialParam param, float target, float rate);

/* Clear target for a parameter */
void anim_clear_target(AnimationTargets *anim, FacialParam param);

/* Update one frame - interpolate current state toward targets */
void anim_update_frame(FacialState *state, AnimationTargets *anim);

/* Linear interpolation */
float lerp(float current, float target, float rate);

#endif /* ESTOFACE_ANIMATION_H */

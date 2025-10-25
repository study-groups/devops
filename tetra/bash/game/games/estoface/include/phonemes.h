/*
 * phonemes.h - IPA phoneme presets
 */

#ifndef ESTOFACE_PHONEMES_H
#define ESTOFACE_PHONEMES_H

#include "types.h"
#include <stddef.h>

/* Get phoneme preset by IPA symbol */
const PhonemePreset* phoneme_get_preset(const char *symbol);

/* Apply phoneme preset to state */
void phoneme_apply(FacialState *state, const char *symbol, float rate);

/* List all available phonemes */
void phoneme_list_all(void);

#endif /* ESTOFACE_PHONEMES_H */

/* Find closest matching IPA phoneme based on current facial state */
const PhonemePreset* phoneme_find_closest(const FacialState *state);

/* Calculate distance between two facial states (for IPA matching) */
float phoneme_state_distance(const FacialState *a, const FacialState *b);

/* Generate esto format code for a phoneme */
void phoneme_to_esto(const PhonemePreset *phoneme, int duration_ms, int pitch_hz, char *buf, size_t bufsize);

/* Get phoneme by zone coordinates (0-3, 0-3) */
const PhonemePreset* phoneme_get_by_zone(int zone_x, int zone_y);

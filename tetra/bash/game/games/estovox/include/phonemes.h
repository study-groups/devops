/*
 * phonemes.h - IPA phoneme presets
 */

#ifndef ESTOVOX_PHONEMES_H
#define ESTOVOX_PHONEMES_H

#include "types.h"

/* Get phoneme preset by IPA symbol */
const PhonemePreset* phoneme_get_preset(const char *symbol);

/* Apply phoneme preset to state */
void phoneme_apply(FacialState *state, const char *symbol, float rate);

/* List all available phonemes */
void phoneme_list_all(void);

#endif /* ESTOVOX_PHONEMES_H */

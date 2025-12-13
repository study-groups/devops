/**
 * formant_phonemes.c
 *
 * IPA phoneme to formant frequency mappings.
 * Based on standard formant values for American English.
 */

#include <string.h>
#include "formant.h"

/* Formant frequency table for IPA phonemes */
static const formant_phoneme_config_t PHONEME_TABLE[] = {
    /* Vowels */
    {"i",   FORMANT_PHONEME_VOWEL,  300, 2300, 3000, 3500, 4500,  50, 100, 150, 150, 200,  1.0, 1.0, 0.8, 0.6, 0.4,  100, 0.0, 0.0, true},
    {"e",   FORMANT_PHONEME_VOWEL,  400, 2000, 2800, 3500, 4500,  50, 100, 150, 150, 200,  1.0, 1.0, 0.8, 0.6, 0.4,  120, 0.0, 0.0, true},
    {"a",   FORMANT_PHONEME_VOWEL,  800, 1200, 2500, 3500, 4500,  60, 120, 180, 180, 220,  1.0, 0.9, 0.7, 0.5, 0.3,  150, 0.0, 0.0, true},
    {"o",   FORMANT_PHONEME_VOWEL,  500,  900, 2500, 3500, 4500,  50, 100, 150, 150, 200,  1.0, 0.8, 0.7, 0.5, 0.3,  130, 0.0, 0.0, true},
    {"u",   FORMANT_PHONEME_VOWEL,  300,  700, 2300, 3500, 4500,  50, 100, 150, 150, 200,  1.0, 0.7, 0.6, 0.5, 0.3,  110, 0.0, 0.0, true},
    {"ə",   FORMANT_PHONEME_VOWEL,  500, 1500, 2500, 3500, 4500,  50, 100, 150, 150, 200,  1.0, 0.8, 0.6, 0.4, 0.3,   80, 0.0, 0.0, true},

    /* Nasals */
    {"m",   FORMANT_PHONEME_NASAL,   300, 1000, 2500, 3500, 4500,  80, 150, 200, 200, 250,  1.0, 0.5, 0.3, 0.2, 0.1,  100, 0.0, 0.0, true},
    {"n",   FORMANT_PHONEME_NASAL,   300, 1700, 2500, 3500, 4500,  80, 150, 200, 200, 250,  1.0, 0.5, 0.3, 0.2, 0.1,   80, 0.0, 0.0, true},

    /* Plosives */
    {"p",   FORMANT_PHONEME_PLOSIVE, 200,  800, 2500, 3500, 4500, 100, 200, 300, 300, 400,  0.0, 0.0, 0.0, 0.0, 0.0,   80, 0.1, 0.0, false},
    {"b",   FORMANT_PHONEME_PLOSIVE, 200,  800, 2500, 3500, 4500, 100, 200, 300, 300, 400,  0.2, 0.1, 0.1, 0.0, 0.0,   80, 0.05, 0.0, true},
    {"t",   FORMANT_PHONEME_PLOSIVE, 200, 1700, 2500, 3500, 4500, 100, 200, 300, 300, 400,  0.0, 0.0, 0.0, 0.0, 0.0,   60, 0.1, 0.0, false},
    {"d",   FORMANT_PHONEME_PLOSIVE, 200, 1700, 2500, 3500, 4500, 100, 200, 300, 300, 400,  0.2, 0.1, 0.1, 0.0, 0.0,   60, 0.05, 0.0, true},
    {"k",   FORMANT_PHONEME_PLOSIVE, 200, 2500, 3000, 3500, 4500, 100, 200, 300, 300, 400,  0.0, 0.0, 0.0, 0.0, 0.0,   80, 0.1, 0.0, false},
    {"g",   FORMANT_PHONEME_PLOSIVE, 200, 2500, 3000, 3500, 4500, 100, 200, 300, 300, 400,  0.2, 0.1, 0.1, 0.0, 0.0,   80, 0.05, 0.0, true},

    /* Fricatives */
    {"f",   FORMANT_PHONEME_FRICATIVE, 200, 1400, 3000, 4000, 5000, 150, 250, 350, 400, 500,  0.0, 0.0, 0.0, 0.0, 0.0,  120, 0.0, 0.8, false},
    {"v",   FORMANT_PHONEME_FRICATIVE, 200, 1400, 3000, 4000, 5000, 150, 250, 350, 400, 500,  0.3, 0.2, 0.1, 0.0, 0.0,  120, 0.0, 0.7, true},
    {"s",   FORMANT_PHONEME_FRICATIVE, 200, 1800, 2500, 4000, 5500, 200, 300, 400, 500, 600,  0.0, 0.0, 0.0, 0.0, 0.0,  120, 0.0, 0.9, false},
    {"z",   FORMANT_PHONEME_FRICATIVE, 200, 1800, 2500, 4000, 5500, 200, 300, 400, 500, 600,  0.2, 0.1, 0.1, 0.0, 0.0,  120, 0.0, 0.8, true},
    {"sh",  FORMANT_PHONEME_FRICATIVE, 200, 1700, 2300, 3500, 4500, 200, 300, 400, 500, 600,  0.0, 0.0, 0.0, 0.0, 0.0,  140, 0.0, 0.85, false},
    {"zh",  FORMANT_PHONEME_FRICATIVE, 200, 1700, 2300, 3500, 4500, 200, 300, 400, 500, 600,  0.2, 0.1, 0.1, 0.0, 0.0,  140, 0.0, 0.75, true},
    {"h",   FORMANT_PHONEME_FRICATIVE, 500, 1500, 2500, 3500, 4500, 200, 300, 400, 500, 600,  0.0, 0.0, 0.0, 0.0, 0.0,   80, 0.8, 0.0, false},

    /* Approximants */
    {"w",   FORMANT_PHONEME_APPROXIMANT, 300,  700, 2300, 3500, 4500,  50, 100, 150, 150, 200,  0.9, 0.7, 0.6, 0.4, 0.3,  100, 0.0, 0.0, true},
    {"j",   FORMANT_PHONEME_APPROXIMANT, 300, 2300, 3000, 3500, 4500,  50, 100, 150, 150, 200,  0.9, 0.9, 0.7, 0.5, 0.3,  100, 0.0, 0.0, true},
    {"y",   FORMANT_PHONEME_APPROXIMANT, 300, 2300, 3000, 3500, 4500,  50, 100, 150, 150, 200,  0.9, 0.9, 0.7, 0.5, 0.3,  100, 0.0, 0.0, true},

    /* Laterals */
    {"l",   FORMANT_PHONEME_LATERAL, 400, 1200, 2800, 3500, 4500,  60, 120, 180, 180, 220,  0.9, 0.7, 0.6, 0.4, 0.3,  100, 0.0, 0.0, true},

    /* Rhotics */
    {"r",   FORMANT_PHONEME_RHOTIC, 350, 1400, 1600, 3500, 4500,  60, 120, 180, 180, 220,  0.9, 0.8, 0.7, 0.5, 0.3,  100, 0.0, 0.0, true},

    /* Special */
    {"rest", FORMANT_PHONEME_SILENCE, 500, 1500, 2500, 3500, 4500,  50, 100, 150, 150, 200,  0.0, 0.0, 0.0, 0.0, 0.0,  100, 0.0, 0.0, false},
};

static const int PHONEME_TABLE_SIZE = sizeof(PHONEME_TABLE) / sizeof(PHONEME_TABLE[0]);

const formant_phoneme_config_t* formant_get_phoneme(const char* ipa) {
    if (!ipa) return NULL;

    for (int i = 0; i < PHONEME_TABLE_SIZE; i++) {
        if (strcmp(PHONEME_TABLE[i].ipa, ipa) == 0) {
            return &PHONEME_TABLE[i];
        }
    }

    return NULL;  /* Not found */
}

const formant_phoneme_config_t* formant_get_all_phonemes(int* count) {
    if (count) {
        *count = PHONEME_TABLE_SIZE;
    }
    return PHONEME_TABLE;
}

void formant_interpolate_phonemes(
    const formant_phoneme_config_t* from,
    const formant_phoneme_config_t* to,
    float t,
    float* f1, float* f2, float* f3, float* f4, float* f5)
{
    if (!from || !to) return;

    if (f1) *f1 = formant_lerp(from->f1, to->f1, t);
    if (f2) *f2 = formant_lerp(from->f2, to->f2, t);
    if (f3) *f3 = formant_lerp(from->f3, to->f3, t);
    if (f4) *f4 = formant_lerp(from->f4, to->f4, t);
    if (f5) *f5 = formant_lerp(from->f5, to->f5, t);
}

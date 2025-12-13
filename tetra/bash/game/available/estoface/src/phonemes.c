/*
 * phonemes.c - IPA phoneme presets
 */

#include "phonemes.h"
#include "state.h"
#include <stdio.h>
#include <math.h>
#include <string.h>

/* Phoneme preset database - 4x4 grid covering vowel space */
static const PhonemePreset phoneme_presets[] = {
    /* ROW 0 (Zone Y=0): High/Close vowels - tongue height 0.9 */
    {
        .symbol = "u",  /* Zone [0,0]: Back high rounded */
        .description = "Close back rounded [boot]",
        .state = {
            .jaw_openness = 0.2f,
            .tongue_height = 0.9f,
            .tongue_frontness = 0.1f,
            .lip_rounding = 0.9f,
            .lip_protrusion = 0.8f,
            .lip_corner_height = 0.5f
        }
    },
    {
        .symbol = "ʉ",  /* Zone [1,0]: Central high rounded */
        .description = "Close central rounded [rue]",
        .state = {
            .jaw_openness = 0.2f,
            .tongue_height = 0.9f,
            .tongue_frontness = 0.4f,
            .lip_rounding = 0.7f,
            .lip_protrusion = 0.5f,
            .lip_corner_height = 0.5f
        }
    },
    {
        .symbol = "ɨ",  /* Zone [2,0]: Central high unrounded */
        .description = "Close central unrounded [roses]",
        .state = {
            .jaw_openness = 0.2f,
            .tongue_height = 0.9f,
            .tongue_frontness = 0.6f,
            .lip_rounding = 0.0f,
            .lip_corner_height = 0.5f
        }
    },
    {
        .symbol = "i",  /* Zone [3,0]: Front high unrounded */
        .description = "Close front unrounded [beet]",
        .state = {
            .jaw_openness = 0.2f,
            .tongue_height = 0.9f,
            .tongue_frontness = 0.9f,
            .lip_rounding = 0.0f,
            .lip_corner_height = 0.6f
        }
    },

    /* ROW 1 (Zone Y=1): Close-mid vowels - tongue height 0.6 */
    {
        .symbol = "o",  /* Zone [0,1]: Back mid rounded */
        .description = "Close-mid back rounded [boat]",
        .state = {
            .jaw_openness = 0.4f,
            .tongue_height = 0.6f,
            .tongue_frontness = 0.1f,
            .lip_rounding = 0.8f,
            .lip_protrusion = 0.6f,
            .lip_corner_height = 0.5f
        }
    },
    {
        .symbol = "ɵ",  /* Zone [1,1]: Central mid rounded */
        .description = "Close-mid central rounded",
        .state = {
            .jaw_openness = 0.4f,
            .tongue_height = 0.6f,
            .tongue_frontness = 0.4f,
            .lip_rounding = 0.5f,
            .lip_protrusion = 0.4f,
            .lip_corner_height = 0.5f
        }
    },
    {
        .symbol = "ɘ",  /* Zone [2,1]: Central mid unrounded */
        .description = "Close-mid central unrounded",
        .state = {
            .jaw_openness = 0.4f,
            .tongue_height = 0.6f,
            .tongue_frontness = 0.6f,
            .lip_rounding = 0.0f,
            .lip_corner_height = 0.5f
        }
    },
    {
        .symbol = "e",  /* Zone [3,1]: Front mid unrounded */
        .description = "Close-mid front unrounded [bay]",
        .state = {
            .jaw_openness = 0.4f,
            .tongue_height = 0.6f,
            .tongue_frontness = 0.9f,
            .lip_rounding = 0.0f,
            .lip_corner_height = 0.5f
        }
    },

    /* ROW 2 (Zone Y=2): Open-mid vowels - tongue height 0.4 */
    {
        .symbol = "ɔ",  /* Zone [0,2]: Back open-mid rounded */
        .description = "Open-mid back rounded [law]",
        .state = {
            .jaw_openness = 0.6f,
            .tongue_height = 0.4f,
            .tongue_frontness = 0.1f,
            .lip_rounding = 0.7f,
            .lip_protrusion = 0.3f,
            .lip_corner_height = 0.5f
        }
    },
    {
        .symbol = "ɜ",  /* Zone [1,2]: Central open-mid */
        .description = "Open-mid central [bird]",
        .state = {
            .jaw_openness = 0.6f,
            .tongue_height = 0.4f,
            .tongue_frontness = 0.4f,
            .lip_rounding = 0.0f,
            .lip_corner_height = 0.5f
        }
    },
    {
        .symbol = "ə",  /* Zone [2,2]: Schwa */
        .description = "Mid central [about]",
        .state = {
            .jaw_openness = 0.5f,
            .tongue_height = 0.4f,
            .tongue_frontness = 0.6f,
            .lip_rounding = 0.0f,
            .lip_corner_height = 0.5f
        }
    },
    {
        .symbol = "ɛ",  /* Zone [3,2]: Front open-mid */
        .description = "Open-mid front [bet]",
        .state = {
            .jaw_openness = 0.6f,
            .tongue_height = 0.4f,
            .tongue_frontness = 0.9f,
            .lip_rounding = 0.0f,
            .lip_corner_height = 0.5f
        }
    },

    /* ROW 3 (Zone Y=3): Open/Low vowels - tongue height 0.1 */
    {
        .symbol = "ɑ",  /* Zone [0,3]: Back low unrounded */
        .description = "Open back unrounded [father]",
        .state = {
            .jaw_openness = 0.9f,
            .tongue_height = 0.1f,
            .tongue_frontness = 0.1f,
            .lip_rounding = 0.0f,
            .lip_corner_height = 0.5f
        }
    },
    {
        .symbol = "ɐ",  /* Zone [1,3]: Central low */
        .description = "Near-open central [but]",
        .state = {
            .jaw_openness = 0.8f,
            .tongue_height = 0.1f,
            .tongue_frontness = 0.4f,
            .lip_rounding = 0.0f,
            .lip_corner_height = 0.5f
        }
    },
    {
        .symbol = "æ",  /* Zone [2,3]: Front-central low */
        .description = "Near-open front [cat]",
        .state = {
            .jaw_openness = 0.8f,
            .tongue_height = 0.2f,
            .tongue_frontness = 0.7f,
            .lip_rounding = 0.0f,
            .lip_corner_height = 0.5f
        }
    },
    {
        .symbol = "a",  /* Zone [3,3]: Front low */
        .description = "Open front unrounded [bat]",
        .state = {
            .jaw_openness = 0.9f,
            .tongue_height = 0.1f,
            .tongue_frontness = 0.9f,
            .lip_rounding = 0.0f,
            .lip_corner_height = 0.5f
        }
    },

    /* Terminator */
    { .symbol = NULL }
};

/* Get phoneme preset by IPA symbol */
const PhonemePreset* phoneme_get_preset(const char *symbol) {
    for (int i = 0; phoneme_presets[i].symbol != NULL; i++) {
        if (strcmp(phoneme_presets[i].symbol, symbol) == 0) {
            return &phoneme_presets[i];
        }
    }
    return NULL;
}

/* Apply phoneme preset to state */
void phoneme_apply(FacialState *state, const char *symbol, float rate) {
    const PhonemePreset *preset = phoneme_get_preset(symbol);
    if (!preset) return;
    
    /* Simple immediate application (TODO: use animation system) */
    state->jaw_openness = preset->state.jaw_openness;
    state->tongue_height = preset->state.tongue_height;
    state->tongue_frontness = preset->state.tongue_frontness;
    state->lip_rounding = preset->state.lip_rounding;
    state->lip_corner_height = preset->state.lip_corner_height;
    
    (void)rate; /* Unused for now */
}

/* List all available phonemes */
void phoneme_list_all(void) {
    for (int i = 0; phoneme_presets[i].symbol != NULL; i++) {
        printf("  %s - %s\n", 
               phoneme_presets[i].symbol,
               phoneme_presets[i].description);
    }
}

/* Calculate Euclidean distance between two facial states */
float phoneme_state_distance(const FacialState *a, const FacialState *b) {
    /* Weight important articulatory parameters more heavily */
    float d_jaw = (a->jaw_openness - b->jaw_openness) * 2.0f;          /* 2x weight */
    float d_tongue_h = (a->tongue_height - b->tongue_height) * 1.5f;   /* 1.5x weight */
    float d_tongue_f = (a->tongue_frontness - b->tongue_frontness) * 1.5f;
    float d_rounding = (a->lip_rounding - b->lip_rounding) * 1.2f;
    float d_corners = (a->lip_corner_height - b->lip_corner_height) * 0.5f;  /* Less important */
    
    /* Sum of squares */
    float dist_sq = d_jaw * d_jaw + 
                    d_tongue_h * d_tongue_h + 
                    d_tongue_f * d_tongue_f +
                    d_rounding * d_rounding +
                    d_corners * d_corners;
    
    return sqrtf(dist_sq);
}

/* Find closest matching IPA phoneme */
const PhonemePreset* phoneme_find_closest(const FacialState *state) {
    const PhonemePreset *closest = NULL;
    float min_distance = 999999.0f;
    
    for (int i = 0; phoneme_presets[i].symbol != NULL; i++) {
        float dist = phoneme_state_distance(state, &phoneme_presets[i].state);
        if (dist < min_distance) {
            min_distance = dist;
            closest = &phoneme_presets[i];
        }
    }
    
    return closest;
}

/* Generate esto format code for a phoneme */
void phoneme_to_esto(const PhonemePreset *phoneme, int duration_ms, int pitch_hz, char *buf, size_t bufsize) {
    if (!phoneme || !buf) return;

    snprintf(buf, bufsize, "%s:%d:%d", phoneme->symbol, duration_ms, pitch_hz);
}

/* Get phoneme by zone coordinates - phonemes are arranged in 4x4 grid */
const PhonemePreset* phoneme_get_by_zone(int zone_x, int zone_y) {
    /* Clamp to valid range */
    if (zone_x < 0) zone_x = 0;
    if (zone_x > 3) zone_x = 3;
    if (zone_y < 0) zone_y = 0;
    if (zone_y > 3) zone_y = 3;

    /* Phonemes are stored in row-major order: Y*4 + X */
    int index = zone_y * 4 + zone_x;

    /* Safety check */
    if (index < 0 || index >= 16) return NULL;

    return &phoneme_presets[index];
}

/* Calculate effective vocal tract length based on articulator positions
 * Formula: tract_length = base_length + (jaw_openness * jaw_length_scale) + (lip_protrusion * protrusion_length_scale)
 * See ACOUSTIC_MODEL.md for detailed documentation of parameters and acoustic theory
 */
float calculate_vocal_tract_length(const FacialState *state) {
    if (!state) return 0.0f;

    /* Parameters from ACOUSTIC_MODEL.md */
    const float base_length = 17.5f;              /* cm - typical adult neutral tract length */
    const float jaw_length_scale = 2.0f;          /* cm - maximum jaw contribution to length */
    const float protrusion_length_scale = 1.5f;   /* cm - maximum lip protrusion contribution */

    /* Calculate effective length */
    float jaw_contribution = state->jaw_openness * jaw_length_scale;
    float protrusion_contribution = state->lip_protrusion * protrusion_length_scale;

    float tract_length = base_length + jaw_contribution + protrusion_contribution;

    return tract_length;  /* Returns length in centimeters */
}

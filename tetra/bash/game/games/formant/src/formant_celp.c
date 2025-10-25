/**
 * formant_celp.c
 *
 * CELP synthesis using pre-generated excitation codebook and LPC filtering.
 * Provides simple yet effective vocal texture through code-excited linear prediction.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "formant.h"
#include "excitation_codebook.h"

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

/* ============================================================================
 * Simple LPC Filter (All-Pole IIR)
 * ========================================================================= */

void formant_lpc_filter_init(formant_lpc_filter_t* lpc) {
    memset(lpc, 0, sizeof(formant_lpc_filter_t));
    lpc->gain = 1.0f;
}

float formant_lpc_filter_process(formant_lpc_filter_t* lpc, float excitation) {
    // All-pole IIR filter: y[n] = x[n] * gain - sum(a[i] * y[n-i])
    float output = excitation * lpc->gain;

    for (int i = 0; i < 10; i++) {
        output -= lpc->a[i] * lpc->mem[i];
    }

    // Shift filter memory
    for (int i = 9; i > 0; i--) {
        lpc->mem[i] = lpc->mem[i-1];
    }
    lpc->mem[0] = output;

    return output;
}

/* ============================================================================
 * Hand-Crafted LPC Coefficients (Simple Vowel Approximations)
 * ========================================================================= */

// LPC coefficients that approximate vowel formants
// Very conservative to ensure stability - no feedback > 1.0 total

static const float LPC_A[] = {  // Open vowel /a/
    0.3f, -0.15f, 0.08f, -0.04f, 0.02f,
    -0.01f, 0.005f, -0.002f, 0.001f, -0.0005f
};

static const float LPC_I[] = {  // Close front vowel /i/
    0.4f, -0.2f, 0.1f, -0.05f, 0.025f,
    -0.012f, 0.006f, -0.003f, 0.0015f, -0.0007f
};

static const float LPC_E[] = {  // Mid-front vowel /e/
    0.35f, -0.18f, 0.09f, -0.045f, 0.022f,
    -0.011f, 0.005f, -0.003f, 0.0015f, -0.0007f
};

static const float LPC_O[] = {  // Mid-back vowel /o/
    0.32f, -0.16f, 0.08f, -0.04f, 0.02f,
    -0.01f, 0.005f, -0.002f, 0.001f, -0.0005f
};

static const float LPC_U[] = {  // Close back vowel /u/
    0.28f, -0.14f, 0.07f, -0.035f, 0.017f,
    -0.008f, 0.004f, -0.002f, 0.001f, -0.0005f
};

static const float LPC_SCHWA[] = {  // Neutral vowel /ə/
    0.3f, -0.15f, 0.075f, -0.037f, 0.018f,
    -0.009f, 0.004f, -0.002f, 0.001f, -0.0005f
};

static const float LPC_FRICATIVE[] = {  // Fricative (noise-like)
    0.2f, -0.1f, 0.05f, -0.025f, 0.012f,
    -0.006f, 0.003f, -0.0015f, 0.0007f, -0.0003f
};

static const float LPC_NASAL[] = {  // Nasal (low resonance)
    0.38f, -0.19f, 0.095f, -0.047f, 0.023f,
    -0.011f, 0.006f, -0.003f, 0.0015f, -0.0007f
};

/* Get LPC coefficients for phoneme */
static const float* get_lpc_for_phoneme_char(char phoneme) {
    switch (phoneme) {
        case 'a': return LPC_A;
        case 'i': return LPC_I;
        case 'e': return LPC_E;
        case 'o': return LPC_O;
        case 'u': return LPC_U;
        default:  return LPC_SCHWA;
    }
}

/* ============================================================================
 * Excitation Selection
 * ========================================================================= */

static const excitation_vector_t* select_excitation_for_phoneme(
    const formant_phoneme_config_t* phoneme,
    float pitch)
{
    if (!phoneme) {
        return get_excitation_by_name("voice_soft_mid");
    }

    // Select based on phoneme type and pitch
    const char* pitch_suffix = (pitch < 110) ? "_low" : (pitch > 140) ? "_high" : "_mid";

    switch (phoneme->type) {
        case FORMANT_PHONEME_VOWEL:
            // Use voiced excitation
            if (phoneme->aspiration > 0.3f) {
                return get_excitation_by_name("voice_breathy_mid");
            } else {
                char name[64];
                snprintf(name, sizeof(name), "voice_soft%s", pitch_suffix);
                const excitation_vector_t* exc = get_excitation_by_name(name);
                return exc ? exc : get_excitation_by_name("voice_soft_mid");
            }

        case FORMANT_PHONEME_FRICATIVE:
            // Use noise excitation
            if (phoneme->frication > 0.7f) {
                return get_excitation_by_name("noise_hiss");
            } else if (phoneme->frication > 0.4f) {
                return get_excitation_by_name("noise_shush");
            } else {
                return get_excitation_by_name("noise_white");
            }

        case FORMANT_PHONEME_PLOSIVE:
            // Use burst excitation
            {
                char name[64];
                snprintf(name, sizeof(name), "burst_ring%s", pitch_suffix);
                const excitation_vector_t* exc = get_excitation_by_name(name);
                return exc ? exc : get_excitation_by_name("burst_ring_mid");
            }

        case FORMANT_PHONEME_NASAL:
            // Use nasal hum
            {
                char name[64];
                snprintf(name, sizeof(name), "nasal_hum%s", pitch_suffix);
                const excitation_vector_t* exc = get_excitation_by_name(name);
                return exc ? exc : get_excitation_by_name("nasal_hum_mid");
            }

        case FORMANT_PHONEME_APPROXIMANT:
        case FORMANT_PHONEME_LATERAL:
        case FORMANT_PHONEME_RHOTIC:
            // Use voiced excitation
            {
                char name[64];
                snprintf(name, sizeof(name), "voice_soft%s", pitch_suffix);
                const excitation_vector_t* exc = get_excitation_by_name(name);
                return exc ? exc : get_excitation_by_name("voice_soft_mid");
            }

        default:
            return get_excitation_by_name("voice_soft_mid");
    }
}

/* ============================================================================
 * CELP Engine Public API
 * ========================================================================= */

void formant_celp_init(formant_celp_engine_t* celp) {
    if (!celp) return;

    formant_lpc_filter_init(&celp->lpc);
    celp->current_excitation = NULL;
    celp->excitation_position = 0;
    celp->excitation_length = EXCITATION_VECTOR_LENGTH;
    celp->excitation_loop = true;

    // Set default LPC coefficients (schwa/neutral)
    memcpy(celp->lpc.a, LPC_SCHWA, sizeof(float) * 10);
    celp->lpc.gain = 0.5f;  // Conservative gain to prevent instability
}

void formant_celp_set_lpc(formant_celp_engine_t* celp, const char* phoneme) {
    if (!celp || !phoneme) return;

    // Get LPC coefficients based on first character of phoneme
    const float* lpc_coeff = get_lpc_for_phoneme_char(phoneme[0]);
    memcpy(celp->lpc.a, lpc_coeff, sizeof(float) * 10);
}

void formant_celp_select_excitation(
    formant_celp_engine_t* celp,
    const formant_phoneme_config_t* phoneme,
    float pitch)
{
    if (!celp) return;

    const excitation_vector_t* excitation = select_excitation_for_phoneme(phoneme, pitch);
    if (excitation) {
        celp->current_excitation = excitation;
        celp->excitation_position = 0;
        celp->excitation_length = EXCITATION_VECTOR_LENGTH;

        // Smoothly transition LPC filter to avoid pops
        // Don't clear filter memory - let it transition naturally

        // Set appropriate LPC coefficients
        if (phoneme) {
            const float* lpc_coeff;
            switch (phoneme->type) {
                case FORMANT_PHONEME_VOWEL:
                    lpc_coeff = get_lpc_for_phoneme_char(phoneme->ipa[0]);
                    break;
                case FORMANT_PHONEME_FRICATIVE:
                    lpc_coeff = LPC_FRICATIVE;
                    break;
                case FORMANT_PHONEME_NASAL:
                    lpc_coeff = LPC_NASAL;
                    break;
                default:
                    lpc_coeff = LPC_SCHWA;
                    break;
            }
            // Smoothly interpolate coefficients to avoid discontinuities
            for (int i = 0; i < 10; i++) {
                celp->lpc.a[i] = 0.8f * celp->lpc.a[i] + 0.2f * lpc_coeff[i];
            }
        }

        // Determine if this phoneme should loop excitation
        if (phoneme) {
            celp->excitation_loop = (phoneme->type == FORMANT_PHONEME_VOWEL ||
                                     phoneme->type == FORMANT_PHONEME_NASAL ||
                                     phoneme->type == FORMANT_PHONEME_FRICATIVE);
        }
    }
}

float formant_celp_process_sample(formant_celp_engine_t* celp) {
    if (!celp || !celp->current_excitation) {
        return 0.0f;
    }

    const excitation_vector_t* exc = (const excitation_vector_t*)celp->current_excitation;

    // Get current excitation sample
    float excitation = exc->samples[celp->excitation_position];

    // Apply crossfade at loop boundary to prevent clicking
    if (celp->excitation_loop) {
        int fade_length = 20;  // Crossfade over 20 samples

        if (celp->excitation_position < fade_length) {
            // Fade in from loop point
            float fade = (float)celp->excitation_position / (float)fade_length;
            int prev_pos = celp->excitation_length - fade_length + celp->excitation_position;
            float prev_sample = exc->samples[prev_pos];
            excitation = prev_sample * (1.0f - fade) + excitation * fade;
        }
    }

    // Advance position
    celp->excitation_position++;

    // Handle looping or end of excitation
    if (celp->excitation_position >= celp->excitation_length) {
        if (celp->excitation_loop) {
            celp->excitation_position = 0;  // Loop back to start
        } else {
            celp->excitation_position = celp->excitation_length - 1;  // Hold last sample
            excitation = 0.0f;  // Fade to silence
        }
    }

    // Filter through LPC
    float output = formant_lpc_filter_process(&celp->lpc, excitation);

    // Apply gain to match formant synthesis levels (reduced to match formant RMS)
    output *= 0.15f;

    // Simple one-pole low-pass to warm up the sound (reduce brightness)
    static float lpf_state = 0.0f;
    float alpha = 0.3f;  // Low-pass coefficient (higher = more filtering)
    lpf_state = alpha * output + (1.0f - alpha) * lpf_state;
    output = lpf_state;

    // Soft clipping
    if (output > 0.9f) output = 0.9f;
    if (output < -0.9f) output = -0.9f;

    return output;
}

/* ============================================================================
 * Engine Mode Control
 * ========================================================================= */

void formant_engine_set_mode(formant_engine_t* engine, formant_synth_mode_t mode) {
    if (!engine) return;
    engine->synth_mode = mode;
}

void formant_engine_set_hybrid_mix(formant_engine_t* engine, float mix) {
    if (!engine) return;
    engine->hybrid_mix = formant_clamp(mix, 0.0f, 1.0f);
}

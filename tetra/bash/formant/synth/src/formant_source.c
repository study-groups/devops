/**
 * formant_source.c
 *
 * Source signal generators for vocal synthesis.
 * Implements glottal pulse (LF model) and noise sources.
 */

#include <math.h>
#include <stdlib.h>
#include "formant.h"

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

/* Random number generator state */
static unsigned long rng_state = 1;

float formant_generate_glottal(float phase, float oq, float alpha) {
    /* Simplified Liljencrants-Fant (LF) glottal pulse model
     *
     * phase: 0.0 to 1.0 (position in pitch period)
     * oq: open quotient (0.3-0.7, typically 0.6)
     * alpha: spectral tilt (0.5-1.0, higher = brighter)
     */

    if (phase < 0.0f) phase = 0.0f;
    if (phase >= 1.0f) phase = 0.999f;

    /* Open phase (glottal opening) */
    if (phase < oq) {
        /* Rising sinusoidal flow */
        float t = phase / oq;
        float flow = (1.0f - cosf(M_PI * t)) * 0.5f;

        /* Apply spectral tilt */
        flow = powf(flow, alpha);

        return flow;
    }
    /* Closing phase (rapid closure) */
    else {
        /* Exponential decay */
        float t = (phase - oq) / (1.0f - oq);
        float decay_rate = 8.0f;  /* Faster decay = sharper closure */
        float flow = expf(-decay_rate * t);

        /* Apply spectral tilt */
        flow = powf(flow, alpha);

        return flow * 0.3f;  /* Reduced amplitude in closing phase */
    }
}

float formant_generate_white_noise(void) {
    /* Simple LCG (Linear Congruential Generator) */
    rng_state = rng_state * 1103515245 + 12345;
    return ((float)(rng_state & 0x7FFFFFFF) / (float)0x7FFFFFFF) * 2.0f - 1.0f;
}

float formant_generate_aspiration(float intensity) {
    /* Aspiration is low-pass filtered white noise */
    static float prev = 0.0f;
    float noise = formant_generate_white_noise();

    /* Simple one-pole low-pass filter (cutoff ~8 kHz @ 48kHz) */
    float alpha_lpf = 0.7f;
    prev = prev * (1.0f - alpha_lpf) + noise * alpha_lpf;

    return prev * intensity;
}

float formant_generate_frication(float intensity, float cutoff_freq) {
    /* Frication is band-pass filtered noise (2-10 kHz) */
    static float prev1 = 0.0f, prev2 = 0.0f;
    float noise = formant_generate_white_noise();

    /* Simple band-pass approximation (high-pass then low-pass) */
    /* High-pass: cutoff ~2 kHz */
    float hp_alpha = 0.85f;
    float hp_out = noise - prev1 * hp_alpha;
    prev1 = noise;

    /* Low-pass: cutoff ~10 kHz */
    float lp_alpha = 0.5f;
    prev2 = prev2 * (1.0f - lp_alpha) + hp_out * lp_alpha;

    /* Adjust based on cutoff frequency (for different fricatives) */
    float freq_factor = cutoff_freq / 6000.0f;  /* Normalized around 6 kHz */

    return prev2 * intensity * freq_factor;
}

float formant_generate_plosive_burst(float time_in_burst, float intensity, float freq) {
    /* Generate plosive burst (p, t, k, b, d, g)
     * time_in_burst: 0.0 to 1.0 within burst duration
     * intensity: burst strength
     * freq: center frequency for burst coloring
     */

    if (time_in_burst >= 1.0f) return 0.0f;

    /* Envelope: sharp attack, exponential decay */
    float envelope = expf(-8.0f * time_in_burst);

    /* Noise burst (broadband for voiceless, more tonal for voiced) */
    float noise = formant_generate_white_noise();

    /* High-pass filter for burst coloration */
    static float prev = 0.0f;
    float hp_alpha = 0.5f + (freq / 8000.0f) * 0.4f;
    float filtered = noise - prev * hp_alpha;
    prev = noise;

    return filtered * envelope * intensity;
}

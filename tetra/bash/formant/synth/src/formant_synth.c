/**
 * formant_synth.c
 *
 * Formant filter bank implementation using biquad filters.
 */

#include <math.h>
#include <string.h>
#include "formant.h"

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

void formant_filter_init(formant_filter_t* filter, float freq, float bw, float sample_rate) {
    if (!filter) return;

    memset(filter, 0, sizeof(formant_filter_t));

    filter->freq = freq;
    filter->bw = bw;
    filter->gain = 1.0f;

    /* Calculate biquad coefficients for bandpass resonator */
    float Q = freq / bw;
    float omega = 2.0f * M_PI * freq / sample_rate;
    float alpha = sinf(omega) / (2.0f * Q);
    float cos_omega = cosf(omega);

    /* Bandpass filter (constant skirt gain, peak gain = Q) */
    filter->b0 = alpha;
    filter->b1 = 0.0f;
    filter->b2 = -alpha;

    float a0 = 1.0f + alpha;
    filter->a1 = -2.0f * cos_omega / a0;
    filter->a2 = (1.0f - alpha) / a0;

    /* Normalize numerator coefficients */
    filter->b0 /= a0;
    filter->b1 /= a0;
    filter->b2 /= a0;

    /* Initialize state */
    filter->x1 = filter->x2 = 0.0f;
    filter->y1 = filter->y2 = 0.0f;
}

void formant_filter_set_freq(formant_filter_t* filter, float freq, float sample_rate) {
    if (!filter) return;

    /* Recalculate coefficients if frequency changed significantly */
    if (fabsf(freq - filter->freq) > 1.0f) {
        formant_filter_init(filter, freq, filter->bw, sample_rate);
    }
}

float formant_filter_process(formant_filter_t* filter, float input) {
    if (!filter) return 0.0f;

    /* Apply biquad filter */
    float output = filter->b0 * input +
                   filter->b1 * filter->x1 +
                   filter->b2 * filter->x2 -
                   filter->a1 * filter->y1 -
                   filter->a2 * filter->y2;

    /* Update state */
    filter->x2 = filter->x1;
    filter->x1 = input;
    filter->y2 = filter->y1;
    filter->y1 = output;

    return output * filter->gain;
}

void formant_bank_process(formant_bank_t* bank, const float* input, float* output, int num_samples) {
    if (!bank || !input || !output) return;

    /* Clear output buffer */
    memset(output, 0, num_samples * sizeof(float));

    /* Process each formant and sum */
    for (int f = 0; f < bank->num_formants; f++) {
        for (int i = 0; i < num_samples; i++) {
            output[i] += formant_filter_process(&bank->filters[f], input[i]);
        }
    }

    /* Normalize by number of formants to prevent clipping */
    float scale = 1.0f / sqrtf((float)bank->num_formants);
    for (int i = 0; i < num_samples; i++) {
        output[i] *= scale;
    }
}

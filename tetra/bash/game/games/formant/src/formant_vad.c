/**
 * formant_vad.c
 *
 * Voice Activity Detection (VAD) implementation
 * Multi-feature approach using energy, zero-crossing rate, and spectral flatness
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "formant.h"

/* ============================================================================
 * Constants
 * ========================================================================= */

#define VAD_FRAME_SIZE_MS 10        /* 10ms frames */
#define VAD_HISTORY_LENGTH 5        /* Smooth over 5 frames (50ms) */
#define VAD_PRETRIGGER_MS 100       /* 100ms pre-trigger buffer */

/* Mode-dependent parameters */
static const struct {
    float energy_multiplier;        /* Multiply noise floor by this */
    float zcr_threshold;            /* Max ZCR for speech */
    float sf_threshold;             /* Max spectral flatness for speech */
    int hangover_frames;            /* Frames to continue after speech */
    int min_speech_frames;          /* Min consecutive frames to confirm speech */
} vad_modes[] = {
    /* Mode 0: Quality - conservative, less likely to clip speech */
    {2.5f, 0.35f, 0.5f, 30, 2},     /* 300ms hangover, 20ms min speech */

    /* Mode 1: Balanced - good for most use cases */
    {3.0f, 0.30f, 0.45f, 20, 3},    /* 200ms hangover, 30ms min speech */

    /* Mode 2: Aggressive - clips silence quickly */
    {4.0f, 0.25f, 0.40f, 10, 4}     /* 100ms hangover, 40ms min speech */
};

/* ============================================================================
 * Helper Functions - Feature Calculations
 * ========================================================================= */

/**
 * Calculate RMS energy of audio frame
 */
static float calculate_energy(const float* samples, int count) {
    float sum = 0.0f;
    for (int i = 0; i < count; i++) {
        sum += samples[i] * samples[i];
    }
    return sqrtf(sum / count);
}

/**
 * Calculate zero-crossing rate
 * Returns normalized rate (0.0 to 1.0)
 */
static float calculate_zcr(const float* samples, int count) {
    int crossings = 0;
    for (int i = 1; i < count; i++) {
        if ((samples[i] >= 0.0f && samples[i-1] < 0.0f) ||
            (samples[i] < 0.0f && samples[i-1] >= 0.0f)) {
            crossings++;
        }
    }
    return (float)crossings / (float)(count - 1);
}

/**
 * Calculate spectral flatness (simplified, no FFT)
 * We use a time-domain approximation: variance / mean_absolute
 * Low values indicate harmonic content (speech)
 * High values indicate noise-like content
 */
static float calculate_spectral_flatness_approx(const float* samples, int count) {
    /* Calculate mean absolute value */
    float mean_abs = 0.0f;
    for (int i = 0; i < count; i++) {
        mean_abs += fabsf(samples[i]);
    }
    mean_abs /= count;

    if (mean_abs < 1e-6f) {
        return 1.0f;  /* Silence - treat as noise */
    }

    /* Calculate variance */
    float variance = 0.0f;
    for (int i = 0; i < count; i++) {
        float diff = fabsf(samples[i]) - mean_abs;
        variance += diff * diff;
    }
    variance /= count;

    /* Normalized flatness approximation */
    float flatness = sqrtf(variance) / mean_abs;

    /* Clamp to 0-1 range */
    if (flatness > 1.0f) flatness = 1.0f;

    return flatness;
}

/**
 * Update noise floor estimate using exponential moving average
 */
static void update_noise_floor(formant_vad_t* vad, float energy) {
    const float alpha = 0.95f;  /* Slow adaptation */
    vad->noise_floor = alpha * vad->noise_floor + (1.0f - alpha) * energy;
}

/* ============================================================================
 * VAD Public API
 * ========================================================================= */

formant_vad_t* formant_vad_create(float sample_rate, int mode) {
    if (mode < 0 || mode > 2) {
        fprintf(stderr, "ERROR: Invalid VAD mode %d (must be 0-2)\n", mode);
        return NULL;
    }

    formant_vad_t* vad = calloc(1, sizeof(formant_vad_t));
    if (!vad) {
        return NULL;
    }

    /* Configuration */
    vad->sample_rate = sample_rate;
    vad->frame_size = (int)(sample_rate * VAD_FRAME_SIZE_MS / 1000.0f);
    vad->mode = mode;

    /* Allocate feature history */
    vad->history_length = VAD_HISTORY_LENGTH;
    vad->energy_history = calloc(VAD_HISTORY_LENGTH, sizeof(float));
    vad->zcr_history = calloc(VAD_HISTORY_LENGTH, sizeof(float));

    if (!vad->energy_history || !vad->zcr_history) {
        formant_vad_destroy(vad);
        return NULL;
    }

    /* Allocate pre-trigger buffer */
    vad->pretrigger_size = (int)(sample_rate * VAD_PRETRIGGER_MS / 1000.0f);
    vad->pretrigger_buffer = calloc(vad->pretrigger_size, sizeof(float));

    if (!vad->pretrigger_buffer) {
        formant_vad_destroy(vad);
        return NULL;
    }

    /* Initialize thresholds (will be set after calibration) */
    vad->energy_threshold = 0.01f;  /* Default low threshold */
    vad->zcr_threshold = vad_modes[mode].zcr_threshold;
    vad->sf_threshold = vad_modes[mode].sf_threshold;
    vad->noise_floor = 0.001f;      /* Very low default */
    vad->calibrated = false;

    /* State machine */
    vad->state = FORMANT_VAD_SILENCE;
    vad->hangover_max = vad_modes[mode].hangover_frames;
    vad->min_speech_frames = vad_modes[mode].min_speech_frames;
    vad->hangover_counter = 0;
    vad->speech_frames = 0;
    vad->silence_frames = 0;

    /* Pre-trigger buffer state */
    vad->pretrigger_pos = 0;
    vad->pretrigger_available = 0;

    /* Statistics */
    vad->frames_processed = 0;
    vad->speech_detected_count = 0;

    return vad;
}

void formant_vad_destroy(formant_vad_t* vad) {
    if (!vad) {
        return;
    }

    free(vad->energy_history);
    free(vad->zcr_history);
    free(vad->pretrigger_buffer);
    free(vad);
}

void formant_vad_reset(formant_vad_t* vad) {
    if (!vad) {
        return;
    }

    vad->state = FORMANT_VAD_SILENCE;
    vad->hangover_counter = 0;
    vad->speech_frames = 0;
    vad->silence_frames = 0;
    vad->history_pos = 0;
    vad->pretrigger_pos = 0;
    vad->pretrigger_available = 0;
    vad->frames_processed = 0;
    vad->speech_detected_count = 0;

    /* Clear history */
    memset(vad->energy_history, 0, vad->history_length * sizeof(float));
    memset(vad->zcr_history, 0, vad->history_length * sizeof(float));
}

void formant_vad_calibrate(formant_vad_t* vad, const float* samples, int num_samples) {
    if (!vad || !samples || num_samples < vad->frame_size) {
        return;
    }

    /* Process all frames to estimate noise floor */
    float total_energy = 0.0f;
    int num_frames = num_samples / vad->frame_size;

    for (int f = 0; f < num_frames; f++) {
        const float* frame = &samples[f * vad->frame_size];
        float energy = calculate_energy(frame, vad->frame_size);
        total_energy += energy;
    }

    /* Set noise floor to average energy */
    vad->noise_floor = total_energy / num_frames;

    /* Set energy threshold based on mode */
    vad->energy_threshold = vad->noise_floor * vad_modes[vad->mode].energy_multiplier;

    vad->calibrated = true;

    fprintf(stderr, "VAD calibrated: noise_floor=%.6f, energy_threshold=%.6f\n",
            vad->noise_floor, vad->energy_threshold);
}

formant_vad_result_t formant_vad_process_frame(formant_vad_t* vad, const float* samples, int frame_size) {
    if (!vad || !samples || frame_size != vad->frame_size) {
        return FORMANT_VAD_RESULT_SILENCE;
    }

    /* Add to pre-trigger buffer (circular) */
    for (int i = 0; i < frame_size; i++) {
        vad->pretrigger_buffer[vad->pretrigger_pos] = samples[i];
        vad->pretrigger_pos = (vad->pretrigger_pos + 1) % vad->pretrigger_size;

        if (vad->pretrigger_available < vad->pretrigger_size) {
            vad->pretrigger_available++;
        }
    }

    /* Calculate features */
    float energy = calculate_energy(samples, frame_size);
    float zcr = calculate_zcr(samples, frame_size);
    float sf = calculate_spectral_flatness_approx(samples, frame_size);

    /* Store in history */
    vad->energy_history[vad->history_pos] = energy;
    vad->zcr_history[vad->history_pos] = zcr;
    vad->history_pos = (vad->history_pos + 1) % vad->history_length;

    /* Update noise floor if in silence (slow adaptation) */
    if (vad->state == FORMANT_VAD_SILENCE && vad->calibrated) {
        update_noise_floor(vad, energy);
    }

    /* Speech decision: All three features must agree */
    bool is_speech = (energy > vad->energy_threshold) &&
                     (zcr < vad->zcr_threshold) &&
                     (sf < vad->sf_threshold);

    /* State machine */
    vad->frames_processed++;

    formant_vad_result_t result = FORMANT_VAD_RESULT_SILENCE;

    switch (vad->state) {
        case FORMANT_VAD_SILENCE:
            if (is_speech) {
                vad->speech_frames++;
                if (vad->speech_frames >= vad->min_speech_frames) {
                    /* Speech confirmed! */
                    vad->state = FORMANT_VAD_SPEECH_START;
                    vad->speech_detected_count++;
                    result = FORMANT_VAD_RESULT_SPEECH;
                }
            } else {
                vad->speech_frames = 0;
            }
            break;

        case FORMANT_VAD_SPEECH_START:
            /* Transition to continuous speech */
            vad->state = FORMANT_VAD_SPEECH;
            result = FORMANT_VAD_RESULT_SPEECH;
            break;

        case FORMANT_VAD_SPEECH:
            if (is_speech) {
                /* Continue speech */
                vad->silence_frames = 0;
                vad->hangover_counter = 0;
                result = FORMANT_VAD_RESULT_SPEECH;
            } else {
                /* Possible end of speech */
                vad->silence_frames++;
                vad->state = FORMANT_VAD_SPEECH_END;
                vad->hangover_counter = vad->hangover_max;
                result = FORMANT_VAD_RESULT_SPEECH;  /* Hangover starts */
            }
            break;

        case FORMANT_VAD_SPEECH_END:
            if (is_speech) {
                /* False alarm - speech continues */
                vad->state = FORMANT_VAD_SPEECH;
                vad->silence_frames = 0;
                vad->hangover_counter = 0;
                result = FORMANT_VAD_RESULT_SPEECH;
            } else {
                /* Continue hangover */
                vad->hangover_counter--;
                if (vad->hangover_counter > 0) {
                    result = FORMANT_VAD_RESULT_SPEECH;  /* Still in hangover */
                } else {
                    /* Hangover expired - back to silence */
                    vad->state = FORMANT_VAD_SILENCE;
                    vad->speech_frames = 0;
                    vad->silence_frames = 0;
                    result = FORMANT_VAD_RESULT_SILENCE;
                }
            }
            break;
    }

    return result;
}

formant_vad_state_t formant_vad_get_state(formant_vad_t* vad) {
    if (!vad) {
        return FORMANT_VAD_SILENCE;
    }
    return vad->state;
}

int formant_vad_get_pretrigger(formant_vad_t* vad, float* output, int max_samples) {
    if (!vad || !output || max_samples <= 0) {
        return 0;
    }

    /* Determine how many samples to copy */
    int samples_to_copy = vad->pretrigger_available;
    if (samples_to_copy > max_samples) {
        samples_to_copy = max_samples;
    }

    /* Calculate starting position in circular buffer */
    int start_pos = (vad->pretrigger_pos - vad->pretrigger_available + vad->pretrigger_size) % vad->pretrigger_size;

    /* Copy samples from circular buffer */
    for (int i = 0; i < samples_to_copy; i++) {
        int pos = (start_pos + i) % vad->pretrigger_size;
        output[i] = vad->pretrigger_buffer[pos];
    }

    return samples_to_copy;
}

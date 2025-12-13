/**
 * formant_metering.c
 *
 * Professional VU metering with FIR filtering and ballistics
 * Supports A-weighting, VU response, and custom frequency weightings
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "formant.h"

/* ============================================================================
 * Constants
 * ========================================================================= */

#define METER_MIN_DB -60.0f
#define METER_MAX_DB 0.0f
#define METER_REFERENCE_LEVEL 0.7746f  /* 0dB = -2.2dBFS for VU meter */

/* Standard ballistics presets */
typedef struct {
    const char* name;
    float attack_ms;      /* Time to reach 99% */
    float release_ms;     /* Time to reach 1% */
    float integration_ms; /* RMS window */
    float peak_hold_ms;   /* Peak hold time */
} ballistics_preset_t;

static const ballistics_preset_t BALLISTICS_PRESETS[] = {
    {"vu",      300.0f, 300.0f, 300.0f, 1500.0f},  /* Classic VU meter */
    {"ppm",     10.0f,  1500.0f, 10.0f, 1500.0f},  /* Peak Program Meter */
    {"rms",     100.0f, 100.0f, 100.0f, 1500.0f},  /* Fast RMS */
    {"peak",    0.0f,   1500.0f, 0.0f,  1500.0f},  /* Peak only */
};

/* ============================================================================
 * Helper Functions
 * ========================================================================= */

/**
 * Convert linear amplitude to dB
 */
static inline float amp_to_db(float amp) {
    if (amp < 1e-10f) {
        return METER_MIN_DB;
    }
    return 20.0f * log10f(amp);
}

/**
 * Convert dB to linear amplitude
 */
static inline float db_to_amp(float db) {
    return powf(10.0f, db / 20.0f);
}

/**
 * Calculate ballistics coefficient from time constant
 * coeff = exp(-1 / (sample_rate * time_constant_seconds))
 */
static float calc_ballistics_coeff(float time_ms, float sample_rate) {
    if (time_ms < 0.1f) {
        return 0.0f;  /* Instant */
    }
    float time_sec = time_ms / 1000.0f;
    return expf(-1.0f / (sample_rate * time_sec));
}

/**
 * Load FIR coefficients from file
 * File format: one coefficient per line (float)
 */
static int load_fir_coefficients(const char* filename, formant_fir_filter_t* filter) {
    FILE* fp = fopen(filename, "r");
    if (!fp) {
        fprintf(stderr, "ERROR: Failed to open filter file: %s\n", filename);
        return -1;
    }

    /* Count lines */
    int num_coeffs = 0;
    char line[256];
    while (fgets(line, sizeof(line), fp)) {
        if (line[0] != '#' && line[0] != '\n') {
            num_coeffs++;
        }
    }
    rewind(fp);

    if (num_coeffs == 0) {
        fprintf(stderr, "ERROR: No coefficients found in %s\n", filename);
        fclose(fp);
        return -1;
    }

    /* Allocate arrays */
    filter->coeffs = (float*)calloc(num_coeffs, sizeof(float));
    filter->history = (float*)calloc(num_coeffs, sizeof(float));
    if (!filter->coeffs || !filter->history) {
        fprintf(stderr, "ERROR: Failed to allocate filter buffers\n");
        free(filter->coeffs);
        free(filter->history);
        fclose(fp);
        return -1;
    }

    /* Load coefficients */
    int i = 0;
    while (fgets(line, sizeof(line), fp) && i < num_coeffs) {
        if (line[0] != '#' && line[0] != '\n') {
            if (sscanf(line, "%f", &filter->coeffs[i]) == 1) {
                i++;
            }
        }
    }

    fclose(fp);

    filter->num_taps = num_coeffs;
    filter->history_pos = 0;

    fprintf(stderr, "Loaded %d FIR coefficients from %s\n", num_coeffs, filename);
    return num_coeffs;
}

/**
 * Process single sample through FIR filter
 */
static float fir_process_sample(formant_fir_filter_t* filter, float input) {
    if (!filter->coeffs || filter->num_taps == 0) {
        return input;  /* Pass-through if no filter loaded */
    }

    /* Add input to circular buffer */
    filter->history[filter->history_pos] = input;

    /* Convolution */
    float output = 0.0f;
    for (int i = 0; i < filter->num_taps; i++) {
        int idx = (filter->history_pos - i + filter->num_taps) % filter->num_taps;
        output += filter->coeffs[i] * filter->history[idx];
    }

    /* Advance position */
    filter->history_pos = (filter->history_pos + 1) % filter->num_taps;

    return output;
}

/* ============================================================================
 * Public API
 * ========================================================================= */

formant_meter_t* formant_meter_create(float sample_rate, const char* preset) {
    formant_meter_t* meter = (formant_meter_t*)calloc(1, sizeof(formant_meter_t));
    if (!meter) {
        return NULL;
    }

    meter->sample_rate = sample_rate;

    /* Find ballistics preset */
    const ballistics_preset_t* bp = &BALLISTICS_PRESETS[0];  /* Default to VU */
    for (size_t i = 0; i < sizeof(BALLISTICS_PRESETS) / sizeof(ballistics_preset_t); i++) {
        if (strcmp(BALLISTICS_PRESETS[i].name, preset) == 0) {
            bp = &BALLISTICS_PRESETS[i];
            break;
        }
    }

    /* Set ballistics */
    meter->ballistics.attack_coeff = calc_ballistics_coeff(bp->attack_ms, sample_rate);
    meter->ballistics.release_coeff = calc_ballistics_coeff(bp->release_ms, sample_rate);
    meter->ballistics.integration_time_ms = bp->integration_ms;
    meter->ballistics.peak_hold_time_ms = bp->peak_hold_ms;

    /* Allocate RMS integration buffer */
    meter->rms_buffer_size = (int)((bp->integration_ms / 1000.0f) * sample_rate);
    if (meter->rms_buffer_size > 0) {
        meter->rms_buffer = (float*)calloc(meter->rms_buffer_size, sizeof(float));
        if (!meter->rms_buffer) {
            free(meter);
            return NULL;
        }
    }

    /* Initialize state */
    meter->rms_current = 0.0f;
    meter->peak_current = 0.0f;
    meter->peak_hold = 0.0f;
    meter->true_peak = 0.0f;
    meter->min_level = 1.0f;
    meter->max_level = 0.0f;
    meter->clip_count = 0;
    meter->vad_enabled = false;
    meter->vad = NULL;

    /* Initialize filter (will be loaded separately) */
    memset(&meter->filter, 0, sizeof(formant_fir_filter_t));
    strncpy(meter->filter.name, preset, sizeof(meter->filter.name) - 1);

    fprintf(stderr, "Created %s meter (%.0f Hz, attack=%.0fms, release=%.0fms)\n",
            preset, sample_rate, bp->attack_ms, bp->release_ms);

    return meter;
}

void formant_meter_destroy(formant_meter_t* meter) {
    if (!meter) {
        return;
    }

    free(meter->filter.coeffs);
    free(meter->filter.history);
    free(meter->rms_buffer);
    free(meter);
}

int formant_meter_load_filter(formant_meter_t* meter, const char* filename) {
    if (!meter) {
        return -1;
    }

    return load_fir_coefficients(filename, &meter->filter);
}

void formant_meter_process(formant_meter_t* meter, const float* samples, int num_samples) {
    if (!meter || !samples) {
        return;
    }

    uint64_t now = formant_get_time_us();

    for (int i = 0; i < num_samples; i++) {
        /* Apply frequency weighting filter */
        float sample = fir_process_sample(&meter->filter, samples[i]);
        float abs_sample = fabsf(sample);

        /* Update min/max */
        if (abs_sample < meter->min_level) {
            meter->min_level = abs_sample;
        }
        if (abs_sample > meter->max_level) {
            meter->max_level = abs_sample;
        }

        /* Detect clipping */
        if (abs_sample >= 1.0f) {
            meter->clip_count++;
        }

        /* Peak detection with ballistics */
        if (abs_sample > meter->peak_current) {
            /* Attack */
            if (meter->ballistics.attack_coeff > 0.0f) {
                meter->peak_current = meter->ballistics.attack_coeff * meter->peak_current +
                                     (1.0f - meter->ballistics.attack_coeff) * abs_sample;
            } else {
                meter->peak_current = abs_sample;  /* Instant attack */
            }
        } else {
            /* Release */
            if (meter->ballistics.release_coeff > 0.0f) {
                meter->peak_current = meter->ballistics.release_coeff * meter->peak_current +
                                     (1.0f - meter->ballistics.release_coeff) * abs_sample;
            } else {
                meter->peak_current = abs_sample;  /* Instant release */
            }
        }

        /* Peak hold */
        if (abs_sample > meter->peak_hold) {
            meter->peak_hold = abs_sample;
            meter->peak_hold_start_us = now;
        } else {
            /* Decay peak hold after hold time */
            uint64_t hold_duration = now - meter->peak_hold_start_us;
            float hold_ms = hold_duration / 1000.0f;
            if (hold_ms > meter->ballistics.peak_hold_time_ms) {
                meter->peak_hold *= 0.99f;  /* Slow decay */
            }
        }

        /* True peak (simple 2x oversampling approximation) */
        if (abs_sample > meter->true_peak) {
            meter->true_peak = abs_sample;
        } else {
            meter->true_peak *= 0.9999f;  /* Very slow decay */
        }

        /* RMS calculation (moving average) */
        if (meter->rms_buffer && meter->rms_buffer_size > 0) {
            float sample_squared = sample * sample;

            /* Add to circular buffer */
            meter->rms_buffer[meter->rms_buffer_pos] = sample_squared;
            meter->rms_buffer_pos = (meter->rms_buffer_pos + 1) % meter->rms_buffer_size;

            /* Calculate RMS from buffer */
            float sum = 0.0f;
            for (int j = 0; j < meter->rms_buffer_size; j++) {
                sum += meter->rms_buffer[j];
            }
            meter->rms_current = sqrtf(sum / meter->rms_buffer_size);
        } else {
            /* No integration - instant RMS */
            meter->rms_current = abs_sample;
        }
    }
}

float formant_meter_get_rms_db(formant_meter_t* meter) {
    if (!meter) {
        return METER_MIN_DB;
    }
    return amp_to_db(meter->rms_current);
}

float formant_meter_get_peak_db(formant_meter_t* meter) {
    if (!meter) {
        return METER_MIN_DB;
    }
    return amp_to_db(meter->peak_current);
}

float formant_meter_get_peak_hold_db(formant_meter_t* meter) {
    if (!meter) {
        return METER_MIN_DB;
    }
    return amp_to_db(meter->peak_hold);
}

void formant_meter_reset(formant_meter_t* meter) {
    if (!meter) {
        return;
    }

    meter->rms_current = 0.0f;
    meter->peak_current = 0.0f;
    meter->peak_hold = 0.0f;
    meter->true_peak = 0.0f;
    meter->min_level = 1.0f;
    meter->max_level = 0.0f;
    meter->clip_count = 0;

    if (meter->rms_buffer) {
        memset(meter->rms_buffer, 0, meter->rms_buffer_size * sizeof(float));
    }
    meter->rms_buffer_pos = 0;
}

void formant_meter_format_display(formant_meter_t* meter, char* buffer, int buffer_size, int width) {
    if (!meter || !buffer || buffer_size < width + 40) {
        return;
    }

    float rms_db = formant_meter_get_rms_db(meter);
    float peak_db = formant_meter_get_peak_db(meter);
    float peak_hold_db = formant_meter_get_peak_hold_db(meter);

    /* Clamp to display range */
    if (rms_db < METER_MIN_DB) rms_db = METER_MIN_DB;
    if (peak_db < METER_MIN_DB) peak_db = METER_MIN_DB;
    if (peak_hold_db < METER_MIN_DB) peak_hold_db = METER_MIN_DB;

    /* Calculate bar positions (0 to width) */
    int rms_pos = (int)((rms_db - METER_MIN_DB) / (METER_MAX_DB - METER_MIN_DB) * width);
    int peak_pos = (int)((peak_db - METER_MIN_DB) / (METER_MAX_DB - METER_MIN_DB) * width);
    int hold_pos = (int)((peak_hold_db - METER_MIN_DB) / (METER_MAX_DB - METER_MIN_DB) * width);

    /* Clamp positions */
    if (rms_pos < 0) rms_pos = 0;
    if (rms_pos > width) rms_pos = width;
    if (peak_pos < 0) peak_pos = 0;
    if (peak_pos > width) peak_pos = width;
    if (hold_pos < 0) hold_pos = 0;
    if (hold_pos > width) hold_pos = width;

    /* Build bargraph */
    char bar[256];
    memset(bar, ' ', width);
    bar[width] = '\0';

    /* Fill RMS (=) */
    for (int i = 0; i < rms_pos; i++) {
        bar[i] = '=';
    }

    /* Peak indicator (|) */
    if (peak_pos < width) {
        bar[peak_pos] = '|';
    }

    /* Peak hold (^) */
    if (hold_pos < width && hold_pos != peak_pos) {
        bar[hold_pos] = '^';
    }

    /* Format output with color coding */
    const char* color = "";
    if (peak_db > -6.0f) {
        color = "HOT ";  /* Near clipping */
    } else if (peak_db > -12.0f) {
        color = "    ";  /* Normal */
    } else {
        color = "LOW ";  /* Low level */
    }

    snprintf(buffer, buffer_size, "[%s] %sRMS:%5.1fdB Peak:%5.1fdB%s",
             bar, color, rms_db, peak_db,
             (meter->clip_count > 0) ? " CLIP!" : "");
}

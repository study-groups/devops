/**
 * formant_diagnostics.c
 *
 * Diagnostic tools for measuring and analyzing audio output
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "formant.h"

/* RMS measurement */
typedef struct {
    float sum_squares;
    int sample_count;
    float peak;
    float min;
    float max;
} rms_meter_t;

static rms_meter_t global_rms = {0};

void formant_diagnostics_reset_rms(void) {
    global_rms.sum_squares = 0.0f;
    global_rms.sample_count = 0;
    global_rms.peak = 0.0f;
    global_rms.min = 0.0f;
    global_rms.max = 0.0f;
}

void formant_diagnostics_update_rms(float sample) {
    global_rms.sum_squares += sample * sample;
    global_rms.sample_count++;

    float abs_sample = fabsf(sample);
    if (abs_sample > global_rms.peak) {
        global_rms.peak = abs_sample;
    }
    if (sample > global_rms.max) {
        global_rms.max = sample;
    }
    if (sample < global_rms.min) {
        global_rms.min = sample;
    }
}

float formant_diagnostics_get_rms(void) {
    if (global_rms.sample_count == 0) return 0.0f;
    return sqrtf(global_rms.sum_squares / global_rms.sample_count);
}

void formant_diagnostics_print_stats(void) {
    float rms = formant_diagnostics_get_rms();
    float rms_db = 20.0f * log10f(rms + 1e-10f);
    float peak_db = 20.0f * log10f(global_rms.peak + 1e-10f);

    fprintf(stderr, "\n=== Audio Statistics ===\n");
    fprintf(stderr, "Samples:     %d\n", global_rms.sample_count);
    fprintf(stderr, "RMS:         %.6f (%.2f dB)\n", rms, rms_db);
    fprintf(stderr, "Peak:        %.6f (%.2f dB)\n", global_rms.peak, peak_db);
    fprintf(stderr, "Min:         %.6f\n", global_rms.min);
    fprintf(stderr, "Max:         %.6f\n", global_rms.max);
    fprintf(stderr, "========================\n\n");
}

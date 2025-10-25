/**
 * formant_engine.c
 *
 * Core engine implementation for formant synthesis.
 * Manages state, audio processing, and coordination of all subsystems.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <time.h>
#include <sys/time.h>
#include "formant.h"

/* ============================================================================
 * Utility Functions
 * ========================================================================= */

uint64_t formant_get_time_us(void) {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return (uint64_t)tv.tv_sec * 1000000ULL + (uint64_t)tv.tv_usec;
}

/* ============================================================================
 * PortAudio Callback
 * ========================================================================= */

static int audio_callback(
    const void* input_buffer,
    void* output_buffer,
    unsigned long frames_per_buffer,
    const PaStreamCallbackTimeInfo* time_info,
    PaStreamCallbackFlags status_flags,
    void* user_data)
{
    formant_engine_t* engine = (formant_engine_t*)user_data;
    float* output = (float*)output_buffer;

    (void)input_buffer;  /* Unused */
    (void)time_info;
    (void)status_flags;

    /* Process audio */
    formant_engine_process(engine, output, frames_per_buffer);

    return paContinue;
}

/* ============================================================================
 * Engine Management
 * ========================================================================= */

formant_engine_t* formant_engine_create(float sample_rate) {
    formant_engine_t* engine = (formant_engine_t*)calloc(1, sizeof(formant_engine_t));
    if (!engine) {
        return NULL;
    }

    /* Initialize audio */
    engine->sample_rate = sample_rate;
    engine->audio.sample_rate = sample_rate;
    engine->audio.buffer_size = FORMANT_BUFFER_SIZE_DEFAULT;
    engine->audio.running = false;

    /* Initialize synthesis parameters */
    engine->pitch_base = 120.0f;       /* Default: 120 Hz */
    engine->f0_hz = 120.0f;
    engine->intensity = 0.7f;
    engine->volume = 0.7f;
    engine->rate_multiplier = 1.0f;
    engine->lerp_rate = 0.3f;

    /* Initialize formant targets */
    engine->f1_current = engine->f1_target = 500.0f;
    engine->f2_current = engine->f2_target = 1500.0f;
    engine->f3_current = engine->f3_target = 2500.0f;
    engine->f4_current = engine->f4_target = 3500.0f;
    engine->f5_current = engine->f5_target = 4500.0f;

    /* Initialize synthesis mode */
    engine->synth_mode = FORMANT_SYNTH_MODE_FORMANT;  /* Default to formant */
    engine->hybrid_mix = 0.5f;  /* 50/50 blend for hybrid mode */

    /* Initialize formant bank */
    engine->formant_bank.num_formants = 3;  /* Start with F1-F3 */
    for (int i = 0; i < engine->formant_bank.num_formants; i++) {
        float freqs[] = {500.0f, 1500.0f, 2500.0f};
        float bws[] = {50.0f, 100.0f, 150.0f};
        formant_filter_init(&engine->formant_bank.filters[i],
                           freqs[i], bws[i], sample_rate);
    }

    /* Initialize CELP engine */
    formant_celp_init(&engine->celp_engine);

    /* Initialize emotion state */
    engine->emotion.current = FORMANT_EMOTION_NEUTRAL;
    engine->emotion.intensity = 0.0f;

    /* Initialize command queue */
    engine->cmd_queue_head = 0;
    engine->cmd_queue_tail = 0;
    engine->cmd_queue_size = 0;

    /* Initialize timing */
    engine->time_us = formant_get_time_us();
    engine->samples_processed = 0;

    /* Initialize diagnostics */
    engine->enable_diagnostics = false;
    engine->diagnostic_sample_count = 0;

    /* Initialize PortAudio */
    PaError err = Pa_Initialize();
    if (err != paNoError) {
        fprintf(stderr, "PortAudio error: %s\n", Pa_GetErrorText(err));
        free(engine);
        return NULL;
    }

    /* Initialize recorder */
    engine->recorder = formant_recorder_create(sample_rate);
    if (!engine->recorder) {
        fprintf(stderr, "Warning: Failed to create recorder\n");
    }

    return engine;
}

void formant_engine_destroy(formant_engine_t* engine) {
    if (!engine) return;

    /* Stop audio if running */
    if (engine->audio.running) {
        formant_engine_stop(engine);
    }

    /* Destroy recorder */
    if (engine->recorder) {
        formant_recorder_destroy(engine->recorder);
    }

    /* Terminate PortAudio */
    Pa_Terminate();

    free(engine);
}

void formant_engine_reset(formant_engine_t* engine) {
    if (!engine) return;

    /* Reset to neutral state */
    engine->pitch_base = 120.0f;
    engine->f0_hz = 120.0f;
    engine->intensity = 0.7f;
    engine->volume = 0.7f;
    engine->rate_multiplier = 1.0f;

    /* Reset formants to neutral schwa-like position */
    engine->f1_target = 500.0f;
    engine->f2_target = 1500.0f;
    engine->f3_target = 2500.0f;

    /* Reset emotion */
    engine->emotion.current = FORMANT_EMOTION_NEUTRAL;
    engine->emotion.intensity = 0.0f;
    engine->emotion.vocal_fry.intensity = 0.0f;
    engine->emotion.breathiness.intensity = 0.0f;
    engine->emotion.tension = 0.5f;

    /* Clear command queue */
    engine->cmd_queue_size = 0;
    engine->cmd_queue_head = 0;
    engine->cmd_queue_tail = 0;

    /* Reset phoneme */
    engine->current_phoneme = NULL;
}

int formant_engine_start(formant_engine_t* engine) {
    if (!engine) return -1;

    /* Open audio stream */
    PaError err = Pa_OpenDefaultStream(
        &engine->audio.stream,
        0,                              /* No input */
        1,                              /* Mono output */
        paFloat32,                      /* 32-bit float */
        engine->sample_rate,
        engine->audio.buffer_size,
        audio_callback,
        engine
    );

    if (err != paNoError) {
        fprintf(stderr, "PortAudio error: %s\n", Pa_GetErrorText(err));
        return -1;
    }

    /* Start stream */
    err = Pa_StartStream(engine->audio.stream);
    if (err != paNoError) {
        fprintf(stderr, "PortAudio error: %s\n", Pa_GetErrorText(err));
        Pa_CloseStream(engine->audio.stream);
        return -1;
    }

    engine->audio.running = true;
    return 0;
}

void formant_engine_stop(formant_engine_t* engine) {
    if (!engine || !engine->audio.running) return;

    /* Stop and close stream */
    Pa_StopStream(engine->audio.stream);
    Pa_CloseStream(engine->audio.stream);
    engine->audio.running = false;
}

/* ============================================================================
 * Audio Processing
 * ========================================================================= */

void formant_engine_process(formant_engine_t* engine, float* output, int num_samples) {
    if (!engine || !output) return;

    /* Check if recorder needs finalization */
    if (engine->recorder && engine->recorder->state == FORMANT_RECORDER_STOPPING) {
        formant_recorder_stop(engine->recorder);
    }

    /* Process pending commands */
    formant_process_commands(engine);

    /* Generate audio */
    for (int i = 0; i < num_samples; i++) {
        /* Interpolate formant frequencies towards targets */
        engine->f1_current = formant_lerp(engine->f1_current, engine->f1_target, engine->lerp_rate);
        engine->f2_current = formant_lerp(engine->f2_current, engine->f2_target, engine->lerp_rate);
        engine->f3_current = formant_lerp(engine->f3_current, engine->f3_target, engine->lerp_rate);

        /* Update filter frequencies */
        formant_filter_set_freq(&engine->formant_bank.filters[0],
                               engine->f1_current, engine->sample_rate);
        formant_filter_set_freq(&engine->formant_bank.filters[1],
                               engine->f2_current, engine->sample_rate);
        formant_filter_set_freq(&engine->formant_bank.filters[2],
                               engine->f3_current, engine->sample_rate);

        /* Generate source signal based on current phoneme type */
        float source = 0.0f;
        float aspiration = 0.0f;
        float frication = 0.0f;
        float plosive_burst = 0.0f;

        if (engine->current_phoneme) {
            /* Get phoneme characteristics */
            float asp_level = engine->current_phoneme->aspiration;
            float fric_level = engine->current_phoneme->frication;
            bool voiced = engine->current_phoneme->voiced;
            formant_phoneme_type_t type = engine->current_phoneme->type;

            /* Handle plosive burst (p, b, t, d, k, g) */
            if (type == FORMANT_PHONEME_PLOSIVE) {
                if (!engine->in_plosive_burst) {
                    /* Start burst */
                    engine->in_plosive_burst = true;
                    engine->plosive_burst_time = 0.0f;
                    engine->plosive_burst_duration = engine->sample_rate * 0.02f;  /* 20ms burst */
                }

                if (engine->plosive_burst_time < engine->plosive_burst_duration) {
                    /* Generate burst */
                    float burst_progress = engine->plosive_burst_time / engine->plosive_burst_duration;
                    float burst_freq = engine->current_phoneme->f2;  /* Use F2 for burst color */
                    float burst_intensity = voiced ? 0.3f : 0.6f;  /* Weaker for voiced */
                    plosive_burst = formant_generate_plosive_burst(burst_progress, burst_intensity, burst_freq);
                    engine->plosive_burst_time += 1.0f;
                } else {
                    /* Burst finished, start voiced portion for voiced plosives */
                    engine->in_plosive_burst = false;
                }
            } else {
                engine->in_plosive_burst = false;
            }

            /* Generate voiced source (glottal pulse) - suppress during plosive closure */
            if (voiced && !engine->in_plosive_burst) {
                source = formant_generate_glottal(engine->phase, 0.6f, 0.8f);
                source *= (1.0f - asp_level * 0.5f);  /* Reduce harmonics if breathy */
            }

            /* Generate aspiration noise (for breathiness, /h/, voiceless stops) */
            if (asp_level > 0.01f) {
                aspiration = formant_generate_aspiration(asp_level);
            }

            /* Generate frication noise (for fricatives: s, f, sh, etc.) */
            if (fric_level > 0.01f) {
                float fric_freq = engine->current_phoneme->f3;  /* Use F3 for frication color */
                frication = formant_generate_frication(fric_level, fric_freq);
            }

            /* Advance glottal phase */
            if (voiced) {
                float phase_increment = engine->f0_hz / engine->sample_rate;
                engine->phase += phase_increment;
                if (engine->phase >= 1.0f) {
                    engine->phase -= 1.0f;
                }
            }
        } else {
            /* No phoneme - just gentle glottal pulse */
            source = formant_generate_glottal(engine->phase, 0.6f, 0.8f);
            float phase_increment = engine->f0_hz / engine->sample_rate;
            engine->phase += phase_increment;
            if (engine->phase >= 1.0f) {
                engine->phase -= 1.0f;
            }
        }

        /* Generate output based on synthesis mode */
        float sample = 0.0f;

        if (engine->synth_mode == FORMANT_SYNTH_MODE_FORMANT) {
            /* Pure formant synthesis */
            float formant_output = 0.0f;
            for (int f = 0; f < engine->formant_bank.num_formants; f++) {
                formant_output += formant_filter_process(&engine->formant_bank.filters[f], source);
            }
            /* Mix sources: formant-filtered voice + aspiration + frication + plosive burst */
            sample = formant_output + aspiration * 0.3f + frication * 0.4f + plosive_burst * 0.5f;

        } else if (engine->synth_mode == FORMANT_SYNTH_MODE_CELP) {
            /* Pure CELP synthesis */
            sample = formant_celp_process_sample(&engine->celp_engine);

        } else {  /* FORMANT_SYNTH_MODE_HYBRID */
            /* Hybrid: blend formant and CELP */
            float formant_output = 0.0f;
            for (int f = 0; f < engine->formant_bank.num_formants; f++) {
                formant_output += formant_filter_process(&engine->formant_bank.filters[f], source);
            }
            formant_output += aspiration * 0.3f + frication * 0.4f + plosive_burst * 0.5f;

            float celp_output = formant_celp_process_sample(&engine->celp_engine);

            /* Blend based on hybrid_mix (0.0 = pure CELP, 1.0 = pure formant) */
            sample = (1.0f - engine->hybrid_mix) * celp_output + engine->hybrid_mix * formant_output;
        }

        /* Apply volume */
        sample *= engine->volume * engine->intensity;

        /* Clamp to prevent clipping */
        output[i] = formant_clamp(sample, -1.0f, 1.0f);

        /* Update diagnostics */
        if (engine->enable_diagnostics) {
            formant_diagnostics_update_rms(sample);
            engine->diagnostic_sample_count++;

            /* Print stats every 48000 samples (1 second @ 48kHz) */
            if (engine->diagnostic_sample_count >= 48000) {
                formant_diagnostics_print_stats();
                formant_diagnostics_reset_rms();
                engine->diagnostic_sample_count = 0;
            }
        }

        /* Update timing */
        engine->samples_processed++;
    }

    /* Update time */
    engine->time_us = engine->samples_processed * 1000000ULL / (uint64_t)engine->sample_rate;
}

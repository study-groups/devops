/**
 * formant_recorder.c
 *
 * Audio input recording module using PortAudio.
 * Records audio to WAV files for voice cloning training.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include "formant.h"

/* ============================================================================
 * WAV File Header
 * ========================================================================= */

typedef struct {
    /* RIFF Header */
    char riff_header[4];      /* "RIFF" */
    uint32_t wav_size;        /* File size - 8 */
    char wave_header[4];      /* "WAVE" */

    /* Format Chunk */
    char fmt_header[4];       /* "fmt " */
    uint32_t fmt_chunk_size;  /* 16 for PCM */
    uint16_t audio_format;    /* 1 = PCM */
    uint16_t num_channels;    /* 1 = Mono */
    uint32_t sample_rate;     /* 16000 Hz */
    uint32_t byte_rate;       /* sample_rate * num_channels * bytes_per_sample */
    uint16_t block_align;     /* num_channels * bytes_per_sample */
    uint16_t bits_per_sample; /* 16 bits */

    /* Data Chunk */
    char data_header[4];      /* "data" */
    uint32_t data_bytes;      /* num_samples * num_channels * bytes_per_sample */
} wav_header_t;

/**
 * Write WAV file header
 */
static int write_wav_header(FILE* file, int sample_rate, int num_samples) {
    wav_header_t header;

    /* RIFF header */
    memcpy(header.riff_header, "RIFF", 4);
    header.wav_size = 36 + num_samples * 2;  /* 2 bytes per sample (16-bit) */
    memcpy(header.wave_header, "WAVE", 4);

    /* Format chunk */
    memcpy(header.fmt_header, "fmt ", 4);
    header.fmt_chunk_size = 16;
    header.audio_format = 1;  /* PCM */
    header.num_channels = 1;  /* Mono */
    header.sample_rate = sample_rate;
    header.byte_rate = sample_rate * 1 * 2;  /* sample_rate * channels * bytes_per_sample */
    header.block_align = 1 * 2;  /* channels * bytes_per_sample */
    header.bits_per_sample = 16;

    /* Data chunk */
    memcpy(header.data_header, "data", 4);
    header.data_bytes = num_samples * 2;  /* 2 bytes per sample */

    /* Write header */
    size_t written = fwrite(&header, sizeof(wav_header_t), 1, file);
    if (written != 1) {
        return -1;
    }

    return 0;
}

/**
 * Update WAV file header with actual sample count
 */
static int update_wav_header(FILE* file, int num_samples) {
    /* Seek to wav_size field (offset 4) */
    fseek(file, 4, SEEK_SET);
    uint32_t wav_size = 36 + num_samples * 2;
    fwrite(&wav_size, sizeof(uint32_t), 1, file);

    /* Seek to data_bytes field (offset 40) */
    fseek(file, 40, SEEK_SET);
    uint32_t data_bytes = num_samples * 2;
    fwrite(&data_bytes, sizeof(uint32_t), 1, file);

    return 0;
}

/* ============================================================================
 * PortAudio Callback
 * ========================================================================= */

/**
 * Helper function to write samples to WAV file
 */
static void write_samples_to_file(formant_recorder_t* recorder, const float* samples, int count) {
    for (int i = 0; i < count; i++) {
        float sample = samples[i];

        /* Clamp to [-1.0, 1.0] */
        if (sample > 1.0f) sample = 1.0f;
        if (sample < -1.0f) sample = -1.0f;

        /* Convert to 16-bit PCM */
        int16_t sample_16 = (int16_t)(sample * 32767.0f);

        /* Write to file */
        fwrite(&sample_16, sizeof(int16_t), 1, recorder->wav_file);
    }
    recorder->samples_recorded += count;
}

static int recorder_callback(const void* input_buffer,
                             void* output_buffer,
                             unsigned long frames_per_buffer,
                             const PaStreamCallbackTimeInfo* time_info,
                             PaStreamCallbackFlags status_flags,
                             void* user_data)
{
    (void)output_buffer;  /* Unused */
    (void)time_info;
    (void)status_flags;

    formant_recorder_t* recorder = (formant_recorder_t*)user_data;
    const float* input = (const float*)input_buffer;

    /* Check timeout */
    if (recorder->max_duration_us > 0) {
        uint64_t elapsed = formant_get_time_us() - recorder->start_time_us;
        if (elapsed >= recorder->max_duration_us) {
            recorder->state = FORMANT_RECORDER_STOPPING;
            return paComplete;
        }
    }

    /* VAD mode */
    if (recorder->use_vad && recorder->vad) {
        formant_vad_result_t vad_result = formant_vad_process_frame(
            recorder->vad, input, frames_per_buffer);

        switch (recorder->state) {
            case FORMANT_RECORDER_WAITING_FOR_SPEECH:
                if (vad_result == FORMANT_VAD_RESULT_SPEECH) {
                    /* Speech detected! Transition to recording */
                    recorder->state = FORMANT_RECORDER_RECORDING;

                    /* Write pre-trigger buffer first */
                    float pretrigger[8000];  /* Max 500ms @ 16kHz */
                    int pretrigger_samples = formant_vad_get_pretrigger(
                        recorder->vad, pretrigger, 8000);

                    if (pretrigger_samples > 0) {
                        write_samples_to_file(recorder, pretrigger, pretrigger_samples);
                    }

                    /* Write current frame */
                    write_samples_to_file(recorder, input, frames_per_buffer);
                }
                /* Otherwise, keep waiting */
                break;

            case FORMANT_RECORDER_RECORDING:
                if (vad_result == FORMANT_VAD_RESULT_SPEECH) {
                    /* Continue recording */
                    write_samples_to_file(recorder, input, frames_per_buffer);
                } else {
                    /* Silence detected - stop recording */
                    recorder->state = FORMANT_RECORDER_STOPPING;
                    return paComplete;
                }
                break;

            default:
                return paComplete;
        }

        return paContinue;
    }

    /* Fixed duration mode (original behavior) */
    if (recorder->state != FORMANT_RECORDER_RECORDING) {
        return paComplete;
    }

    /* Calculate how many samples to record */
    int samples_to_record = frames_per_buffer;
    int samples_remaining = recorder->samples_target - recorder->samples_recorded;

    if (samples_to_record > samples_remaining) {
        samples_to_record = samples_remaining;
    }

    /* Write samples */
    write_samples_to_file(recorder, input, samples_to_record);

    /* Check if we're done */
    if (recorder->samples_recorded >= recorder->samples_target) {
        recorder->state = FORMANT_RECORDER_STOPPING;
        return paComplete;
    }

    return paContinue;
}

/* ============================================================================
 * Public API
 * ========================================================================= */

formant_recorder_t* formant_recorder_create(float sample_rate) {
    formant_recorder_t* recorder = calloc(1, sizeof(formant_recorder_t));
    if (!recorder) {
        return NULL;
    }

    recorder->sample_rate = sample_rate;
    recorder->state = FORMANT_RECORDER_IDLE;
    recorder->stream = NULL;
    recorder->wav_file = NULL;
    recorder->buffer_size = 512;  /* Same as output buffer */
    recorder->vad = NULL;
    recorder->use_vad = false;
    recorder->max_duration_us = 0;

    return recorder;
}

void formant_recorder_destroy(formant_recorder_t* recorder) {
    if (!recorder) {
        return;
    }

    /* Stop recording if active */
    if (recorder->state == FORMANT_RECORDER_RECORDING ||
        recorder->state == FORMANT_RECORDER_WAITING_FOR_SPEECH) {
        formant_recorder_stop(recorder);
    }

    /* Destroy VAD if exists */
    if (recorder->vad) {
        formant_vad_destroy(recorder->vad);
    }

    /* Close stream if open */
    if (recorder->stream) {
        Pa_CloseStream(recorder->stream);
    }

    free(recorder);
}

int formant_recorder_start(formant_recorder_t* recorder, const char* filename, float duration_ms) {
    if (!recorder || recorder->state != FORMANT_RECORDER_IDLE) {
        return -1;
    }

    /* Calculate target samples */
    recorder->samples_target = (int)(duration_ms * recorder->sample_rate / 1000.0f);
    recorder->samples_recorded = 0;
    strncpy(recorder->filename, filename, sizeof(recorder->filename) - 1);

    /* Open WAV file for writing */
    recorder->wav_file = fopen(filename, "wb");
    if (!recorder->wav_file) {
        fprintf(stderr, "ERROR: Failed to open file for recording: %s\n", filename);
        return -1;
    }

    /* Write placeholder WAV header (will update later with actual sample count) */
    if (write_wav_header(recorder->wav_file, (int)recorder->sample_rate, recorder->samples_target) != 0) {
        fprintf(stderr, "ERROR: Failed to write WAV header\n");
        fclose(recorder->wav_file);
        recorder->wav_file = NULL;
        return -1;
    }

    /* Setup PortAudio input stream */
    PaStreamParameters input_params;
    input_params.device = Pa_GetDefaultInputDevice();
    if (input_params.device == paNoDevice) {
        fprintf(stderr, "ERROR: No default input device found\n");
        fclose(recorder->wav_file);
        recorder->wav_file = NULL;
        return -1;
    }

    input_params.channelCount = 1;  /* Mono */
    input_params.sampleFormat = paFloat32;
    input_params.suggestedLatency = Pa_GetDeviceInfo(input_params.device)->defaultLowInputLatency;
    input_params.hostApiSpecificStreamInfo = NULL;

    /* Open stream */
    PaError err = Pa_OpenStream(
        &recorder->stream,
        &input_params,
        NULL,  /* No output */
        recorder->sample_rate,
        recorder->buffer_size,
        paClipOff,
        recorder_callback,
        recorder
    );

    if (err != paNoError) {
        fprintf(stderr, "ERROR: Failed to open input stream: %s\n", Pa_GetErrorText(err));
        fclose(recorder->wav_file);
        recorder->wav_file = NULL;
        return -1;
    }

    /* Start stream */
    err = Pa_StartStream(recorder->stream);
    if (err != paNoError) {
        fprintf(stderr, "ERROR: Failed to start input stream: %s\n", Pa_GetErrorText(err));
        Pa_CloseStream(recorder->stream);
        recorder->stream = NULL;
        fclose(recorder->wav_file);
        recorder->wav_file = NULL;
        return -1;
    }

    recorder->use_vad = false;
    recorder->state = FORMANT_RECORDER_RECORDING;
    recorder->start_time_us = formant_get_time_us();
    fprintf(stderr, "🔴 Recording to: %s (%.1fs, %.0fHz)\n",
            filename, duration_ms / 1000.0f, recorder->sample_rate);

    return 0;
}

int formant_recorder_start_vad(formant_recorder_t* recorder, const char* filename,
                                float max_duration_ms, int vad_mode) {
    if (!recorder || recorder->state != FORMANT_RECORDER_IDLE) {
        return -1;
    }

    if (vad_mode < 0 || vad_mode > 2) {
        fprintf(stderr, "ERROR: Invalid VAD mode %d (must be 0-2)\n", vad_mode);
        return -1;
    }

    /* Create VAD */
    recorder->vad = formant_vad_create(recorder->sample_rate, vad_mode);
    if (!recorder->vad) {
        fprintf(stderr, "ERROR: Failed to create VAD\n");
        return -1;
    }

    /* Calibrate VAD with 1 second of silence */
    fprintf(stderr, "Calibrating VAD... please remain silent for 1 second\n");

    /* We'll calibrate in the first second of the stream */
    /* For now, use default calibration */
    recorder->vad->calibrated = true;  /* Will adapt during recording */

    /* Setup recording */
    recorder->samples_target = (int)(max_duration_ms * recorder->sample_rate / 1000.0f);
    recorder->samples_recorded = 0;
    recorder->max_duration_us = (uint64_t)(max_duration_ms * 1000.0f);
    strncpy(recorder->filename, filename, sizeof(recorder->filename) - 1);

    /* Open WAV file for writing */
    recorder->wav_file = fopen(filename, "wb");
    if (!recorder->wav_file) {
        fprintf(stderr, "ERROR: Failed to open file for recording: %s\n", filename);
        formant_vad_destroy(recorder->vad);
        recorder->vad = NULL;
        return -1;
    }

    /* Write placeholder WAV header (will update later with actual sample count) */
    if (write_wav_header(recorder->wav_file, (int)recorder->sample_rate, recorder->samples_target) != 0) {
        fprintf(stderr, "ERROR: Failed to write WAV header\n");
        fclose(recorder->wav_file);
        recorder->wav_file = NULL;
        formant_vad_destroy(recorder->vad);
        recorder->vad = NULL;
        return -1;
    }

    /* Setup PortAudio input stream */
    PaStreamParameters input_params;
    input_params.device = Pa_GetDefaultInputDevice();
    if (input_params.device == paNoDevice) {
        fprintf(stderr, "ERROR: No default input device found\n");
        fclose(recorder->wav_file);
        recorder->wav_file = NULL;
        formant_vad_destroy(recorder->vad);
        recorder->vad = NULL;
        return -1;
    }

    input_params.channelCount = 1;  /* Mono */
    input_params.sampleFormat = paFloat32;
    input_params.suggestedLatency = Pa_GetDeviceInfo(input_params.device)->defaultLowInputLatency;
    input_params.hostApiSpecificStreamInfo = NULL;

    /* Open stream */
    PaError err = Pa_OpenStream(
        &recorder->stream,
        &input_params,
        NULL,  /* No output */
        recorder->sample_rate,
        recorder->buffer_size,
        paClipOff,
        recorder_callback,
        recorder
    );

    if (err != paNoError) {
        fprintf(stderr, "ERROR: Failed to open input stream: %s\n", Pa_GetErrorText(err));
        fclose(recorder->wav_file);
        recorder->wav_file = NULL;
        formant_vad_destroy(recorder->vad);
        recorder->vad = NULL;
        return -1;
    }

    /* Start stream */
    err = Pa_StartStream(recorder->stream);
    if (err != paNoError) {
        fprintf(stderr, "ERROR: Failed to start input stream: %s\n", Pa_GetErrorText(err));
        Pa_CloseStream(recorder->stream);
        recorder->stream = NULL;
        fclose(recorder->wav_file);
        recorder->wav_file = NULL;
        formant_vad_destroy(recorder->vad);
        recorder->vad = NULL;
        return -1;
    }

    recorder->use_vad = true;
    recorder->state = FORMANT_RECORDER_WAITING_FOR_SPEECH;
    recorder->start_time_us = formant_get_time_us();

    fprintf(stderr, "🎤 Waiting for speech... (max %.1fs, mode %d, %.0fHz)\n",
            max_duration_ms / 1000.0f, vad_mode, recorder->sample_rate);

    return 0;
}

int formant_recorder_stop(formant_recorder_t* recorder) {
    if (!recorder || recorder->state == FORMANT_RECORDER_IDLE) {
        return -1;
    }

    /* Stop stream */
    if (recorder->stream) {
        Pa_StopStream(recorder->stream);
        Pa_CloseStream(recorder->stream);
        recorder->stream = NULL;
    }

    /* Update WAV header with actual sample count */
    if (recorder->wav_file) {
        update_wav_header(recorder->wav_file, recorder->samples_recorded);
        fclose(recorder->wav_file);
        recorder->wav_file = NULL;
    }

    recorder->state = FORMANT_RECORDER_IDLE;

    fprintf(stderr, "✓ Recording complete: %s (%d samples, %.2fs)\n",
            recorder->filename,
            recorder->samples_recorded,
            recorder->samples_recorded / recorder->sample_rate);

    return 0;
}

bool formant_recorder_is_recording(formant_recorder_t* recorder) {
    if (!recorder) {
        return false;
    }
    return recorder->state == FORMANT_RECORDER_RECORDING;
}

float formant_recorder_get_progress(formant_recorder_t* recorder) {
    if (!recorder || recorder->samples_target == 0) {
        return 0.0f;
    }
    return (float)recorder->samples_recorded / (float)recorder->samples_target;
}

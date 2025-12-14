/*
 * sequence.c - Sequence recording and playback
 */

#include "sequence.h"
#include "phonemes.h"
#include <string.h>
#include <stdio.h>
#include <math.h>

/* Initialize sequence */
void sequence_init(Sequence *seq) {
    memset(seq, 0, sizeof(Sequence));
    seq->loop_enabled = 0;
    seq->recording = 0;
}

/* Start recording */
void sequence_start_recording(Sequence *seq) {
    sequence_clear(seq);
    seq->recording = 1;
    seq->record_start_time = 0.0f;
    seq->frame_count = 0;
}

/* Stop recording */
void sequence_stop_recording(Sequence *seq) {
    seq->recording = 0;
    if (seq->frame_count > 0) {
        seq->duration = seq->frames[seq->frame_count - 1].timestamp;
    }
}

/* Record a frame */
void sequence_record_frame(Sequence *seq, const FacialState *state, float timestamp) {
    if (!seq->recording) return;
    if (seq->frame_count >= MAX_SEQUENCE_FRAMES) {
        /* Buffer full - stop recording */
        sequence_stop_recording(seq);
        return;
    }

    SequenceFrame *frame = &seq->frames[seq->frame_count];
    frame->timestamp = timestamp;
    frame->state = *state;
    seq->frame_count++;
}

/* Start playback */
void sequence_start_playback(Sequence *seq) {
    if (seq->frame_count == 0) return;
    seq->playback_frame = 0;
    seq->playback_time = 0.0f;
}

/* Stop playback */
void sequence_stop_playback(Sequence *seq) {
    seq->playback_frame = 0;
    seq->playback_time = 0.0f;
}

/* Update playback - returns 1 if still playing, 0 if finished */
int sequence_update_playback(Sequence *seq, float delta_time, FacialState *out_state) {
    if (seq->frame_count == 0) return 0;

    seq->playback_time += delta_time;

    /* Check if we've reached the end */
    if (seq->playback_time >= seq->duration) {
        if (seq->loop_enabled) {
            seq->playback_time = fmodf(seq->playback_time, seq->duration);
            seq->playback_frame = 0;
        } else {
            /* Playback finished */
            seq->playback_time = seq->duration;
            *out_state = seq->frames[seq->frame_count - 1].state;
            return 0;
        }
    }

    /* Find frame for current time */
    while (seq->playback_frame < seq->frame_count - 1 &&
           seq->frames[seq->playback_frame + 1].timestamp <= seq->playback_time) {
        seq->playback_frame++;
    }

    /* Interpolate between frames if possible */
    if (seq->playback_frame < seq->frame_count - 1) {
        SequenceFrame *curr = &seq->frames[seq->playback_frame];
        SequenceFrame *next = &seq->frames[seq->playback_frame + 1];

        float dt = next->timestamp - curr->timestamp;
        float t = (seq->playback_time - curr->timestamp) / dt;

        /* Clamp t to [0, 1] */
        if (t < 0.0f) t = 0.0f;
        if (t > 1.0f) t = 1.0f;

        /* Linear interpolation of all parameters */
        out_state->jaw_openness = curr->state.jaw_openness + t * (next->state.jaw_openness - curr->state.jaw_openness);
        out_state->jaw_forward = curr->state.jaw_forward + t * (next->state.jaw_forward - curr->state.jaw_forward);
        out_state->lip_rounding = curr->state.lip_rounding + t * (next->state.lip_rounding - curr->state.lip_rounding);
        out_state->lip_compression = curr->state.lip_compression + t * (next->state.lip_compression - curr->state.lip_compression);
        out_state->lip_protrusion = curr->state.lip_protrusion + t * (next->state.lip_protrusion - curr->state.lip_protrusion);
        out_state->lip_corner_height = curr->state.lip_corner_height + t * (next->state.lip_corner_height - curr->state.lip_corner_height);
        out_state->tongue_height = curr->state.tongue_height + t * (next->state.tongue_height - curr->state.tongue_height);
        out_state->tongue_frontness = curr->state.tongue_frontness + t * (next->state.tongue_frontness - curr->state.tongue_frontness);
        out_state->tongue_grooved = curr->state.tongue_grooved + t * (next->state.tongue_grooved - curr->state.tongue_grooved);
        out_state->velum_lowered = curr->state.velum_lowered + t * (next->state.velum_lowered - curr->state.velum_lowered);
        out_state->eyebrow_l_height = curr->state.eyebrow_l_height + t * (next->state.eyebrow_l_height - curr->state.eyebrow_l_height);
        out_state->eyebrow_r_height = curr->state.eyebrow_r_height + t * (next->state.eyebrow_r_height - curr->state.eyebrow_r_height);
        out_state->eye_l_openness = curr->state.eye_l_openness + t * (next->state.eye_l_openness - curr->state.eye_l_openness);
        out_state->eye_r_openness = curr->state.eye_r_openness + t * (next->state.eye_r_openness - curr->state.eye_r_openness);
    } else {
        /* Just use current frame */
        *out_state = seq->frames[seq->playback_frame].state;
    }

    return 1;  /* Still playing */
}

/* Clear sequence */
void sequence_clear(Sequence *seq) {
    seq->frame_count = 0;
    seq->duration = 0.0f;
    seq->playback_frame = 0;
    seq->playback_time = 0.0f;
    seq->recording = 0;
}

/* Export to esto format */
int sequence_export_esto(const Sequence *seq, const char *filename) {
    FILE *f = fopen(filename, "w");
    if (!f) return -1;

    fprintf(f, "# Estoface sequence export\n");
    fprintf(f, "# Duration: %.2f seconds\n", seq->duration);
    fprintf(f, "# Frames: %d\n\n", seq->frame_count);

    /* Find closest phoneme for each frame and output esto commands */
    for (int i = 0; i < seq->frame_count; i++) {
        const SequenceFrame *frame = &seq->frames[i];
        const PhonemePreset *phoneme = phoneme_find_closest(&frame->state);

        int duration_ms = 100;  /* Default frame duration */
        if (i < seq->frame_count - 1) {
            float dt = seq->frames[i + 1].timestamp - frame->timestamp;
            duration_ms = (int)(dt * 1000.0f);
        }

        int pitch_hz = 120;  /* Default pitch */

        if (phoneme) {
            fprintf(f, "%s:%d:%d\n", phoneme->symbol, duration_ms, pitch_hz);
        } else {
            fprintf(f, "# Unknown phoneme at t=%.3f\n", frame->timestamp);
        }
    }

    fclose(f);
    return 0;
}

/* Load from esto format (simplified - just reads phoneme commands) */
int sequence_load_esto(Sequence *seq, const char *filename) {
    FILE *f = fopen(filename, "r");
    if (!f) return -1;

    sequence_clear(seq);

    char line[256];
    float current_time = 0.0f;

    while (fgets(line, sizeof(line), f)) {
        /* Skip comments and empty lines */
        if (line[0] == '#' || line[0] == '\n') continue;

        /* Parse phoneme:duration:pitch */
        char symbol[32];
        int duration_ms = 100;
        int pitch_hz = 120;

        if (sscanf(line, "%31[^:]:%d:%d", symbol, &duration_ms, &pitch_hz) >= 1) {
            /* Look up phoneme */
            const PhonemePreset *preset = phoneme_get_preset(symbol);
            if (preset) {
                if (seq->frame_count < MAX_SEQUENCE_FRAMES) {
                    SequenceFrame *frame = &seq->frames[seq->frame_count];
                    frame->timestamp = current_time;
                    frame->state = preset->state;
                    seq->frame_count++;

                    current_time += duration_ms / 1000.0f;
                }
            }
        }
    }

    seq->duration = current_time;
    fclose(f);
    return 0;
}

/* Get recording status */
int sequence_is_recording(const Sequence *seq) {
    return seq->recording;
}

/* Get playback status */
int sequence_is_playing(const Sequence *seq) {
    return (seq->playback_time < seq->duration || seq->loop_enabled);
}

/* Set loop mode */
void sequence_set_loop(Sequence *seq, int enabled) {
    seq->loop_enabled = enabled;
}

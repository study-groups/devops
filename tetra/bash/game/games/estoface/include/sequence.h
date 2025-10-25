/*
 * sequence.h - Sequence recording and playback
 *
 * Records facial articulation sequences for rhythm-based performance
 */

#ifndef ESTOFACE_SEQUENCE_H
#define ESTOFACE_SEQUENCE_H

#include "types.h"

/* Initialize sequence system */
void sequence_init(Sequence *seq);

/* Start recording a new sequence */
void sequence_start_recording(Sequence *seq);

/* Stop recording */
void sequence_stop_recording(Sequence *seq);

/* Add current state to recording */
void sequence_record_frame(Sequence *seq, const FacialState *state, float timestamp);

/* Start playback */
void sequence_start_playback(Sequence *seq);

/* Stop playback */
void sequence_stop_playback(Sequence *seq);

/* Update playback (get state at current time) */
int sequence_update_playback(Sequence *seq, float delta_time, FacialState *out_state);

/* Clear sequence */
void sequence_clear(Sequence *seq);

/* Export sequence to esto format */
int sequence_export_esto(const Sequence *seq, const char *filename);

/* Load sequence from esto format */
int sequence_load_esto(Sequence *seq, const char *filename);

/* Get recording status */
int sequence_is_recording(const Sequence *seq);

/* Get playback status */
int sequence_is_playing(const Sequence *seq);

/* Enable/disable looping */
void sequence_set_loop(Sequence *seq, int enabled);

#endif /* ESTOFACE_SEQUENCE_H */

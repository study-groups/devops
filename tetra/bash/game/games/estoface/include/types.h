/*
 * types.h - Core types for Estoface Facial Animation Engine
 * 
 * Defines facial state, animation targets, and engine configuration
 */

#ifndef ESTOFACE_TYPES_H
#define ESTOFACE_TYPES_H

#include <stdint.h>
#include "logging.h"

/* Number of animatable facial parameters */
#define NUM_FACIAL_PARAMS 14

/* Panel system constants */
#define MAX_IPA_PANELS 5
#define PANEL_WIDTH 40
#define PANEL_HEIGHT 12

/* Facial parameter indices */
typedef enum {
    PARAM_JAW_OPENNESS = 0,
    PARAM_JAW_FORWARD,
    PARAM_LIP_ROUNDING,
    PARAM_LIP_COMPRESSION,
    PARAM_LIP_PROTRUSION,
    PARAM_LIP_CORNER_HEIGHT,
    PARAM_TONGUE_HEIGHT,
    PARAM_TONGUE_FRONTNESS,
    PARAM_TONGUE_GROOVED,
    PARAM_VELUM_LOWERED,
    PARAM_EYEBROW_L_HEIGHT,
    PARAM_EYEBROW_R_HEIGHT,
    PARAM_EYE_L_OPENNESS,
    PARAM_EYE_R_OPENNESS
} FacialParam;

/* Facial state - all parameters normalized to [0.0, 1.0] */
typedef struct {
    /* Articulators (IPA-based) */
    float jaw_openness;
    float jaw_forward;
    float lip_rounding;
    float lip_compression;
    float lip_protrusion;
    float lip_corner_height;
    float tongue_height;
    float tongue_frontness;
    float tongue_grooved;
    float velum_lowered;
    float eyebrow_l_height;
    float eyebrow_r_height;
    float eye_l_openness;
    float eye_r_openness;
} FacialState;

/* Animation system */
typedef struct {
    float targets[NUM_FACIAL_PARAMS];
    float rates[NUM_FACIAL_PARAMS];
    int has_target[NUM_FACIAL_PARAMS];
} AnimationTargets;

/* Engine modes */
typedef enum {
    MODE_COMMAND,
    MODE_INTERACTIVE,
    MODE_SEQUENCE_RECORD,   /* Recording a sequence */
    MODE_SEQUENCE_PLAYBACK  /* Playing back a sequence */
} EngineMode;

/* Sequence recording */
#define MAX_SEQUENCE_FRAMES 10000

/* Single frame in a sequence */
typedef struct {
    float timestamp;      /* Seconds from sequence start */
    FacialState state;    /* Facial state at this frame */
} SequenceFrame;

/* Sequence (recording or loaded) */
typedef struct {
    SequenceFrame frames[MAX_SEQUENCE_FRAMES];
    int frame_count;
    float duration;              /* Total duration in seconds */
    int loop_enabled;            /* Loop playback */
    int recording;               /* Currently recording */
    float record_start_time;     /* Start time of recording */
    int playback_frame;          /* Current playback frame */
    float playback_time;         /* Current playback time */
} Sequence;

/* Forward declaration */
typedef struct PhonemePreset PhonemePreset;

/* Phoneme preset structure */
struct PhonemePreset {
    const char *symbol;
    const char *description;
    FacialState state;
};

/* IPA Panel */
typedef struct {
    int visible;
    int x, y;
    int panel_type;  /* PanelType enum value (0-4) */
    char title[32];
    const PhonemePreset *phoneme;
    char esto_code[256];
    FacialState state_snapshot;  /* Snapshot of state for display */
} IPAPanel;

/* Main engine context */
typedef struct {
    FacialState current;
    AnimationTargets anim;
    EngineMode mode;
    int running;
    int cols, rows;
    char command_buf[256];
    int command_len;
    IPAPanel panels[MAX_IPA_PANELS];
    EventLog event_log;

    /* Sequence recording/playback */
    Sequence sequence;
    int metronome_enabled;     /* Show metronome grid */
    float metronome_bpm;       /* Beats per minute */

    /* Gamepad input */
    int gamepad_enabled;       /* Gamepad input active */
} EstofaceContext;

#endif /* ESTOFACE_TYPES_H */

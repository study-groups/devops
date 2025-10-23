/*
 * types.h - Core types for Estovox Facial Animation Engine
 * 
 * Defines facial state, animation targets, and engine configuration
 */

#ifndef ESTOVOX_TYPES_H
#define ESTOVOX_TYPES_H

#include <stdint.h>

/* Number of animatable facial parameters */
#define NUM_FACIAL_PARAMS 14

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
    float jaw_openness;       /* 0.0=closed, 1.0=fully open */
    float jaw_forward;        /* 0.0=back, 1.0=forward */
    float lip_rounding;       /* 0.0=spread, 1.0=rounded */
    float lip_compression;    /* 0.0=relaxed, 1.0=compressed */
    float lip_protrusion;     /* 0.0=retracted, 1.0=protruded */
    float lip_corner_height;  /* 0.0=down(frown), 0.5=neutral, 1.0=up(smile) */
    
    /* Tongue position */
    float tongue_height;      /* 0.0=low, 1.0=high */
    float tongue_frontness;   /* 0.0=back, 1.0=front */
    float tongue_grooved;     /* 0.0=flat, 1.0=grooved */
    
    /* Velum */
    float velum_lowered;      /* 0.0=raised(oral), 1.0=lowered(nasal) */
    
    /* Face features */
    float eyebrow_l_height;   /* 0.0=down, 1.0=up */
    float eyebrow_r_height;
    float eye_l_openness;     /* 0.0=closed, 1.0=open */
    float eye_r_openness;
} FacialState;

/* Animation system - per-parameter targets and rates */
typedef struct {
    float targets[NUM_FACIAL_PARAMS];  /* Target values */
    float rates[NUM_FACIAL_PARAMS];    /* Interpolation rates (0.0-1.0) */
    int has_target[NUM_FACIAL_PARAMS]; /* Active target flags */
} AnimationTargets;

/* Engine modes */
typedef enum {
    MODE_COMMAND,      /* Command-line input mode */
    MODE_INTERACTIVE   /* Real-time keyboard control */
} EngineMode;

/* Main engine context */
typedef struct {
    FacialState current;       /* Current facial state */
    AnimationTargets anim;     /* Animation targets */
    EngineMode mode;           /* Current mode */
    int running;               /* Main loop flag */
    int cols, rows;            /* Terminal dimensions */
    char command_buf[256];     /* Command input buffer */
    int command_len;           /* Current command length */
} EstovoxContext;

/* Phoneme preset */
typedef struct {
    const char *symbol;        /* IPA symbol (e.g., "a", "i", "p") */
    const char *description;   /* Human-readable description */
    FacialState state;         /* Target facial configuration */
} PhonemePreset;

#endif /* ESTOVOX_TYPES_H */

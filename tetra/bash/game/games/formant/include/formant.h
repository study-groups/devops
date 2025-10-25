/**
 * Formant - Real-time Granular Synthesis Engine with Vocal Tract Modeling
 *
 * Main header file for the formant synthesis engine.
 * Includes all public API declarations and data structures.
 *
 * Target latency: < 20ms
 * Sample rate: 48000 Hz (also supports 44100, 24000, 16000 Hz)
 * Buffer size: 512 samples (10.7ms @ 48kHz)
 */

#ifndef FORMANT_H
#define FORMANT_H

#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include <portaudio.h>

#ifdef __cplusplus
extern "C" {
#endif

/* ============================================================================
 * Constants
 * ========================================================================= */

#define FORMANT_VERSION_MAJOR 0
#define FORMANT_VERSION_MINOR 1
#define FORMANT_VERSION_PATCH 0

#define FORMANT_SAMPLE_RATE_DEFAULT 48000.0f
#define FORMANT_BUFFER_SIZE_DEFAULT 512
#define FORMANT_MAX_FORMANTS 5
#define FORMANT_MAX_GRAINS 64
#define FORMANT_MAX_COMMANDS 256

#define FORMANT_IPA_MAX_LEN 4
#define FORMANT_PARAM_MAX_LEN 16
#define FORMANT_EMOTION_MAX_LEN 16

/* ============================================================================
 * Enums
 * ========================================================================= */

typedef enum {
    FORMANT_CMD_PHONEME,     /* PH - Phoneme command */
    FORMANT_CMD_FORMANT,     /* FM - Direct formant control */
    FORMANT_CMD_PROSODY,     /* PR - Prosody parameter */
    FORMANT_CMD_EMOTION,     /* EM - Emotion setting */
    FORMANT_CMD_MODE,        /* MODE - Set synthesis mode */
    FORMANT_CMD_SEQUENCE,    /* SQ - Phoneme sequence */
    FORMANT_CMD_RESET,       /* RESET - Reset engine */
    FORMANT_CMD_SYNC,        /* SYNC - Synchronization marker */
    FORMANT_CMD_FLUSH,       /* FLUSH - Flush buffers */
    FORMANT_CMD_PAUSE,       /* PAUSE - Pause synthesis */
    FORMANT_CMD_RESUME,      /* RESUME - Resume synthesis */
    FORMANT_CMD_RECORD,      /* RECORD - Record audio input (fixed duration) */
    FORMANT_CMD_RECORD_VAD,  /* RECORD_VAD - Record with voice activity detection */
    FORMANT_CMD_STOP         /* STOP - Stop with fadeout */
} formant_command_type_t;

typedef enum {
    FORMANT_PHONEME_VOWEL,
    FORMANT_PHONEME_PLOSIVE,
    FORMANT_PHONEME_FRICATIVE,
    FORMANT_PHONEME_NASAL,
    FORMANT_PHONEME_APPROXIMANT,
    FORMANT_PHONEME_LATERAL,
    FORMANT_PHONEME_RHOTIC,
    FORMANT_PHONEME_SILENCE
} formant_phoneme_type_t;

typedef enum {
    FORMANT_SYNTH_MODE_FORMANT,   /* Pure formant synthesis (default) */
    FORMANT_SYNTH_MODE_CELP,      /* Pure CELP synthesis */
    FORMANT_SYNTH_MODE_HYBRID     /* Blend of formant + CELP */
} formant_synth_mode_t;

typedef enum {
    FORMANT_EMOTION_NEUTRAL,
    FORMANT_EMOTION_HAPPY,
    FORMANT_EMOTION_SAD,
    FORMANT_EMOTION_ANGRY,
    FORMANT_EMOTION_FEAR,
    FORMANT_EMOTION_DISGUST,
    FORMANT_EMOTION_SURPRISED
} formant_emotion_t;

typedef enum {
    FORMANT_PROSODY_PITCH,
    FORMANT_PROSODY_RATE,
    FORMANT_PROSODY_VOLUME,
    FORMANT_PROSODY_BREATHINESS,
    FORMANT_PROSODY_CREAKY,
    FORMANT_PROSODY_TENSION
} formant_prosody_param_t;

/* ============================================================================
 * Data Structures - Phoneme Configuration
 * ========================================================================= */

typedef struct {
    char ipa[FORMANT_IPA_MAX_LEN];  /* IPA symbol (e.g., "a", "i", "sh") */
    formant_phoneme_type_t type;
    float f1, f2, f3, f4, f5;       /* Formant frequencies (Hz) */
    float bw1, bw2, bw3, bw4, bw5;  /* Bandwidths (Hz) */
    float amp1, amp2, amp3, amp4, amp5; /* Relative amplitudes */
    float duration_default;          /* Default duration (ms) */
    float aspiration;                /* Aspiration noise level (0-1) */
    float frication;                 /* Frication noise level (0-1) */
    bool voiced;                     /* Voiced or unvoiced */
} formant_phoneme_config_t;

/* ============================================================================
 * Data Structures - Filters
 * ========================================================================= */

typedef struct {
    /* Biquad filter coefficients */
    float b0, b1, b2;  /* Numerator */
    float a1, a2;      /* Denominator (a0 = 1) */

    /* State */
    float x1, x2;      /* Input history */
    float y1, y2;      /* Output history */

    /* Parameters */
    float freq;        /* Center frequency (Hz) */
    float bw;          /* Bandwidth (Hz) */
    float gain;        /* Gain multiplier */
} formant_filter_t;

/* LPC filter for CELP synthesis */
typedef struct {
    float a[10];       /* LPC coefficients (10th order) */
    float gain;        /* Overall gain */
    float mem[10];     /* Filter memory (state) */
} formant_lpc_filter_t;

typedef struct {
    formant_filter_t filters[FORMANT_MAX_FORMANTS];
    int num_formants;  /* Typically 3-5 */
} formant_bank_t;

/* ============================================================================
 * Data Structures - Grain
 * ========================================================================= */

typedef struct {
    float* buffer;          /* Grain audio samples */
    int length;             /* Number of samples */
    int position;           /* Current playback position */
    float pitch_shift;      /* Pitch shift factor */
    float envelope_pos;     /* Envelope position (0.0-1.0) */
    bool active;            /* Is this grain active? */
    float amplitude;        /* Grain amplitude */
} formant_grain_t;

typedef struct {
    formant_grain_t grains[FORMANT_MAX_GRAINS];
    int num_active;
    float grain_size_ms;     /* Grain duration (20-100ms) */
    float grain_density;     /* Overlap factor (0-1) */
    int grain_trigger_counter;
} formant_grain_engine_t;

/* ============================================================================
 * Data Structures - Sound Grain System
 * ========================================================================= */

/**
 * Sound grain - pre-recorded formant sample with metadata
 * Used for high-quality voice synthesis with perfect loop points
 */
typedef struct {
    char phoneme[FORMANT_IPA_MAX_LEN];   /* IPA symbol */
    char sample_file[256];                /* WAV file path */
    uint32_t midpoint_sample;             /* Best cycle midpoint (sample index) */
    uint32_t duration_samples;            /* Grain spread (±duration from midpoint) */
    uint32_t loop_start;                  /* Perfect loop point A (sample index) */
    uint32_t loop_end;                    /* Perfect loop point B (sample index) */
    float* gain_map;                      /* Per-chunk amplitude array (dynamic) */
    uint16_t gain_map_chunks;             /* Number of chunks in gain map */
    float selection_gain;                 /* Overall gain adjustment (dB) */
    float* audio_data;                    /* Loaded audio samples (dynamic) */
    uint32_t audio_length;                /* Length of audio data in samples */
    float sample_rate;                    /* Sample rate of grain */
} sound_grain_t;

/**
 * Phoneme BST node - binary search tree ordered by phonetic features
 * Hierarchy: Vowel/Consonant → Voicing → Place/Manner → Height/Backness
 */
typedef struct phoneme_bst_node {
    const formant_phoneme_config_t* phoneme;  /* Phoneme data */
    sound_grain_t* grain;                     /* Associated sound grain (optional) */
    struct phoneme_bst_node* left;            /* Left child (lower feature value) */
    struct phoneme_bst_node* right;           /* Right child (higher feature value) */
    uint8_t feature_vector;                   /* Phonetic feature bits for ordering */
} phoneme_bst_node_t;

/**
 * Sound bank - collection of grains organized by BST
 */
typedef struct {
    phoneme_bst_node_t* root;            /* Root of phoneme BST */
    sound_grain_t* grains;               /* Array of all grains */
    int num_grains;                      /* Number of grains loaded */
    int capacity;                        /* Array capacity */
    char bank_path[256];                 /* Path to sound bank directory */
} sound_bank_t;

/* ============================================================================
 * Data Structures - VU Meter & Metering
 * ========================================================================= */

/* Forward declaration for VAD */
typedef struct formant_vad formant_vad_t;

/**
 * FIR filter for frequency weighting (A-weight, bass, treble, etc.)
 */
typedef struct {
    float* coeffs;                       /* Filter coefficients (dynamic array) */
    int num_taps;                        /* Number of filter taps */
    float* history;                      /* Input sample history (circular) */
    int history_pos;                     /* Current position in history buffer */
    char name[32];                       /* Filter name (e.g., "A-weight") */
} formant_fir_filter_t;

/**
 * Meter ballistics - attack/release behavior for VU needle
 */
typedef struct {
    float attack_coeff;                  /* Attack time coefficient */
    float release_coeff;                 /* Release time coefficient */
    float integration_time_ms;           /* Integration window for RMS */
    float peak_hold_time_ms;             /* Peak hold duration */
} meter_ballistics_t;

/**
 * VU Meter - professional audio metering with selectable response
 */
typedef struct {
    /* Configuration */
    float sample_rate;
    formant_fir_filter_t filter;         /* Frequency weighting filter */
    meter_ballistics_t ballistics;       /* Attack/release behavior */

    /* Meter state */
    float rms_current;                   /* Current RMS value */
    float peak_current;                  /* Current peak value */
    float peak_hold;                     /* Peak hold value */
    float true_peak;                     /* True peak (oversampled) */
    uint64_t peak_hold_start_us;         /* When peak hold started */

    /* RMS integration buffer */
    float* rms_buffer;                   /* Circular buffer for RMS calculation */
    int rms_buffer_size;                 /* Buffer size in samples */
    int rms_buffer_pos;                  /* Current position */

    /* Statistics */
    float min_level;                     /* Minimum level seen */
    float max_level;                     /* Maximum level seen */
    uint64_t clip_count;                 /* Number of clipping samples */

    /* VAD integration */
    formant_vad_t* vad;                  /* Optional VAD for threshold metering */
    bool vad_enabled;                    /* Use VAD thresholds */
} formant_meter_t;

/* ============================================================================
 * Data Structures - Emotional Modulation
 * ========================================================================= */

typedef struct {
    float intensity;          /* Vocal fry intensity (0-1) */
    float irregularity;       /* Pitch period jitter */
    float subharmonic_amp;    /* F0/2 amplitude */
    int pulse_count;          /* Pulse counter for irregularity */
    float last_period;        /* Last pitch period length */
} formant_vocal_fry_t;

typedef struct {
    float intensity;          /* Breathiness intensity (0-1) */
    float noise_amp;          /* Aspiration noise amplitude */
    float harmonic_damp;      /* Harmonic amplitude reduction */
} formant_breathiness_t;

typedef struct {
    formant_emotion_t current;
    float intensity;          /* Emotion intensity (0-1) */
    formant_vocal_fry_t vocal_fry;
    formant_breathiness_t breathiness;
    float tension;            /* Vocal tension (0-1) */
} formant_emotion_state_t;

/* ============================================================================
 * Data Structures - Commands
 * ========================================================================= */

typedef struct {
    formant_command_type_t type;
    uint64_t timestamp_us;    /* Timestamp in microseconds */

    union {
        /* PHONEME */
        struct {
            char ipa[FORMANT_IPA_MAX_LEN];
            float duration_ms;
            float pitch_hz;
            float intensity;
            float rate;
        } phoneme;

        /* FORMANT */
        struct {
            float f1, f2, f3, f4, f5;
            float bw1, bw2, bw3, bw4, bw5;
            float duration_ms;
        } formant;

        /* PROSODY */
        struct {
            char param[FORMANT_PARAM_MAX_LEN];
            float value;
        } prosody;

        /* EMOTION */
        struct {
            char emotion[FORMANT_EMOTION_MAX_LEN];
            float intensity;
        } emotion;

        /* MODE */
        struct {
            char mode[16];  /* "FORMANT", "CELP", or "HYBRID" */
            float mix;      /* Hybrid mix (0.0-1.0), optional */
        } mode;

        /* SYNC */
        struct {
            uint64_t timestamp_ms;
        } sync;

        /* RECORD */
        struct {
            char phoneme[FORMANT_IPA_MAX_LEN];  /* Phoneme name for labeling */
            float duration_ms;                   /* Recording duration (or max for VAD) */
            char filename[256];                  /* Output WAV filename */
            bool use_vad;                        /* Use VAD for automatic recording */
            int vad_mode;                        /* VAD aggressiveness (0-2) */
        } record;

    } params;
} formant_command_t;

/* ============================================================================
 * Data Structures - Ring Buffer
 * ========================================================================= */

typedef struct {
    float* buffer;
    int size;              /* Power of 2 */
    int write_pos;
    int read_pos;
} formant_ring_buffer_t;

/* ============================================================================
 * Data Structures - Audio Engine
 * ========================================================================= */

typedef struct {
    PaStream* stream;
    float sample_rate;
    int buffer_size;
    formant_ring_buffer_t ring;
    bool running;
} formant_audio_engine_t;

/* ============================================================================
 * Data Structures - CELP Engine
 * ========================================================================= */

typedef struct {
    formant_lpc_filter_t lpc;           /* LPC all-pole filter */
    const void* current_excitation;     /* Current excitation vector */
    int excitation_position;            /* Position in excitation vector */
    int excitation_length;              /* Length of excitation vector */
    bool excitation_loop;               /* Loop excitation for sustained phonemes */
} formant_celp_engine_t;

/* ============================================================================
 * Data Structures - Voice Activity Detection (VAD)
 * ========================================================================= */

typedef enum {
    FORMANT_VAD_SILENCE,
    FORMANT_VAD_SPEECH_START,
    FORMANT_VAD_SPEECH,
    FORMANT_VAD_SPEECH_END
} formant_vad_state_t;

typedef enum {
    FORMANT_VAD_RESULT_SILENCE = 0,
    FORMANT_VAD_RESULT_SPEECH = 1
} formant_vad_result_t;

struct formant_vad {
    /* Configuration */
    float sample_rate;
    int frame_size;                  /* Samples per frame (e.g., 160 @ 16kHz = 10ms) */
    int mode;                        /* 0=quality, 1=balanced, 2=aggressive */

    /* Feature history (for smoothing) */
    float* energy_history;
    float* zcr_history;
    int history_length;
    int history_pos;

    /* Adaptive thresholds */
    float energy_threshold;
    float zcr_threshold;
    float sf_threshold;
    float noise_floor;               /* Estimated background noise level */
    bool calibrated;                 /* Has noise floor been calibrated? */

    /* State machine */
    formant_vad_state_t state;
    int hangover_counter;            /* Frames to continue after speech ends */
    int hangover_max;                /* Max hangover frames (mode-dependent) */
    int speech_frames;               /* Consecutive speech frames detected */
    int silence_frames;              /* Consecutive silence frames detected */
    int min_speech_frames;           /* Min frames to confirm speech */

    /* Pre-trigger circular buffer */
    float* pretrigger_buffer;
    int pretrigger_size;             /* Size in samples */
    int pretrigger_pos;              /* Write position */
    int pretrigger_available;        /* Samples available */

    /* Statistics */
    int frames_processed;
    int speech_detected_count;

};

/* ============================================================================
 * Data Structures - Recorder
 * ========================================================================= */

typedef enum {
    FORMANT_RECORDER_IDLE,
    FORMANT_RECORDER_WAITING_FOR_SPEECH,  /* VAD mode: waiting for speech */
    FORMANT_RECORDER_RECORDING,
    FORMANT_RECORDER_STOPPING
} formant_recorder_state_t;

typedef struct {
    PaStream* stream;                   /* PortAudio input stream */
    FILE* wav_file;                     /* Output WAV file */
    float* buffer;                      /* Recording buffer */
    int buffer_size;                    /* Buffer size in samples */
    int buffer_pos;                     /* Current position in buffer */
    int samples_recorded;               /* Total samples recorded */
    int samples_target;                 /* Target number of samples (or max for VAD) */
    float sample_rate;                  /* Recording sample rate */
    formant_recorder_state_t state;     /* Current state */
    char filename[256];                 /* Output filename */

    /* VAD support */
    formant_vad_t* vad;                 /* Voice activity detector (optional) */
    bool use_vad;                       /* Use VAD for automatic recording */
    uint64_t start_time_us;             /* Time when recording started */
    uint64_t max_duration_us;           /* Maximum recording duration */
} formant_recorder_t;

/* ============================================================================
 * Data Structures - Main Engine
 * ========================================================================= */

typedef struct {
    /* Audio */
    formant_audio_engine_t audio;
    float sample_rate;

    /* Synthesis mode */
    formant_synth_mode_t synth_mode;    /* Current synthesis mode */
    float hybrid_mix;                    /* Blend factor (0.0=CELP, 1.0=formant) */

    /* Synthesis */
    formant_bank_t formant_bank;
    formant_grain_engine_t grain_engine;
    formant_celp_engine_t celp_engine;  /* CELP synthesis engine */

    /* Recording */
    formant_recorder_t* recorder;        /* Audio input recorder */

    /* Metering */
    formant_meter_t* meter;              /* VU meter for monitoring */

    /* Sound Bank */
    sound_bank_t* sound_bank;            /* Pre-recorded sound grains */

    /* Source */
    float phase;               /* Glottal phase (0.0-1.0) */
    float f0_hz;              /* Fundamental frequency */
    float intensity;          /* Amplitude (0.0-1.0) */

    /* Formant targets (for interpolation) */
    float f1_current, f1_target;
    float f2_current, f2_target;
    float f3_current, f3_target;
    float f4_current, f4_target;
    float f5_current, f5_target;
    float lerp_rate;          /* Interpolation rate (0-1) */

    /* Prosody */
    float pitch_base;         /* Base pitch (Hz) */
    float rate_multiplier;    /* Speaking rate multiplier */
    float volume;             /* Global volume (0-1) */

    /* Emotion */
    formant_emotion_state_t emotion;

    /* Timing */
    uint64_t time_us;         /* Current synthesis time (microseconds) */
    uint64_t samples_processed;

    /* Command queue (circular buffer) */
    formant_command_t cmd_queue[FORMANT_MAX_COMMANDS];
    int cmd_queue_head;
    int cmd_queue_tail;
    int cmd_queue_size;

    /* Current phoneme */
    const formant_phoneme_config_t* current_phoneme;
    uint64_t phoneme_start_us;
    uint64_t phoneme_duration_us;

    /* Plosive burst state */
    bool in_plosive_burst;
    float plosive_burst_time;
    float plosive_burst_duration;  /* in samples */

    /* State */
    bool paused;

    /* Diagnostics */
    bool enable_diagnostics;
    int diagnostic_sample_count;

} formant_engine_t;

/* ============================================================================
 * Core Engine Functions
 * ========================================================================= */

/**
 * Create and initialize formant synthesis engine
 */
formant_engine_t* formant_engine_create(float sample_rate);

/**
 * Destroy and free formant engine
 */
void formant_engine_destroy(formant_engine_t* engine);

/**
 * Reset engine to neutral state
 */
void formant_engine_reset(formant_engine_t* engine);

/**
 * Start audio output
 */
int formant_engine_start(formant_engine_t* engine);

/**
 * Stop audio output
 */
void formant_engine_stop(formant_engine_t* engine);

/**
 * Process audio buffer (called by PortAudio callback)
 */
void formant_engine_process(formant_engine_t* engine, float* output, int num_samples);

/* ============================================================================
 * Command Functions
 * ========================================================================= */

/**
 * Parse command string into command structure
 * Returns NULL on parse error
 */
formant_command_t* formant_parse_command(const char* line);

/**
 * Queue command for execution
 */
void formant_queue_command(formant_engine_t* engine, formant_command_t* cmd);

/**
 * Process queued commands (called during audio processing)
 */
void formant_process_commands(formant_engine_t* engine);

/* ============================================================================
 * Phoneme Functions
 * ========================================================================= */

/**
 * Get phoneme configuration by IPA symbol
 * Returns NULL if not found
 */
const formant_phoneme_config_t* formant_get_phoneme(const char* ipa);

/**
 * Get all available phonemes
 */
const formant_phoneme_config_t* formant_get_all_phonemes(int* count);

/**
 * Interpolate between two phonemes (for coarticulation)
 */
void formant_interpolate_phonemes(
    const formant_phoneme_config_t* from,
    const formant_phoneme_config_t* to,
    float t,  /* 0.0 to 1.0 */
    float* f1, float* f2, float* f3, float* f4, float* f5
);

/* ============================================================================
 * Filter Functions
 * ========================================================================= */

/**
 * Initialize formant filter
 */
void formant_filter_init(formant_filter_t* filter, float freq, float bw, float sample_rate);

/**
 * Update filter frequency
 */
void formant_filter_set_freq(formant_filter_t* filter, float freq, float sample_rate);

/**
 * Process single sample through filter
 */
float formant_filter_process(formant_filter_t* filter, float input);

/**
 * Process buffer through formant bank
 */
void formant_bank_process(formant_bank_t* bank, const float* input, float* output, int num_samples);

/* ============================================================================
 * Source Generator Functions
 * ========================================================================= */

/**
 * Generate glottal pulse using LF model
 */
float formant_generate_glottal(float phase, float oq, float alpha);

/**
 * Generate aspiration noise
 */
float formant_generate_aspiration(float intensity);

/**
 * Generate frication noise
 */
float formant_generate_frication(float intensity, float cutoff_freq);

/**
 * Generate white noise
 */
float formant_generate_white_noise(void);

/**
 * Generate plosive burst
 */
float formant_generate_plosive_burst(float time_in_burst, float intensity, float freq);

/* ============================================================================
 * CELP Functions
 * ========================================================================= */

/**
 * Initialize CELP engine
 */
void formant_celp_init(formant_celp_engine_t* celp);

/**
 * Set LPC coefficients for phoneme
 */
void formant_celp_set_lpc(formant_celp_engine_t* celp, const char* phoneme);

/**
 * Select excitation vector for phoneme
 */
void formant_celp_select_excitation(
    formant_celp_engine_t* celp,
    const formant_phoneme_config_t* phoneme,
    float pitch);

/**
 * Process single sample through CELP engine
 */
float formant_celp_process_sample(formant_celp_engine_t* celp);

/**
 * Set synthesis mode
 */
void formant_engine_set_mode(formant_engine_t* engine, formant_synth_mode_t mode);

/**
 * Set hybrid mix (0.0 = pure CELP, 1.0 = pure formant)
 */
void formant_engine_set_hybrid_mix(formant_engine_t* engine, float mix);

/* ============================================================================
 * Utility Functions
 * ========================================================================= */

/**
 * Linear interpolation
 */
static inline float formant_lerp(float a, float b, float t) {
    return a + (b - a) * t;
}

/**
 * Clamp value to range
 */
static inline float formant_clamp(float value, float min, float max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

/**
 * Get current time in microseconds
 */
uint64_t formant_get_time_us(void);

/* ============================================================================
 * Diagnostic Functions
 * ========================================================================= */

/**
 * Reset RMS measurement
 */
void formant_diagnostics_reset_rms(void);

/**
 * Update RMS with new sample
 */
void formant_diagnostics_update_rms(float sample);

/**
 * Get current RMS value
 */
float formant_diagnostics_get_rms(void);

/**
 * Print audio statistics
 */
void formant_diagnostics_print_stats(void);

/* ============================================================================
 * VAD Functions
 * ========================================================================= */

/**
 * Create and initialize VAD
 * @param sample_rate Sample rate in Hz
 * @param mode 0=quality, 1=balanced, 2=aggressive
 */
formant_vad_t* formant_vad_create(float sample_rate, int mode);

/**
 * Destroy and free VAD
 */
void formant_vad_destroy(formant_vad_t* vad);

/**
 * Reset VAD state
 */
void formant_vad_reset(formant_vad_t* vad);

/**
 * Calibrate noise floor from silence
 * Call this with ~1-2 seconds of background noise
 */
void formant_vad_calibrate(formant_vad_t* vad, const float* samples, int num_samples);

/**
 * Process audio frame and detect voice activity
 * @param samples Audio samples (must be frame_size length)
 * @param frame_size Number of samples in frame
 * @return FORMANT_VAD_RESULT_SILENCE or FORMANT_VAD_RESULT_SPEECH
 */
formant_vad_result_t formant_vad_process_frame(formant_vad_t* vad, const float* samples, int frame_size);

/**
 * Get current VAD state
 */
formant_vad_state_t formant_vad_get_state(formant_vad_t* vad);

/**
 * Get pre-trigger buffer samples
 * Returns number of samples retrieved
 */
int formant_vad_get_pretrigger(formant_vad_t* vad, float* output, int max_samples);

/* ============================================================================
 * Recorder Functions
 * ========================================================================= */

/**
 * Create and initialize recorder
 */
formant_recorder_t* formant_recorder_create(float sample_rate);

/**
 * Destroy and free recorder
 */
void formant_recorder_destroy(formant_recorder_t* recorder);

/**
 * Start recording to file (fixed duration)
 * Returns 0 on success, -1 on error
 */
int formant_recorder_start(formant_recorder_t* recorder, const char* filename, float duration_ms);

/**
 * Start recording with VAD (automatic speech detection)
 * Returns 0 on success, -1 on error
 */
int formant_recorder_start_vad(formant_recorder_t* recorder, const char* filename,
                                float max_duration_ms, int vad_mode);

/**
 * Stop recording and finalize WAV file
 * Returns 0 on success, -1 on error
 */
int formant_recorder_stop(formant_recorder_t* recorder);

/**
 * Check if recorder is currently recording
 */
bool formant_recorder_is_recording(formant_recorder_t* recorder);

/**
 * Get recording progress (0.0 to 1.0)
 */
float formant_recorder_get_progress(formant_recorder_t* recorder);

/* ============================================================================
 * Metering Functions
 * ========================================================================= */

/**
 * Create and initialize VU meter
 * @param sample_rate Sample rate in Hz
 * @param preset Meter preset: "vu", "a_weight", "bass", "treble"
 */
formant_meter_t* formant_meter_create(float sample_rate, const char* preset);

/**
 * Destroy and free meter
 */
void formant_meter_destroy(formant_meter_t* meter);

/**
 * Load FIR filter coefficients from file
 * @param filename Path to coefficient file (e.g., "meters/a_weight.coef")
 * @return Number of coefficients loaded, or -1 on error
 */
int formant_meter_load_filter(formant_meter_t* meter, const char* filename);

/**
 * Process audio samples through meter
 * Updates RMS, peak, and true peak values
 */
void formant_meter_process(formant_meter_t* meter, const float* samples, int num_samples);

/**
 * Get current RMS level in dB
 */
float formant_meter_get_rms_db(formant_meter_t* meter);

/**
 * Get current peak level in dB
 */
float formant_meter_get_peak_db(formant_meter_t* meter);

/**
 * Get peak hold level in dB
 */
float formant_meter_get_peak_hold_db(formant_meter_t* meter);

/**
 * Reset meter statistics
 */
void formant_meter_reset(formant_meter_t* meter);

/**
 * Format meter display as ASCII bargraph
 * @param buffer Output buffer
 * @param buffer_size Buffer size
 * @param width Display width in characters
 */
void formant_meter_format_display(formant_meter_t* meter, char* buffer, int buffer_size, int width);

/* ============================================================================
 * Sound Bank Functions
 * ========================================================================= */

/**
 * Create and initialize sound bank
 */
sound_bank_t* sound_bank_create(const char* bank_path);

/**
 * Destroy and free sound bank
 */
void sound_bank_destroy(sound_bank_t* bank);

/**
 * Load sound grain from WAV file with metadata
 * @param phoneme IPA phoneme symbol
 * @param wav_file Path to WAV file
 * @param metadata_file Path to grain metadata JSON file
 * @return Pointer to loaded grain, or NULL on error
 */
sound_grain_t* sound_bank_load_grain(sound_bank_t* bank, const char* phoneme,
                                      const char* wav_file, const char* metadata_file);

/**
 * Find grain by phoneme symbol (using BST)
 * @param phoneme IPA phoneme symbol
 * @return Pointer to grain, or NULL if not found
 */
sound_grain_t* sound_bank_find_grain(sound_bank_t* bank, const char* phoneme);

/**
 * Analyze WAV file to find optimal loop points and grain parameters
 * @param wav_file Path to WAV file
 * @param grain Output grain structure (allocated by caller)
 * @return 0 on success, -1 on error
 */
int sound_bank_analyze_grain(const char* wav_file, sound_grain_t* grain);

/**
 * Export grain metadata to JSON file
 */
int sound_bank_export_grain_metadata(const sound_grain_t* grain, const char* filename);

/**
 * Insert phoneme into BST using phonetic feature hierarchy
 */
void sound_bank_bst_insert(sound_bank_t* bank, const formant_phoneme_config_t* phoneme, sound_grain_t* grain);

/**
 * Calculate phonetic feature vector for BST ordering
 * Feature bits: [vowel/cons][voicing][obstruent/sonorant][place][manner][height][backness][rounding]
 */
uint8_t sound_bank_calc_feature_vector(const formant_phoneme_config_t* phoneme);

/**
 * Print BST structure (for debugging)
 */
void sound_bank_print_tree(phoneme_bst_node_t* node, int depth);

#ifdef __cplusplus
}
#endif

#endif /* FORMANT_H */

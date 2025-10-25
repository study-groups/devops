/*
 * gamepad.h - Gamepad input with zone detection for mouth articulation
 *
 * Treats joystick axes as 4-zone discretized controls (non-literal mapping)
 * with natural discretization - helping users "learn to speak with their hands"
 */

#ifndef ESTOFACE_GAMEPAD_H
#define ESTOFACE_GAMEPAD_H

#include "types.h"
#include <stdint.h>

/* Gamepad protocol (compatible with pulsar sender) */
#define AXES_MAX 6
#define MAX_PLAYERS 4

/* Wire format message from gamepad sender */
struct gp_msg {
    uint32_t version;        /* = 1 */
    uint32_t player_id;      /* 0-3 */
    uint32_t seq;            /* Message sequence number */
    uint32_t buttons;        /* Button bitfield */
    int16_t  axes[AXES_MAX]; /* [-32768,32767] : LX, LY, RX, RY, LT, RT */
    uint16_t n_axes;         /* Number of axes */
    uint64_t t_mono_ns;      /* Sender timestamp */
};

/* Zone detection constants */
#define ZONE_COUNT 4
#define ZONE_DEADZONE 0.15f    /* Center dead zone */
#define ZONE_HYSTERESIS 0.1f   /* Prevent zone jitter */

/* Zone indices (0-3 per axis) */
typedef enum {
    ZONE_NEG_FULL = 0,   /* -1.0 to -0.5 */
    ZONE_NEG_HALF = 1,   /* -0.5 to 0.0 */
    ZONE_POS_HALF = 2,   /* 0.0 to 0.5 */
    ZONE_POS_FULL = 3    /* 0.5 to 1.0 */
} ZoneIndex;

/* 2D zone position (X, Y) - each axis discretized to 4 zones */
typedef struct {
    int x;  /* 0-3 */
    int y;  /* 0-3 */
    float confidence;  /* 0.0-1.0: how centered in zone */
    int stable;        /* Zone held for multiple frames */
} Zone2D;

/* Gamepad state with zone detection */
typedef struct {
    /* Raw normalized axes [-1.0, 1.0] */
    float left_x;
    float left_y;
    float right_x;
    float right_y;
    float left_trigger;   /* 0.0-1.0 */
    float right_trigger;  /* 0.0-1.0 */

    /* Button state */
    uint32_t buttons;

    /* Zone detection */
    Zone2D left_zone;   /* Tongue control */
    Zone2D right_zone;  /* Jaw/Lip control */

    /* Zone stability tracking */
    int left_zone_frames;   /* Frames in current zone */
    int right_zone_frames;  /* Frames in current zone */

    /* Previous zone (for hysteresis) */
    Zone2D prev_left_zone;
    Zone2D prev_right_zone;

    /* Metadata */
    uint32_t last_seq;
    uint64_t last_update_ns;
} GamepadState;

/* Hat/D-pad button indices (from sender.c) */
#define BTN_A          0x0001
#define BTN_B          0x0002
#define BTN_X          0x0004
#define BTN_Y          0x0008
#define BTN_BACK       0x0010
#define BTN_GUIDE      0x0020
#define BTN_START      0x0040
#define BTN_LSTICK     0x0080
#define BTN_RSTICK     0x0100
#define BTN_LSHOULDER  0x0200
#define BTN_RSHOULDER  0x0400
#define BTN_DPAD_UP    0x0800
#define BTN_DPAD_DOWN  0x1000
#define BTN_DPAD_LEFT  0x2000
#define BTN_DPAD_RIGHT 0x4000

/* Initialize gamepad system */
int gamepad_init(EstofaceContext *ctx, const char *socket_path);

/* Cleanup gamepad system */
void gamepad_cleanup(EstofaceContext *ctx);

/* Poll gamepad input (non-blocking) */
void gamepad_poll(EstofaceContext *ctx);

/* Get current gamepad state (for player 0) */
const GamepadState* gamepad_get_state(const EstofaceContext *ctx);

/* Zone detection: convert raw axis to zone index */
int gamepad_axis_to_zone(float axis, float prev_axis);

/* Calculate zone confidence (0.0-1.0, higher = more centered) */
float gamepad_zone_confidence(float axis, int zone);

/* Update zone detection from raw axes */
void gamepad_update_zones(GamepadState *state);

/* Apply gamepad zones to facial state */
void gamepad_apply_to_face(const GamepadState *gp, FacialState *face);

/* Handle D-pad for fine parameter adjustment */
void gamepad_handle_dpad(const GamepadState *gp, FacialState *face, float delta);

#endif /* ESTOFACE_GAMEPAD_H */

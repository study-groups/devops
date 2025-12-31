/*
 * types.h - Common types and constants for Pulsar Engine
 */

#ifndef TYPES_H
#define TYPES_H

#include <stdint.h>
#include <stdio.h>
#include <sys/types.h>

/* Screen dimensions */
#define MAX_COLS 200
#define MAX_ROWS 100

/* Sprite system */
#define MAX_SPRITES 256

/* Entity type constants */
#define ENTITY_PULSAR     0
#define ENTITY_PLAYER     1
#define ENTITY_PROJECTILE 2
#define ENTITY_PARTICLE   3

/* Z layer constants (Zaxxon-style isometric) */
#define Z_GROUND  0
#define Z_LOW     1
#define Z_MID     2
#define Z_HIGH    3
#define Z_MAX     3

/* Sprite/Entity state */
typedef struct {
    int active;
    int id;

    /* 3D position (microgrid) */
    int mx, my;          /* X, Y microgrid position */
    int mz;              /* Z layer (0-3, discrete) */

    /* 3D velocity (microgrid units per second) */
    int vx, vy;          /* X, Y velocity */
    int vz;              /* Z velocity (for layer transitions) */

    /* Entity classification */
    int entity_type;     /* ENTITY_PULSAR, ENTITY_PLAYER, etc. */
    int owner;           /* player_id (0-3) for projectiles */
    int radius;          /* collision radius in microgrid units */

    /* Pulsar animation (visual) */
    int len0;            /* base arm length */
    int amp;             /* pulse amplitude */
    float freq;          /* pulse frequency Hz */
    float dtheta;        /* rotation rad/s */
    int valence;         /* color 0-5 */
    float theta;         /* current rotation */
    float phase;         /* current pulse phase */
} Sprite;

/* Gamepad input */
#define MAX_PLAYERS 4
#define AXES_MAX 6

/* Wire format (matches sender.c) */
struct gp_msg {
    uint32_t version;     /* = 1 */
    uint32_t player_id;
    uint32_t seq;
    uint32_t buttons;     /* bitfield */
    int16_t  axes[AXES_MAX]; /* [-32768,32767] : LX, LY, RX, RY, LT, RT */
    uint16_t n_axes;
    uint64_t t_mono_ns;   /* sender timestamp */
};

/* Internal normalized state */
typedef struct {
    float axes[AXES_MAX];      /* Normalized to [-1.0, 1.0] */
    uint32_t buttons;          /* Bitfield (same as wire format) */
    uint32_t last_seq;         /* Last received sequence number */
    uint64_t last_update_ns;   /* Last receive time */
} GamepadState;

/* Event log system */
#define MAX_EVENT_LOG 16
typedef struct {
    char type[16];        /* Event type: GAMEPAD, KEYBOARD, SYSTEM */
    uint32_t user_id;     /* Anonymous user ID (0-3 for players) */
    uint64_t timestamp_ns;
    char data[64];        /* Event-specific data */
} Event;

/* Pixeljam Universal ID (PUID) */
typedef struct {
    uint64_t puid;        /* Unique identifier */
    int32_t score;        /* Current score */
    int32_t tokens;       /* Game tokens */
    int32_t credits;      /* Account credits */
    char username[32];    /* Anonymous display name */
    uint64_t created_at;  /* Account creation timestamp */
} PUID_Account;

/* Process manager */
#define MAX_CHILD_PROCESSES 4
typedef struct {
    pid_t pid;
    char name[32];
    char cmd[256];
    int active;
} ChildProcess;

/* Keyboard simulation state */
typedef struct {
    int w, a, s, d;  /* WASD for left stick */
    int i, j, k, l;  /* IJKL for right stick */
    int space;       /* Space for button A */
} KeyboardState;

#endif /* TYPES_H */

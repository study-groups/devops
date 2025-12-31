/*
 * osc_send.h - OSC output to QUASAR for sound triggers
 */

#ifndef OSC_SEND_H
#define OSC_SEND_H

#include "collision.h"

/* QUASAR default port for OSC */
#define QUASAR_OSC_PORT 1986
#define QUASAR_OSC_HOST "127.0.0.1"

/* Local sound FIFO path */
#define SOUND_FIFO_PATH "/tmp/pulsar_sound.fifo"

/* OSC sender context */
typedef struct {
    int sock;                /* UDP socket */
    int fifo_fd;             /* Local FIFO file descriptor (-1 if not open) */
    int initialized;         /* 1 if socket is open */
    int max_mx, max_my;      /* Screen bounds for normalization */
} OSC_Sender;

/* Initialize OSC sender */
int osc_send_init(OSC_Sender *ctx, int max_mx, int max_my);

/* Send collision event as sound trigger */
void osc_send_collision(OSC_Sender *ctx, const CollisionEvent *event);

/* Send spawn event */
void osc_send_spawn(OSC_Sender *ctx, int id, int x, int y, int z);

/* Send death event */
void osc_send_death(OSC_Sender *ctx, int id, int x, int y, int z);

/* Cleanup OSC sender */
void osc_send_cleanup(OSC_Sender *ctx);

#endif /* OSC_SEND_H */

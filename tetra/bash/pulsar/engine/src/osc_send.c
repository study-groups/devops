/*
 * osc_send.c - OSC output to QUASAR for sound triggers
 *
 * Sends UDP messages to QUASAR (port 1986) for game sound events.
 * Uses simplified OSC format for efficiency.
 */

#include "osc_send.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <netinet/in.h>
#include <arpa/inet.h>

/* OSC message helpers */
static int osc_pad(int len) {
    return (4 - (len % 4)) % 4;
}

static int osc_write_string(char *buf, const char *str) {
    int len = strlen(str) + 1;  /* Include null terminator */
    int padded = len + osc_pad(len);
    memset(buf, 0, padded);
    strcpy(buf, str);
    return padded;
}

static int osc_write_float(char *buf, float val) {
    /* Network byte order (big-endian) */
    union { float f; uint32_t i; } u;
    u.f = val;
    uint32_t n = htonl(u.i);
    memcpy(buf, &n, 4);
    return 4;
}

static int osc_write_int32(char *buf, int32_t val) {
    uint32_t n = htonl((uint32_t)val);
    memcpy(buf, &n, 4);
    return 4;
}

/* Try to open local sound FIFO (non-blocking, silent fail) */
static int open_sound_fifo(void) {
    struct stat st;

    /* Check if FIFO exists */
    if (stat(SOUND_FIFO_PATH, &st) != 0) {
        return -1;  /* FIFO doesn't exist */
    }

    /* Verify it's a FIFO */
    if (!S_ISFIFO(st.st_mode)) {
        return -1;  /* Not a FIFO */
    }

    /* Open non-blocking so we don't hang if no reader */
    return open(SOUND_FIFO_PATH, O_WRONLY | O_NONBLOCK);
}

/* Initialize OSC sender */
int osc_send_init(OSC_Sender *ctx, int max_mx, int max_my) {
    memset(ctx, 0, sizeof(OSC_Sender));
    ctx->max_mx = max_mx > 0 ? max_mx : 320;  /* Default 80 cols * 4 */
    ctx->max_my = max_my > 0 ? max_my : 96;   /* Default 24 rows * 4 */
    ctx->fifo_fd = -1;

    ctx->sock = socket(AF_INET, SOCK_DGRAM, 0);
    if (ctx->sock < 0) {
        perror("osc_send: socket");
        return -1;
    }

    /* Try to open local FIFO (optional, for quasar_local.js) */
    ctx->fifo_fd = open_sound_fifo();

    ctx->initialized = 1;
    return 0;
}

/* Write event name to local FIFO (for quasar_local.js) */
static void fifo_write_event(OSC_Sender *ctx, const char *event) {
    if (ctx->fifo_fd < 0) {
        /* Try to open FIFO (may have been started after engine) */
        ctx->fifo_fd = open_sound_fifo();
        if (ctx->fifo_fd < 0) return;
    }

    char buf[64];
    int len = snprintf(buf, sizeof(buf), "%s\n", event);
    ssize_t written = write(ctx->fifo_fd, buf, len);

    /* If write fails (broken pipe), close and retry next time */
    if (written < 0) {
        close(ctx->fifo_fd);
        ctx->fifo_fd = -1;
    }
}

/* Send OSC message to QUASAR */
static void osc_send_msg(OSC_Sender *ctx, const char *buf, int len) {
    if (!ctx->initialized || ctx->sock < 0) return;

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_port = htons(QUASAR_OSC_PORT);
    inet_pton(AF_INET, QUASAR_OSC_HOST, &addr.sin_addr);

    sendto(ctx->sock, buf, len, 0, (struct sockaddr*)&addr, sizeof(addr));
}

/* Send collision event as sound trigger */
void osc_send_collision(OSC_Sender *ctx, const CollisionEvent *event) {
    if (!ctx->initialized || !event) return;

    /* Write to local FIFO */
    fifo_write_event(ctx, "collision");

    char buf[256];
    int pos = 0;

    /* OSC address: /sound/collision */
    pos += osc_write_string(buf + pos, "/sound/collision");

    /* Type tag: ,iiifff (id1, id2, z, x_norm, y_norm, energy) */
    pos += osc_write_string(buf + pos, ",iiifff");

    /* Arguments */
    pos += osc_write_int32(buf + pos, event->id1);
    pos += osc_write_int32(buf + pos, event->id2);
    pos += osc_write_int32(buf + pos, event->z);

    /* Normalize position to 0.0 - 1.0 */
    float x_norm = (float)event->x / (float)ctx->max_mx;
    float y_norm = (float)event->y / (float)ctx->max_my;
    if (x_norm < 0.0f) x_norm = 0.0f;
    if (x_norm > 1.0f) x_norm = 1.0f;
    if (y_norm < 0.0f) y_norm = 0.0f;
    if (y_norm > 1.0f) y_norm = 1.0f;

    pos += osc_write_float(buf + pos, x_norm);
    pos += osc_write_float(buf + pos, y_norm);
    pos += osc_write_float(buf + pos, event->energy);

    osc_send_msg(ctx, buf, pos);
}

/* Send spawn event */
void osc_send_spawn(OSC_Sender *ctx, int id, int x, int y, int z) {
    if (!ctx->initialized) return;

    /* Write to local FIFO */
    fifo_write_event(ctx, "spawn");

    char buf[256];
    int pos = 0;

    pos += osc_write_string(buf + pos, "/sound/spawn");
    pos += osc_write_string(buf + pos, ",iiff");
    pos += osc_write_int32(buf + pos, id);
    pos += osc_write_int32(buf + pos, z);
    pos += osc_write_float(buf + pos, (float)x / (float)ctx->max_mx);
    pos += osc_write_float(buf + pos, (float)y / (float)ctx->max_my);

    osc_send_msg(ctx, buf, pos);
}

/* Send death event */
void osc_send_death(OSC_Sender *ctx, int id, int x, int y, int z) {
    if (!ctx->initialized) return;

    /* Write to local FIFO */
    fifo_write_event(ctx, "death");

    char buf[256];
    int pos = 0;

    pos += osc_write_string(buf + pos, "/sound/death");
    pos += osc_write_string(buf + pos, ",iiff");
    pos += osc_write_int32(buf + pos, id);
    pos += osc_write_int32(buf + pos, z);
    pos += osc_write_float(buf + pos, (float)x / (float)ctx->max_mx);
    pos += osc_write_float(buf + pos, (float)y / (float)ctx->max_my);

    osc_send_msg(ctx, buf, pos);
}

/* Cleanup OSC sender */
void osc_send_cleanup(OSC_Sender *ctx) {
    if (ctx->sock >= 0) {
        close(ctx->sock);
        ctx->sock = -1;
    }
    if (ctx->fifo_fd >= 0) {
        close(ctx->fifo_fd);
        ctx->fifo_fd = -1;
    }
    ctx->initialized = 0;
}

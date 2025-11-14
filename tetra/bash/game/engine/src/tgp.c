/*
 * Tetra Game Protocol (TGP) v1.0
 * C Implementation
 */

#include "tgp.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <sys/time.h>
#include <fcntl.h>

/* ========================================================================
 * INTERNAL HELPERS
 * ======================================================================== */

/* Get current timestamp in milliseconds */
uint32_t tgp_timestamp_ms(void) {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return (uint32_t)(tv.tv_sec * 1000 + tv.tv_usec / 1000);
}

/* Create a Unix domain socket (SOCK_DGRAM) */
static int create_socket(void) {
    int sock = socket(AF_UNIX, SOCK_DGRAM, 0);
    if (sock < 0) {
        perror("socket");
        return -1;
    }

    /* Set non-blocking */
    int flags = fcntl(sock, F_GETFL, 0);
    fcntl(sock, F_SETFL, flags | O_NONBLOCK);

    /* Increase buffer sizes */
    int bufsize = 1024 * 1024;  /* 1MB */
    setsockopt(sock, SOL_SOCKET, SO_RCVBUF, &bufsize, sizeof(bufsize));
    setsockopt(sock, SOL_SOCKET, SO_SNDBUF, &bufsize, sizeof(bufsize));

    return sock;
}

/* Bind socket to path */
static int bind_socket(int sock, const char *path) {
    struct sockaddr_un addr;
    memset(&addr, 0, sizeof(addr));
    addr.sun_family = AF_UNIX;
    strncpy(addr.sun_path, path, sizeof(addr.sun_path) - 1);

    /* Remove old socket file if exists */
    unlink(path);

    if (bind(sock, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        perror("bind");
        return -1;
    }

    return 0;
}

/* Connect socket to path */
static int connect_socket(int sock, const char *path) {
    struct sockaddr_un addr;
    memset(&addr, 0, sizeof(addr));
    addr.sun_family = AF_UNIX;
    strncpy(addr.sun_path, path, sizeof(addr.sun_path) - 1);

    if (connect(sock, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        perror("connect");
        return -1;
    }

    return 0;
}

/* ========================================================================
 * INITIALIZATION
 * ======================================================================== */

int tgp_init(TGP_Context *ctx, const char *session_name) {
    memset(ctx, 0, sizeof(TGP_Context));

    strncpy(ctx->session, session_name, sizeof(ctx->session) - 1);

    /* Build socket paths */
    snprintf(ctx->cmd_path, sizeof(ctx->cmd_path), "/tmp/tgp_%s_cmd.sock", session_name);
    snprintf(ctx->resp_path, sizeof(ctx->resp_path), "/tmp/tgp_%s_resp.sock", session_name);
    snprintf(ctx->frame_path, sizeof(ctx->frame_path), "/tmp/tgp_%s_frame.sock", session_name);
    snprintf(ctx->event_path, sizeof(ctx->event_path), "/tmp/tgp_%s_event.sock", session_name);

    /* Create and bind sockets */
    ctx->cmd_sock = create_socket();
    if (ctx->cmd_sock < 0 || bind_socket(ctx->cmd_sock, ctx->cmd_path) < 0) {
        tgp_cleanup(ctx);
        return -1;
    }

    ctx->resp_sock = create_socket();
    if (ctx->resp_sock < 0 || bind_socket(ctx->resp_sock, ctx->resp_path) < 0) {
        tgp_cleanup(ctx);
        return -1;
    }

    ctx->frame_sock = create_socket();
    if (ctx->frame_sock < 0 || bind_socket(ctx->frame_sock, ctx->frame_path) < 0) {
        tgp_cleanup(ctx);
        return -1;
    }

    ctx->event_sock = create_socket();
    if (ctx->event_sock < 0 || bind_socket(ctx->event_sock, ctx->event_path) < 0) {
        tgp_cleanup(ctx);
        return -1;
    }

    ctx->seq = 0;
    ctx->frame_num = 0;

    return 0;
}

int tgp_init_client(TGP_Context *ctx, const char *session_name) {
    memset(ctx, 0, sizeof(TGP_Context));

    strncpy(ctx->session, session_name, sizeof(ctx->session) - 1);

    /* Build socket paths */
    snprintf(ctx->cmd_path, sizeof(ctx->cmd_path), "/tmp/tgp_%s_cmd.sock", session_name);
    snprintf(ctx->resp_path, sizeof(ctx->resp_path), "/tmp/tgp_%s_resp.sock", session_name);
    snprintf(ctx->frame_path, sizeof(ctx->frame_path), "/tmp/tgp_%s_frame.sock", session_name);
    snprintf(ctx->event_path, sizeof(ctx->event_path), "/tmp/tgp_%s_event.sock", session_name);

    /* Create sockets and connect to server */
    ctx->cmd_sock = create_socket();
    if (ctx->cmd_sock < 0 || connect_socket(ctx->cmd_sock, ctx->cmd_path) < 0) {
        tgp_cleanup(ctx);
        return -1;
    }

    ctx->resp_sock = create_socket();
    if (ctx->resp_sock < 0 || connect_socket(ctx->resp_sock, ctx->resp_path) < 0) {
        tgp_cleanup(ctx);
        return -1;
    }

    ctx->frame_sock = create_socket();
    if (ctx->frame_sock < 0 || connect_socket(ctx->frame_sock, ctx->frame_path) < 0) {
        tgp_cleanup(ctx);
        return -1;
    }

    ctx->event_sock = create_socket();
    if (ctx->event_sock < 0 || connect_socket(ctx->event_sock, ctx->event_path) < 0) {
        tgp_cleanup(ctx);
        return -1;
    }

    ctx->seq = 0;

    return 0;
}

void tgp_cleanup(TGP_Context *ctx) {
    if (ctx->cmd_sock >= 0) {
        close(ctx->cmd_sock);
        unlink(ctx->cmd_path);
    }
    if (ctx->resp_sock >= 0) {
        close(ctx->resp_sock);
        unlink(ctx->resp_path);
    }
    if (ctx->frame_sock >= 0) {
        close(ctx->frame_sock);
        unlink(ctx->frame_path);
    }
    if (ctx->event_sock >= 0) {
        close(ctx->event_sock);
        unlink(ctx->event_path);
    }

    memset(ctx, 0, sizeof(TGP_Context));
}

/* ========================================================================
 * SERVER (ENGINE) API
 * ======================================================================== */

int tgp_recv_command(TGP_Context *ctx, TGP_Header *hdr, void *payload, size_t max_len) {
    uint8_t buffer[TGP_MAX_MESSAGE_SIZE];

    ssize_t n = recv(ctx->cmd_sock, buffer, sizeof(buffer), 0);
    if (n < 0) {
        if (errno == EAGAIN || errno == EWOULDBLOCK) {
            return 0;  /* No data */
        }
        return -1;
    }

    if ((size_t)n < TGP_HEADER_SIZE) {
        return -1;  /* Message too small */
    }

    /* Parse header */
    memcpy(hdr, buffer, TGP_HEADER_SIZE);

    /* Copy payload */
    size_t payload_len = hdr->len;
    if (payload_len > max_len) {
        payload_len = max_len;
    }
    if (payload_len > 0 && n >= TGP_HEADER_SIZE + payload_len) {
        memcpy(payload, buffer + TGP_HEADER_SIZE, payload_len);
    }

    return (int)n;
}

int tgp_send_response(TGP_Context *ctx, uint8_t type, uint16_t cmd_seq, const void *payload, size_t len) {
    uint8_t buffer[TGP_MAX_MESSAGE_SIZE];

    if (TGP_HEADER_SIZE + len > sizeof(buffer)) {
        return -1;
    }

    TGP_Header hdr;
    hdr.type = type;
    hdr.flags = TGP_FLAG_NONE;
    hdr.seq = cmd_seq;
    hdr.len = (uint32_t)len;

    memcpy(buffer, &hdr, TGP_HEADER_SIZE);
    if (len > 0) {
        memcpy(buffer + TGP_HEADER_SIZE, payload, len);
    }

    ssize_t n = send(ctx->resp_sock, buffer, TGP_HEADER_SIZE + len, 0);
    return (int)n;
}

int tgp_send_ok(TGP_Context *ctx, uint16_t cmd_seq) {
    TGP_OK ok;
    ok.cmd_seq = cmd_seq;
    ok.reserved = 0;
    return tgp_send_response(ctx, TGP_RESP_OK, cmd_seq, &ok, sizeof(ok));
}

int tgp_send_error(TGP_Context *ctx, uint16_t cmd_seq, uint8_t error_code, const char *message) {
    TGP_Error err;
    err.cmd_seq = cmd_seq;
    err.error_code = error_code;
    err.reserved = 0;
    strncpy(err.message, message, sizeof(err.message) - 1);
    err.message[sizeof(err.message) - 1] = '\0';
    return tgp_send_response(ctx, TGP_RESP_ERROR, cmd_seq, &err, sizeof(err));
}

int tgp_send_id(TGP_Context *ctx, uint16_t cmd_seq, uint32_t entity_id) {
    TGP_ID id;
    id.cmd_seq = cmd_seq;
    id.reserved = 0;
    id.entity_id = entity_id;
    return tgp_send_response(ctx, TGP_RESP_ID, cmd_seq, &id, sizeof(id));
}

int tgp_send_frame(TGP_Context *ctx, const void *frame_data, size_t len, uint8_t format) {
    uint8_t buffer[TGP_MAX_MESSAGE_SIZE];

    TGP_Frame_Full frame;
    frame.frame_number = ctx->frame_num++;
    frame.timestamp_ms = tgp_timestamp_ms();
    frame.width = 0;   /* Set by caller if needed */
    frame.height = 0;
    frame.format = format;
    frame.flags = 0;
    frame.reserved = 0;

    size_t total = TGP_HEADER_SIZE + sizeof(frame) + len;
    if (total > sizeof(buffer)) {
        return -1;
    }

    TGP_Header hdr;
    hdr.type = TGP_FRAME_FULL;
    hdr.flags = TGP_FLAG_NONE;
    hdr.seq = ctx->seq++;
    hdr.len = sizeof(frame) + len;

    memcpy(buffer, &hdr, TGP_HEADER_SIZE);
    memcpy(buffer + TGP_HEADER_SIZE, &frame, sizeof(frame));
    if (len > 0) {
        memcpy(buffer + TGP_HEADER_SIZE + sizeof(frame), frame_data, len);
    }

    ssize_t n = send(ctx->frame_sock, buffer, total, 0);
    return (int)n;
}

int tgp_send_event(TGP_Context *ctx, uint8_t type, const void *payload, size_t len) {
    uint8_t buffer[TGP_MAX_MESSAGE_SIZE];

    if (TGP_HEADER_SIZE + len > sizeof(buffer)) {
        return -1;
    }

    TGP_Header hdr;
    hdr.type = type;
    hdr.flags = TGP_FLAG_NONE;
    hdr.seq = ctx->seq++;
    hdr.len = len;

    memcpy(buffer, &hdr, TGP_HEADER_SIZE);
    if (len > 0) {
        memcpy(buffer + TGP_HEADER_SIZE, payload, len);
    }

    ssize_t n = send(ctx->event_sock, buffer, TGP_HEADER_SIZE + len, 0);
    return (int)n;
}

int tgp_send_log(TGP_Context *ctx, uint8_t level, const char *message) {
    TGP_Event_Log log;
    log.timestamp_ms = tgp_timestamp_ms();
    log.level = level;
    log.module = 0;
    log.reserved = 0;
    strncpy(log.message, message, sizeof(log.message) - 1);
    log.message[sizeof(log.message) - 1] = '\0';
    return tgp_send_event(ctx, TGP_EVENT_LOG, &log, sizeof(log));
}

/* ========================================================================
 * CLIENT API
 * ======================================================================== */

int tgp_send_command(TGP_Context *ctx, uint8_t type, const void *payload, size_t len) {
    uint8_t buffer[TGP_MAX_MESSAGE_SIZE];

    if (TGP_HEADER_SIZE + len > sizeof(buffer)) {
        return -1;
    }

    TGP_Header hdr;
    hdr.type = type;
    hdr.flags = TGP_FLAG_NONE;
    hdr.seq = ctx->seq++;
    hdr.len = len;

    memcpy(buffer, &hdr, TGP_HEADER_SIZE);
    if (len > 0) {
        memcpy(buffer + TGP_HEADER_SIZE, payload, len);
    }

    ssize_t n = send(ctx->cmd_sock, buffer, TGP_HEADER_SIZE + len, 0);
    return (int)n;
}

int tgp_recv_response(TGP_Context *ctx, TGP_Header *hdr, void *payload, size_t max_len, int timeout_ms) {
    uint8_t buffer[TGP_MAX_MESSAGE_SIZE];

    /* Set timeout if requested */
    if (timeout_ms > 0) {
        struct timeval tv;
        tv.tv_sec = timeout_ms / 1000;
        tv.tv_usec = (timeout_ms % 1000) * 1000;
        setsockopt(ctx->resp_sock, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));
    }

    ssize_t n = recv(ctx->resp_sock, buffer, sizeof(buffer), 0);
    if (n < 0) {
        if (errno == EAGAIN || errno == EWOULDBLOCK) {
            return 0;  /* Timeout */
        }
        return -1;
    }

    if ((size_t)n < TGP_HEADER_SIZE) {
        return -1;
    }

    /* Parse header */
    memcpy(hdr, buffer, TGP_HEADER_SIZE);

    /* Copy payload */
    size_t payload_len = hdr->len;
    if (payload_len > max_len) {
        payload_len = max_len;
    }
    if (payload_len > 0 && n >= TGP_HEADER_SIZE + payload_len) {
        memcpy(payload, buffer + TGP_HEADER_SIZE, payload_len);
    }

    return (int)n;
}

int tgp_recv_frame(TGP_Context *ctx, TGP_Header *hdr, void *frame_data, size_t max_len) {
    uint8_t buffer[TGP_MAX_MESSAGE_SIZE];

    ssize_t n = recv(ctx->frame_sock, buffer, sizeof(buffer), 0);
    if (n < 0) {
        if (errno == EAGAIN || errno == EWOULDBLOCK) {
            return 0;
        }
        return -1;
    }

    if ((size_t)n < TGP_HEADER_SIZE) {
        return -1;
    }

    memcpy(hdr, buffer, TGP_HEADER_SIZE);

    size_t payload_len = hdr->len;
    if (payload_len > max_len) {
        payload_len = max_len;
    }
    if (payload_len > 0 && n >= TGP_HEADER_SIZE + payload_len) {
        memcpy(frame_data, buffer + TGP_HEADER_SIZE, payload_len);
    }

    return (int)n;
}

int tgp_recv_event(TGP_Context *ctx, TGP_Header *hdr, void *payload, size_t max_len) {
    uint8_t buffer[TGP_MAX_MESSAGE_SIZE];

    ssize_t n = recv(ctx->event_sock, buffer, sizeof(buffer), 0);
    if (n < 0) {
        if (errno == EAGAIN || errno == EWOULDBLOCK) {
            return 0;
        }
        return -1;
    }

    if ((size_t)n < TGP_HEADER_SIZE) {
        return -1;
    }

    memcpy(hdr, buffer, TGP_HEADER_SIZE);

    size_t payload_len = hdr->len;
    if (payload_len > max_len) {
        payload_len = max_len;
    }
    if (payload_len > 0 && n >= TGP_HEADER_SIZE + payload_len) {
        memcpy(payload, buffer + TGP_HEADER_SIZE, payload_len);
    }

    return (int)n;
}

/* ========================================================================
 * UTILITY
 * ======================================================================== */

const char* tgp_type_str(uint8_t type) {
    switch (type) {
        case TGP_CMD_INIT:   return "CMD_INIT";
        case TGP_CMD_SPAWN:  return "CMD_SPAWN";
        case TGP_CMD_SET:    return "CMD_SET";
        case TGP_CMD_KILL:   return "CMD_KILL";
        case TGP_CMD_QUERY:  return "CMD_QUERY";
        case TGP_CMD_RUN:    return "CMD_RUN";
        case TGP_CMD_STOP:   return "CMD_STOP";
        case TGP_CMD_QUIT:   return "CMD_QUIT";
        case TGP_RESP_OK:    return "RESP_OK";
        case TGP_RESP_ERROR: return "RESP_ERROR";
        case TGP_RESP_ID:    return "RESP_ID";
        case TGP_RESP_VALUE: return "RESP_VALUE";
        case TGP_FRAME_FULL: return "FRAME_FULL";
        case TGP_FRAME_META: return "FRAME_META";
        case TGP_EVENT_LOG:  return "EVENT_LOG";
        default:             return "UNKNOWN";
    }
}

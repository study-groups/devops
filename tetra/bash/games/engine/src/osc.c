/*
 * Minimal OSC (Open Sound Control) Parser
 */

#include "osc.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>
#include <arpa/inet.h>

/* OSC strings are null-terminated and padded to 4-byte boundary */
static int osc_string_size(const char *str) {
    int len = strlen(str) + 1;  /* Include null terminator */
    return (len + 3) & ~3;      /* Round up to multiple of 4 */
}

/* Read big-endian int32 */
static int32_t read_int32(const uint8_t *p) {
    return (int32_t)((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]);
}

/* Read big-endian float32 */
static float read_float32(const uint8_t *p) {
    union {
        uint32_t i;
        float f;
    } u;
    u.i = (p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3];
    return u.f;
}

/* Initialize OSC UDP receiver */
int osc_init_receiver(OSC_Receiver *osc, const char *multicast_addr, int port) {
    memset(osc, 0, sizeof(*osc));

    /* Create UDP socket */
    osc->sock = socket(AF_INET, SOCK_DGRAM, 0);
    if (osc->sock < 0) {
        perror("socket");
        return -1;
    }

    /* Set non-blocking */
    int flags = fcntl(osc->sock, F_GETFL, 0);
    fcntl(osc->sock, F_SETFL, flags | O_NONBLOCK);

    /* Allow address reuse (critical for multicast) */
    int reuse = 1;
    if (setsockopt(osc->sock, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse)) < 0) {
        perror("setsockopt SO_REUSEADDR");
    }

#ifdef SO_REUSEPORT
    /* Allow multiple processes to bind to same port (macOS/BSD) */
    if (setsockopt(osc->sock, SOL_SOCKET, SO_REUSEPORT, &reuse, sizeof(reuse)) < 0) {
        perror("setsockopt SO_REUSEPORT");
        /* Not fatal - continue anyway */
    }
#endif

    /* Bind to multicast port on ANY address */
    struct sockaddr_in bind_addr;
    memset(&bind_addr, 0, sizeof(bind_addr));
    bind_addr.sin_family = AF_INET;
    bind_addr.sin_port = htons(port);
    bind_addr.sin_addr.s_addr = INADDR_ANY;

    if (bind(osc->sock, (struct sockaddr*)&bind_addr, sizeof(bind_addr)) < 0) {
        perror("bind");
        fprintf(stderr, "Failed to bind to port %d. Is another process using it?\n", port);
        fprintf(stderr, "Try: lsof -i UDP:%d\n", port);
        close(osc->sock);
        return -1;
    }

    /* Join multicast group */
    struct ip_mreq mreq;
    mreq.imr_multiaddr.s_addr = inet_addr(multicast_addr);
    mreq.imr_interface.s_addr = INADDR_ANY;

    if (setsockopt(osc->sock, IPPROTO_IP, IP_ADD_MEMBERSHIP, &mreq, sizeof(mreq)) < 0) {
        perror("setsockopt IP_ADD_MEMBERSHIP");
        close(osc->sock);
        return -1;
    }

    /* Save address for reference */
    osc->addr = bind_addr;

    return 0;
}

/* Close OSC receiver */
void osc_close_receiver(OSC_Receiver *osc) {
    if (osc->sock >= 0) {
        close(osc->sock);
        osc->sock = -1;
    }
}

/* Parse OSC message from buffer */
int osc_parse_message(const uint8_t *buffer, size_t len, OSC_Message *msg) {
    if (len < 4) return -1;

    /* Reset message */
    memset(msg, 0, sizeof(*msg));

    /* Read address pattern */
    msg->address = (const char*)buffer;
    int addr_size = osc_string_size(msg->address);

    if (addr_size >= len) return -1;

    /* Read type tag string */
    const char *typetags = (const char*)(buffer + addr_size);

    /* Type tags must start with ',' */
    if (typetags[0] != ',') {
        /* No arguments */
        msg->argc = 0;
        return 0;
    }

    int typetag_size = osc_string_size(typetags);
    int arg_offset = addr_size + typetag_size;

    /* Parse arguments */
    msg->argc = 0;
    for (int i = 1; typetags[i] != '\0' && msg->argc < OSC_MAX_ARGS; i++) {
        if (arg_offset >= len) break;

        OSC_Arg *arg = &msg->args[msg->argc];
        arg->type = typetags[i];

        switch (typetags[i]) {
            case OSC_TYPE_INT32:
                arg->i = read_int32(buffer + arg_offset);
                arg_offset += 4;
                msg->argc++;
                break;

            case OSC_TYPE_FLOAT:
                arg->f = read_float32(buffer + arg_offset);
                arg_offset += 4;
                msg->argc++;
                break;

            case OSC_TYPE_STRING:
                arg->s = (const char*)(buffer + arg_offset);
                arg_offset += osc_string_size(arg->s);
                msg->argc++;
                break;

            default:
                /* Unknown type - skip */
                break;
        }
    }

    return 0;
}

/* Receive and parse OSC message (non-blocking) */
int osc_recv_message(OSC_Receiver *osc, OSC_Message *msg) {
    ssize_t n = recvfrom(osc->sock, osc->recv_buffer, sizeof(osc->recv_buffer), 0, NULL, NULL);

    if (n < 0) {
        if (errno == EAGAIN || errno == EWOULDBLOCK) {
            return 0;  /* No data */
        }
        return -1;  /* Error */
    }

    if (n == 0) {
        return 0;  /* No data */
    }

    /* Parse the message */
    if (osc_parse_message((const uint8_t*)osc->recv_buffer, n, msg) < 0) {
        return -1;  /* Parse error */
    }

    return 1;  /* Message received */
}

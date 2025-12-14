/*
 * Minimal OSC (Open Sound Control) Parser
 * Just enough to receive /midi/mapped messages from midi.js
 */

#ifndef OSC_H
#define OSC_H

#include <stdint.h>
#include <sys/socket.h>
#include <netinet/in.h>

/* Max OSC message size */
#define OSC_MAX_MSG_SIZE 2048
#define OSC_MAX_ARGS 16

/* OSC type tags */
#define OSC_TYPE_INT32  'i'
#define OSC_TYPE_FLOAT  'f'
#define OSC_TYPE_STRING 's'

/* OSC argument */
typedef struct {
    char type;
    union {
        int32_t i;
        float f;
        const char *s;
    };
} OSC_Arg;

/* Parsed OSC message */
typedef struct {
    const char *address;   /* OSC address pattern */
    int argc;              /* Number of arguments */
    OSC_Arg args[OSC_MAX_ARGS];
} OSC_Message;

/* OSC UDP receiver context */
typedef struct {
    int sock;
    struct sockaddr_in addr;
    char recv_buffer[OSC_MAX_MSG_SIZE];
} OSC_Receiver;

/* Initialize OSC UDP receiver on multicast group
 * Returns: 0 on success, -1 on error
 */
int osc_init_receiver(OSC_Receiver *osc, const char *multicast_addr, int port);

/* Close OSC receiver */
void osc_close_receiver(OSC_Receiver *osc);

/* Receive and parse OSC message (non-blocking)
 * Returns: 1 if message received, 0 if no data, -1 on error
 */
int osc_recv_message(OSC_Receiver *osc, OSC_Message *msg);

/* Parse OSC message from buffer
 * Returns: 0 on success, -1 on error
 */
int osc_parse_message(const uint8_t *buffer, size_t len, OSC_Message *msg);

#endif /* OSC_H */

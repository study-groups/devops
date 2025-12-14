/*
 * Tetra Game Protocol (TGP) v1.0
 * C Implementation - Header
 *
 * High-performance binary datagram protocol for game engine IPC
 */

#ifndef TGP_H
#define TGP_H

#include <stdint.h>
#include <stddef.h>

/* ========================================================================
 * CONSTANTS
 * ======================================================================== */

#define TGP_MAX_MESSAGE_SIZE  65535
#define TGP_HEADER_SIZE       8
#define TGP_MAX_PAYLOAD_SIZE  (TGP_MAX_MESSAGE_SIZE - TGP_HEADER_SIZE)

/* Message Types - Commands (0x01-0x0F) */
#define TGP_CMD_INIT        0x01
#define TGP_CMD_SPAWN       0x02
#define TGP_CMD_SET         0x03
#define TGP_CMD_KILL        0x04
#define TGP_CMD_QUERY       0x05
#define TGP_CMD_RUN         0x06
#define TGP_CMD_STOP        0x07
#define TGP_CMD_RESET       0x08
#define TGP_CMD_QUIT        0x09

/* Message Types - Responses (0x10-0x1F) */
#define TGP_RESP_OK         0x10
#define TGP_RESP_ERROR      0x11
#define TGP_RESP_ID         0x12
#define TGP_RESP_VALUE      0x13

/* Message Types - Frames (0x20-0x2F) */
#define TGP_FRAME_FULL      0x20
#define TGP_FRAME_DIFF      0x21
#define TGP_FRAME_META      0x22

/* Message Types - Events (0x30-0x3F) */
#define TGP_EVENT_COLLISION 0x30
#define TGP_EVENT_SCORE     0x31
#define TGP_EVENT_SPAWN     0x32
#define TGP_EVENT_DEATH     0x33
#define TGP_EVENT_STATE     0x34
#define TGP_EVENT_LOG       0x35

/* Message Flags */
#define TGP_FLAG_NONE       0x00
#define TGP_FLAG_ACK        0x01
#define TGP_FLAG_URGENT     0x02
#define TGP_FLAG_COMPRESSED 0x04
#define TGP_FLAG_DEBUG      0x80

/* Error Codes */
#define TGP_ERR_UNKNOWN     0x00
#define TGP_ERR_INVALID_CMD 0x01
#define TGP_ERR_INVALID_ID  0x02
#define TGP_ERR_LIMIT       0x03
#define TGP_ERR_STATE       0x04
#define TGP_ERR_PARAM       0x05

/* Property IDs */
#define TGP_PROP_X          0x01
#define TGP_PROP_Y          0x02
#define TGP_PROP_VX         0x03
#define TGP_PROP_VY         0x04
#define TGP_PROP_ROTATION   0x05
#define TGP_PROP_SCALE      0x06
#define TGP_PROP_COLOR      0x07
#define TGP_PROP_VISIBLE    0x08

/* Engine States */
#define TGP_STATE_INIT      0x00
#define TGP_STATE_RUNNING   0x01
#define TGP_STATE_PAUSED    0x02
#define TGP_STATE_STOPPED   0x03

/* Frame Formats */
#define TGP_FMT_ANSI        0x00
#define TGP_FMT_RGB24       0x01
#define TGP_FMT_INDEXED     0x02

/* ========================================================================
 * DATA STRUCTURES
 * ======================================================================== */

/* Message Header (8 bytes) */
typedef struct {
    uint8_t  type;      /* Message type */
    uint8_t  flags;     /* Message flags */
    uint16_t seq;       /* Sequence number */
    uint32_t len;       /* Payload length */
} __attribute__((packed)) TGP_Header;

/* Command Payloads */

typedef struct {
    uint16_t cols;
    uint16_t rows;
    uint8_t  fps;
    uint8_t  flags;
} __attribute__((packed)) TGP_Init;

typedef struct {
    uint8_t  entity_type;
    uint8_t  valence;
    uint16_t reserved;
    int32_t  x, y;
    int32_t  param1;
    int32_t  param2;
    float    fparam1;
    float    fparam2;
} __attribute__((packed)) TGP_Spawn;

typedef struct {
    uint32_t entity_id;
    uint8_t  property;
    uint8_t  value_type;
    uint16_t reserved;
    union {
        int32_t  i_value;
        float    f_value;
        char     s_value[56];
    };
} __attribute__((packed)) TGP_Set;

typedef struct {
    uint32_t entity_id;
} __attribute__((packed)) TGP_Kill;

typedef struct {
    uint32_t entity_id;
    uint8_t  property;
    uint8_t  reserved[3];
} __attribute__((packed)) TGP_Query;

typedef struct {
    uint8_t fps;
    uint8_t flags;
    uint16_t reserved;
} __attribute__((packed)) TGP_Run;

/* Response Payloads */

typedef struct {
    uint16_t cmd_seq;
    uint16_t reserved;
} __attribute__((packed)) TGP_OK;

typedef struct {
    uint16_t cmd_seq;
    uint8_t  error_code;
    uint8_t  reserved;
    char     message[60];
} __attribute__((packed)) TGP_Error;

typedef struct {
    uint16_t cmd_seq;
    uint16_t reserved;
    uint32_t entity_id;
} __attribute__((packed)) TGP_ID;

typedef struct {
    uint16_t cmd_seq;
    uint8_t  value_type;
    uint8_t  reserved;
    union {
        int32_t  i_value;
        float    f_value;
        char     s_value[60];
    };
} __attribute__((packed)) TGP_Value;

/* Frame Payloads */

typedef struct {
    uint32_t frame_number;
    uint32_t timestamp_ms;
    uint16_t width;
    uint16_t height;
    uint8_t  format;
    uint8_t  flags;
    uint16_t reserved;
} __attribute__((packed)) TGP_Frame_Full;

typedef struct {
    uint32_t frame_number;
    uint32_t timestamp_ms;
    uint16_t entity_count;
    uint16_t fps;
    float    cpu_usage;
    uint32_t reserved;
} __attribute__((packed)) TGP_Frame_Meta;

/* Event Payloads */

typedef struct {
    uint32_t timestamp_ms;
    uint8_t  level;
    uint8_t  module;
    uint16_t reserved;
    char     message[120];
} __attribute__((packed)) TGP_Event_Log;

typedef struct {
    uint32_t timestamp_ms;
    uint8_t  old_state;
    uint8_t  new_state;
    uint16_t reserved;
} __attribute__((packed)) TGP_Event_State;

/* TGP Context */
typedef struct {
    int cmd_sock;       /* Command socket (server receives) */
    int resp_sock;      /* Response socket (server sends) */
    int frame_sock;     /* Frame socket (server sends) */
    int event_sock;     /* Event socket (server sends) */

    char session[64];   /* Session name */
    char cmd_path[256];
    char resp_path[256];
    char frame_path[256];
    char event_path[256];

    uint16_t seq;       /* Sequence counter */
    uint32_t frame_num; /* Frame counter */
} TGP_Context;

/* ========================================================================
 * API FUNCTIONS
 * ======================================================================== */

/* Initialize TGP context (engine/server side)
 * session_name: unique identifier (usually PID)
 * Returns: 0 on success, -1 on error
 */
int tgp_init(TGP_Context *ctx, const char *session_name);

/* Initialize TGP context (client side)
 * session_name: session to connect to
 * Returns: 0 on success, -1 on error
 */
int tgp_init_client(TGP_Context *ctx, const char *session_name);

/* Cleanup TGP context and remove socket files */
void tgp_cleanup(TGP_Context *ctx);

/* -------- Server (Engine) API -------- */

/* Receive command (non-blocking)
 * Returns: bytes received, 0 if no data, -1 on error
 */
int tgp_recv_command(TGP_Context *ctx, TGP_Header *hdr, void *payload, size_t max_len);

/* Send response */
int tgp_send_response(TGP_Context *ctx, uint8_t type, uint16_t cmd_seq, const void *payload, size_t len);

/* Send OK response */
int tgp_send_ok(TGP_Context *ctx, uint16_t cmd_seq);

/* Send error response */
int tgp_send_error(TGP_Context *ctx, uint16_t cmd_seq, uint8_t error_code, const char *message);

/* Send ID response */
int tgp_send_id(TGP_Context *ctx, uint16_t cmd_seq, uint32_t entity_id);

/* Send frame */
int tgp_send_frame(TGP_Context *ctx, const void *frame_data, size_t len, uint8_t format);

/* Send event */
int tgp_send_event(TGP_Context *ctx, uint8_t type, const void *payload, size_t len);

/* Send log event */
int tgp_send_log(TGP_Context *ctx, uint8_t level, const char *message);

/* -------- Client API -------- */

/* Send command */
int tgp_send_command(TGP_Context *ctx, uint8_t type, const void *payload, size_t len);

/* Receive response (blocking with timeout in ms, 0 = non-blocking) */
int tgp_recv_response(TGP_Context *ctx, TGP_Header *hdr, void *payload, size_t max_len, int timeout_ms);

/* Receive frame (non-blocking) */
int tgp_recv_frame(TGP_Context *ctx, TGP_Header *hdr, void *frame_data, size_t max_len);

/* Receive event (non-blocking) */
int tgp_recv_event(TGP_Context *ctx, TGP_Header *hdr, void *payload, size_t max_len);

/* -------- Utility Functions -------- */

/* Get current timestamp in milliseconds */
uint32_t tgp_timestamp_ms(void);

/* Message type to string (for debugging) */
const char* tgp_type_str(uint8_t type);

#endif /* TGP_H */

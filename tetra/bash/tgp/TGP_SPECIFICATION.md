# Tetra Game Protocol (TGP) v1.0

**Status:** Draft
**Author:** Tetra Team
**Date:** 2025-11-05

---

## 1. Overview

The Tetra Game Protocol (TGP) is a high-performance, binary datagram protocol designed for inter-process communication between game engines (C/C++) and control interfaces (Bash/Shell). It provides a clean separation of concerns with multiple communication channels for commands, responses, frames, and events.

### 1.1 Design Goals

- **Non-blocking**: All operations use datagram sockets (never blocks)
- **Fast**: Binary protocol with minimal parsing overhead
- **Decoupled**: Separate channels for different data types
- **Extensible**: Easy to add new message types
- **Simple**: Minimal dependencies, works with Unix domain sockets
- **Debuggable**: Optional text-based debug mode
- **Multi-client**: Multiple processes can connect to same engine

### 1.2 Use Cases

- Real-time game engines with REPL interfaces
- Live parameter tuning while game runs
- Multi-process game architectures
- Networked multiplayer games (future: UDP transport)
- Game state inspection and debugging
- Automated testing and benchmarking

---

## 2. Architecture

### 2.1 Transport Layer

TGP uses **Unix Domain Sockets** with `SOCK_DGRAM` (datagram mode).

Each TGP session uses **four socket files**:

```
/tmp/tgp_<session>/
├── cmd.sock      # Client → Engine (commands)
├── resp.sock     # Engine → Client (responses)
├── frame.sock    # Engine → Client (rendered frames)
└── event.sock    # Engine → Client (game events)
```

**Session naming:** `<session>` is typically the process ID or a unique identifier.

### 2.2 Communication Channels

| Channel | Direction | Purpose | Rate |
|---------|-----------|---------|------|
| Command | Client → Engine | Game commands (spawn, set, kill, etc.) | On-demand |
| Response | Engine → Client | Command acknowledgments and results | Per command |
| Frame | Engine → Client | Rendered frame data (optional) | 30-60 Hz |
| Event | Engine → Client | Game events (collisions, scoring, etc.) | Variable |

### 2.3 Message Flow

```
Client (Bash)                 Engine (C)
─────────────                 ──────────

CMD: SPAWN entity ──────────→ [Process]
                              ↓
RESP: OK id=123 ←──────────── [Respond]
                              ↓
                              [Render loop]
                              ↓
FRAME: <binary data> ←─────── [Every frame]
                              ↓
EVENT: collision ←─────────── [On event]
```

---

## 3. Message Format

### 3.1 Message Structure

All messages start with an 8-byte header:

```c
struct TGP_Header {
    uint8_t  type;      // Message type (see section 3.2)
    uint8_t  flags;     // Message flags (see section 3.3)
    uint16_t seq;       // Sequence number (for ordering)
    uint32_t len;       // Payload length in bytes
};
// Followed by payload data (len bytes)
```

**Total message size:** `8 + len` bytes
**Maximum message size:** 65535 bytes (standard UDP limit)

### 3.2 Message Types

```c
// Commands (0x01-0x0F)
#define TGP_CMD_INIT        0x01  // Initialize engine
#define TGP_CMD_SPAWN       0x02  // Spawn entity
#define TGP_CMD_SET         0x03  // Set entity property
#define TGP_CMD_KILL        0x04  // Kill entity
#define TGP_CMD_QUERY       0x05  // Query entity state
#define TGP_CMD_RUN         0x06  // Start/resume engine
#define TGP_CMD_STOP        0x07  // Stop/pause engine
#define TGP_CMD_RESET       0x08  // Reset engine state
#define TGP_CMD_QUIT        0x09  // Shutdown engine

// Responses (0x10-0x1F)
#define TGP_RESP_OK         0x10  // Success
#define TGP_RESP_ERROR      0x11  // Error
#define TGP_RESP_ID         0x12  // Entity ID response
#define TGP_RESP_VALUE      0x13  // Query result

// Frames (0x20-0x2F)
#define TGP_FRAME_FULL      0x20  // Full frame data
#define TGP_FRAME_DIFF      0x21  // Differential update
#define TGP_FRAME_META      0x22  // Frame metadata only

// Events (0x30-0x3F)
#define TGP_EVENT_COLLISION 0x30  // Collision event
#define TGP_EVENT_SCORE     0x31  // Score change
#define TGP_EVENT_SPAWN     0x32  // Entity spawned
#define TGP_EVENT_DEATH     0x33  // Entity destroyed
#define TGP_EVENT_STATE     0x34  // State change
#define TGP_EVENT_LOG       0x35  // Log message

// Reserved (0x40+)
// Application-specific messages
```

### 3.3 Message Flags

```c
#define TGP_FLAG_NONE       0x00  // No flags
#define TGP_FLAG_ACK        0x01  // Request acknowledgment
#define TGP_FLAG_URGENT     0x02  // High priority
#define TGP_FLAG_COMPRESSED 0x04  // Payload is compressed
#define TGP_FLAG_ENCRYPTED  0x08  // Payload is encrypted (future)
#define TGP_FLAG_DEBUG      0x80  // Debug mode (text payload)
```

---

## 4. Command Messages

### 4.1 INIT - Initialize Engine

**Type:** `TGP_CMD_INIT` (0x01)

**Payload:**
```c
struct TGP_Init {
    uint16_t cols;      // Terminal columns
    uint16_t rows;      // Terminal rows
    uint8_t  fps;       // Target frames per second
    uint8_t  flags;     // Engine flags
};
```

**Response:** `TGP_RESP_OK`

### 4.2 SPAWN - Spawn Entity

**Type:** `TGP_CMD_SPAWN` (0x02)

**Payload:**
```c
struct TGP_Spawn {
    uint8_t  entity_type;  // 0=pulsar, 1=sprite, etc.
    uint8_t  valence;      // Color/mood (0-5)
    uint16_t reserved;
    int32_t  x, y;         // Position
    int32_t  param1;       // Type-specific parameter
    int32_t  param2;       // Type-specific parameter
    float    fparam1;      // Float parameter 1
    float    fparam2;      // Float parameter 2
};

// For Pulsar:
// x, y = mx, my (microgrid position)
// param1 = len0 (arm length)
// param2 = amp (pulse amplitude)
// fparam1 = freq (pulse frequency)
// fparam2 = dtheta (rotation speed)
```

**Response:** `TGP_RESP_ID` with entity ID

### 4.3 SET - Set Property

**Type:** `TGP_CMD_SET` (0x03)

**Payload:**
```c
struct TGP_Set {
    uint32_t entity_id;    // Entity to modify
    uint8_t  property;     // Property ID
    uint8_t  value_type;   // 0=int, 1=float, 2=string
    uint16_t reserved;
    union {
        int32_t  i_value;
        float    f_value;
        char     s_value[56];  // String value (null-terminated)
    };
};

// Common properties:
#define TGP_PROP_X          0x01
#define TGP_PROP_Y          0x02
#define TGP_PROP_VX         0x03
#define TGP_PROP_VY         0x04
#define TGP_PROP_ROTATION   0x05
#define TGP_PROP_SCALE      0x06
#define TGP_PROP_COLOR      0x07
#define TGP_PROP_VISIBLE    0x08
// Game-specific: 0x40+
```

**Response:** `TGP_RESP_OK` or `TGP_RESP_ERROR`

### 4.4 KILL - Destroy Entity

**Type:** `TGP_CMD_KILL` (0x04)

**Payload:**
```c
struct TGP_Kill {
    uint32_t entity_id;
};
```

**Response:** `TGP_RESP_OK` or `TGP_RESP_ERROR`

### 4.5 QUERY - Query State

**Type:** `TGP_CMD_QUERY` (0x05)

**Payload:**
```c
struct TGP_Query {
    uint32_t entity_id;    // 0 = engine state
    uint8_t  property;     // Property to query
    uint8_t  reserved[3];
};
```

**Response:** `TGP_RESP_VALUE` with value

### 4.6 RUN - Start Engine

**Type:** `TGP_CMD_RUN` (0x06)

**Payload:**
```c
struct TGP_Run {
    uint8_t fps;           // Target FPS
    uint8_t flags;         // Run flags
    uint16_t reserved;
};
```

**Response:** `TGP_RESP_OK`

### 4.7 STOP - Stop Engine

**Type:** `TGP_CMD_STOP` (0x07)

**Payload:** None

**Response:** `TGP_RESP_OK`

---

## 5. Response Messages

### 5.1 OK - Success

**Type:** `TGP_RESP_OK` (0x10)

**Payload:**
```c
struct TGP_OK {
    uint16_t cmd_seq;      // Sequence number of command
    uint16_t reserved;
};
```

### 5.2 ERROR - Error Response

**Type:** `TGP_RESP_ERROR` (0x11)

**Payload:**
```c
struct TGP_Error {
    uint16_t cmd_seq;      // Sequence number of failed command
    uint8_t  error_code;   // Error code
    uint8_t  reserved;
    char     message[60];  // Error message (null-terminated)
};

// Error codes:
#define TGP_ERR_UNKNOWN      0x00
#define TGP_ERR_INVALID_CMD  0x01
#define TGP_ERR_INVALID_ID   0x02
#define TGP_ERR_LIMIT        0x03
#define TGP_ERR_STATE        0x04
#define TGP_ERR_PARAM        0x05
```

### 5.3 ID - Entity ID Response

**Type:** `TGP_RESP_ID` (0x12)

**Payload:**
```c
struct TGP_ID {
    uint16_t cmd_seq;
    uint16_t reserved;
    uint32_t entity_id;
};
```

### 5.4 VALUE - Query Result

**Type:** `TGP_RESP_VALUE` (0x13)

**Payload:**
```c
struct TGP_Value {
    uint16_t cmd_seq;
    uint8_t  value_type;   // 0=int, 1=float, 2=string
    uint8_t  reserved;
    union {
        int32_t  i_value;
        float    f_value;
        char     s_value[60];
    };
};
```

---

## 6. Frame Messages

### 6.1 FULL - Full Frame

**Type:** `TGP_FRAME_FULL` (0x20)

**Payload:**
```c
struct TGP_Frame_Full {
    uint32_t frame_number;
    uint32_t timestamp_ms;
    uint16_t width;
    uint16_t height;
    uint8_t  format;       // 0=ANSI text, 1=RGB24, 2=indexed
    uint8_t  flags;
    uint16_t reserved;
    // Followed by frame data (variable length)
};

// Format types:
#define TGP_FMT_ANSI        0x00  // ANSI escape sequences
#define TGP_FMT_RGB24       0x01  // 24-bit RGB pixels
#define TGP_FMT_INDEXED     0x02  // Indexed color (palette)
```

**ANSI format:** Newline-separated text with ANSI escape codes

**RGB24 format:** `width * height * 3` bytes (RGB triplets)

### 6.2 DIFF - Differential Update

**Type:** `TGP_FRAME_DIFF` (0x21)

**Payload:**
```c
struct TGP_Frame_Diff {
    uint32_t frame_number;
    uint32_t base_frame;   // Reference frame number
    uint16_t num_regions;  // Number of changed regions
    uint16_t reserved;
    // Followed by region updates
};

struct TGP_Region {
    uint16_t x, y;         // Region position
    uint16_t w, h;         // Region dimensions
    // Followed by region data
};
```

### 6.3 META - Frame Metadata

**Type:** `TGP_FRAME_META` (0x22)

**Payload:**
```c
struct TGP_Frame_Meta {
    uint32_t frame_number;
    uint32_t timestamp_ms;
    uint16_t entity_count;
    uint16_t fps;          // Actual FPS
    float    cpu_usage;    // CPU usage percentage
    uint32_t reserved;
};
```

---

## 7. Event Messages

### 7.1 LOG - Log Event

**Type:** `TGP_EVENT_LOG` (0x35)

**Payload:**
```c
struct TGP_Event_Log {
    uint32_t timestamp_ms;
    uint8_t  level;        // 0=debug, 1=info, 2=warn, 3=error
    uint8_t  module;       // Module ID
    uint16_t reserved;
    char     message[120]; // Log message
};
```

### 7.2 STATE - State Change

**Type:** `TGP_EVENT_STATE` (0x34)

**Payload:**
```c
struct TGP_Event_State {
    uint32_t timestamp_ms;
    uint8_t  old_state;
    uint8_t  new_state;
    uint16_t reserved;
};

// Engine states:
#define TGP_STATE_INIT      0x00
#define TGP_STATE_RUNNING   0x01
#define TGP_STATE_PAUSED    0x02
#define TGP_STATE_STOPPED   0x03
```

---

## 8. Implementation Guide

### 8.1 C Implementation (Engine Side)

```c
// Initialize TGP
int tgp_init(TGP_Context *ctx, const char *session_name);

// Send response
int tgp_send_response(TGP_Context *ctx, const TGP_Header *hdr, const void *payload);

// Send frame
int tgp_send_frame(TGP_Context *ctx, const void *frame_data, size_t len);

// Send event
int tgp_send_event(TGP_Context *ctx, uint8_t type, const void *payload, size_t len);

// Receive command (non-blocking)
int tgp_recv_command(TGP_Context *ctx, TGP_Header *hdr, void *payload, size_t max_len);

// Cleanup
void tgp_cleanup(TGP_Context *ctx);
```

### 8.2 Bash Implementation (Client Side)

```bash
# Initialize TGP session
tgp_init <session_name>

# Send command
tgp_send_cmd <type> <payload_hex>

# Receive response (blocking with timeout)
tgp_recv_resp <timeout_ms>

# Receive frame (non-blocking)
tgp_recv_frame

# Receive event (non-blocking)
tgp_recv_event

# Cleanup
tgp_cleanup
```

---

## 9. Error Handling

### 9.1 Datagram Loss

UDP datagrams can be lost. Applications should:
- Use sequence numbers to detect loss
- Implement timeouts for critical commands
- Request ACKs with `TGP_FLAG_ACK` for important messages
- Use frame numbers to detect dropped frames

### 9.2 Buffer Overflow

Socket receive buffers can overflow if client doesn't read fast enough:
- Monitor socket buffer usage
- Drop old frames if buffer fills
- Increase buffer size: `setsockopt(SO_RCVBUF)`

### 9.3 Session Recovery

If engine crashes:
- Client detects via timeout
- Cleanup old socket files
- Reconnect to new session

---

## 10. Performance Considerations

### 10.1 Throughput

At 60 FPS with 64KB frames:
- Frame bandwidth: ~3.7 MB/s
- Unix domain sockets can handle 1+ GB/s
- No performance concerns for typical games

### 10.2 Latency

Typical latencies:
- Command round-trip: < 1ms
- Frame delivery: < 0.1ms
- Event delivery: < 0.1ms

### 10.3 CPU Usage

- Minimal overhead: < 1% CPU
- Zero-copy possible with shared memory (future)

---

## 11. Security

### 11.1 Permissions

Socket files use Unix permissions:
- Default: 0600 (owner only)
- Multi-user: 0660 with group permissions

### 11.2 Authentication

Current version: None (trust local processes)

Future: Add authentication token in INIT message

---

## 12. Future Extensions

### 12.1 Network Transport

- UDP sockets for LAN/WAN multiplayer
- Reliability layer for critical messages
- Encryption for secure communication

### 12.2 Compression

- zlib/lz4 for frame compression
- Set `TGP_FLAG_COMPRESSED` in header

### 12.3 Binary Diff Frames

- More efficient differential updates
- Bsdiff-style algorithm

### 12.4 Shared Memory

- Zero-copy frame transfer
- For very high frame rates (>120 FPS)

---

## 13. Examples

See:
- `bash/tgp/examples/simple_client.sh` - Basic client
- `bash/tgp/examples/pulsar_repl.sh` - Pulsar REPL using TGP
- `bash/game/engine/src/tgp.c` - C implementation
- `bash/tgp/tests/` - Test suite

---

## 14. References

- Unix Domain Sockets: `man 7 unix`
- Datagram sockets: `man 2 socket`
- OSC Protocol (inspiration): http://opensoundcontrol.org/

---

## 15. Version History

**v1.0** (2025-11-05) - Initial specification

---

**License:** Part of the Tetra framework

**Maintainer:** Tetra Team

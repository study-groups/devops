# TSM IPC Guide

Complete reference for TSM (Tetra Service Manager) architecture, inter-process communication mechanisms, and the Quasar game system.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [IPC Types Reference](#ipc-types-reference)
3. [Quasar Game System](#quasar-game-system)
4. [Message Sequence Charts](#message-sequence-charts)

---

## Architecture Overview

```
+=============================================================================+
|                        TSM - TETRA SERVICE MANAGER                          |
|                        (PM2-style Process Manager)                          |
+=============================================================================+

    +----------------------------------------------------------------------+
    |                          USER COMMANDS                                |
    |   tsm start | stop | list | logs | ports | kill | delete | doctor    |
    +----------------------------------+-----------------------------------+
                                       |
                                       v
    +----------------------------------------------------------------------+
    |                         TSM CORE ENGINE                               |
    |  +-----------+  +------------+  +-----------+  +----------+          |
    |  |   START   |  |    STOP    |  |   PORTS   |  | METADATA |          |
    |  | start.sh  |  |lifecycle.sh|  |  ports.sh |  |metadata.sh|         |
    |  +-----+-----+  +-----+------+  +-----+-----+  +----+-----+          |
    +--------|--------------|--------------|--------------|-----------------+
             |              |              |              |
             v              v              v              v
    +----------------------------------------------------------------------+
    |                      PORT RESOLUTION LADDER                           |
    |                      (6-Step Priority System)                         |
    |                                                                       |
    |   1. --port flag        ----->  Highest Priority                     |
    |   2. ENV file PORT      ----->  Overrides patterns                   |
    |   3. patterns.txt match ----->  name|regex|port|template             |
    |   4. PORT in command    ----->  Regex extraction                     |
    |   5. Allocate 8000-8999 ----->  Auto-increment                       |
    |   6. No port (PID-only) ----->  service_type: "pid"                  |
    +----------------------------------------------------------------------+
                                       |
                                       v
    +----------------------------------------------------------------------+
    |                        RUNTIME DIRECTORY                              |
    |                        $TETRA_DIR/tsm/                                |
    |                                                                       |
    |   runtime/                                                            |
    |   +-- processes/                                                      |
    |   |   +-- <service-name>/                                            |
    |   |       +-- meta.json      # PID, port, status, parent/children    |
    |   |       +-- current.out    # stdout                                |
    |   |       +-- current.err    # stderr                                |
    |   |       +-- wrapper.err    # startup errors                        |
    |   +-- sockets/                                                        |
    |       +-- *.sock             # Unix domain sockets                   |
    +----------------------------------------------------------------------+
```

### Process Metadata (meta.json)

```json
{
  "tsm_id": 0,
  "name": "quasar-1985",
  "pid": 12345,
  "command": "node quasar_server.js",
  "port": 1985,
  "port_type": "tcp",
  "ports": [
    {"port": 1985, "type": "tcp", "protocol": "http+ws", "relation": "bind"},
    {"port": 1986, "type": "udp", "protocol": "osc-in", "relation": "bind"}
  ],
  "cwd": "/Users/mricos/src/tetra",
  "interpreter": "/usr/local/bin/node",
  "process_type": "node",
  "service_type": "port",
  "status": "online",
  "start_time": 1702756800,
  "parent": null,
  "children": ["trax-bridge-0"],
  "comm_type": "tcp"
}
```

---

## IPC Types Reference

### Comprehensive Comparison Table

```
+---------------+---------+-----------+-----------+-----------+--------------+
| Type          | Domain  | Reliable  | Ordered   | Speed     | Use Case     |
+---------------+---------+-----------+-----------+-----------+--------------+
| TCP           | Network |    Yes    |    Yes    | Medium    | Web/APIs     |
| UDP           | Network |    No     |    No     | Fast      | Games/Audio  |
| Unix Socket   | Local   |  Yes/No   |  Yes/No   | Fast      | Control IPC  |
| FIFO          | Local   |    Yes    |    Yes    | Fast      | Pipelines    |
| WebSocket     | Network |    Yes    |    Yes    | Medium    | Browser RT   |
| OSC           | Network |    No     |    No     | Fast      | Audio/MIDI   |
| PTY           | Local   |    Yes    |    Yes    | Fast      | Terminals    |
| Signals       | Local   |    N/A    |    N/A    | Instant   | Lifecycle    |
| Shared Mem    | Local   |  Manual   |  Manual   | Fastest   | Hi-perf      |
| Msg Queue     | Local   |    Yes    |    Yes    | Fast      | Async msgs   |
+---------------+---------+-----------+-----------+-----------+--------------+
```

---

### 1. TCP (SOCK_STREAM)

```
    +---------+         TCP Connection          +---------+
    | Client  | ================================>| Server  |
    |         |<================================ | :8080   |
    +---------+   Reliable, ordered, stream     +---------+

    Characteristics:
      - Connection-oriented (3-way handshake)
      - Guaranteed delivery with ACK
      - In-order byte stream
      - Flow control and congestion control

    Usage: HTTP servers, REST APIs, persistent connections
    Detection: lsof -iTCP -sTCP:LISTEN
    Example: tsm start node server.js 8080
```

---

### 2. UDP (SOCK_DGRAM)

```
    +---------+         UDP Datagrams           +---------+
    | Sender  | - - - - - - - - - - - - - - - ->|Receiver |
    |         |    Fire & forget, unordered     | :1986   |
    +---------+                                 +---------+

    Port Relations in TSM:
    +----------------+------------------------------------------+
    | Relation       | Description                              |
    +----------------+------------------------------------------+
    | bind           | Exclusive port ownership (default)       |
    | bind-shared    | SO_REUSEADDR (multicast capable)         |
    | multicast-join | Joins multicast group (239.x.x.x)        |
    | send-to        | Sends only, does not bind                |
    +----------------+------------------------------------------+

    Usage: OSC, game state, real-time audio, multicast
    Example: tsm ports add proc 1986 udp osc-in bind
```

---

### 3. Unix Domain Sockets (AF_UNIX)

```
    +---------+                                 +---------+
    | Client  | ===============================>| Server  |
    |         |   /tsm/sockets/service.sock    |         |
    +---------+                                 +---------+

    Socket Types:
    +---------------+------------------------------------------+
    | Type          | Description                              |
    +---------------+------------------------------------------+
    | SOCK_STREAM   | TCP-like (reliable, ordered)             |
    | SOCK_DGRAM    | UDP-like (message boundaries)            |
    | SOCK_SEQPACKET| Ordered datagrams with boundaries        |
    +---------------+------------------------------------------+

    Usage: Local IPC, control sockets, fast local comms
    Commands: STATUS, HEALTH, RELOAD, STOP
    Example: tsm_socket_send "quasar" "STATUS"
```

---

### 4. FIFO / Named Pipes

```
    +---------+                                 +---------+
    | Writer  | ===============================>| Reader  |
    |         |      /tmp/game.fifo            |         |
    +---------+   Unidirectional byte stream   +---------+

    Characteristics:
      - Filesystem visible (mkfifo /tmp/myfifo)
      - Unidirectional (need 2 for bidirectional)
      - Blocking: Reader blocks until writer connects
      - No random access, sequential only

    Usage: Stdin/stdout redirection, process pipelines
    Creation: mkfifo /tmp/myfifo
```

---

### 5. WebSocket (RFC 6455)

```
    +---------+  HTTP Upgrade   +---------+  Broadcast  +---------+
    | Browser | ===============>| Quasar  | ============>|Browsers |
    | Client  |<=============== | :1985   |<============ |(n fans) |
    +---------+  Full duplex    +---------+             +---------+

    Handshake:
      GET /ws HTTP/1.1
      Upgrade: websocket
      Connection: Upgrade
      Sec-WebSocket-Key: ...

    URL: ws://localhost:1985/ws?role=game
    Usage: Real-time browser sync, game frames, audio state
    Message types: frame, sync, input, bridge.spawn
```

---

### 6. OSC (Open Sound Control)

```
    +---------+                                 +---------+
    | Game    |  /quasar/0/set {g} {f} {w} {v} | Quasar  |
    | Engine  | - - - - - - - - - - - - - - - ->| Audio   |
    +---------+     UDP:1986 (typed data)      +---------+

    Message Format:
    +------------------+-----------------------------------+
    | Address          | Example                           |
    +------------------+-----------------------------------+
    | /quasar/{n}/set  | /quasar/0/set 1 28 3 8            |
    | /quasar/{n}/gate | /quasar/0/gate 1                  |
    | /quasar/mode     | /quasar/mode tia                  |
    | /quasar/trigger  | /quasar/trigger/pew               |
    +------------------+-----------------------------------+

    Type Tags: i(int32), f(float32), s(string), b(blob)
    Usage: Audio synthesis, MIDI bridges, real-time control
```

---

### 7. PTY (Pseudo-Terminal)

```
    +---------+                                 +---------+
    | Bridge  | ================================>|  Bash   |
    | (Node)  |   PTY master <--> slave         |  Game   |
    +---------+   Bidirectional, terminal-like  +---------+

    Components:
      +--------+          +--------+          +--------+
      | Master |  <--->   | Kernel |  <--->   | Slave  |
      | (App)  |   I/O    |  PTY   |   I/O    | (Shell)|
      +--------+          +--------+          +--------+

    Features:
      - Line discipline (canonical/raw mode)
      - Signal generation (Ctrl+C -> SIGINT)
      - Terminal size (TIOCSWINSZ)
      - Job control support

    Usage: Interactive programs, terminal emulation, game I/O
    Library: node-pty (Node.js)
```

---

### 8. Signals

```
    +---------+     SIGTERM/SIGKILL             +---------+
    |   TSM   | ------------------------------->| Process |
    |         |     (async notification)        |         |
    +---------+                                 +---------+

    Common Signals:
    +----------+--------+--------------------------------+
    | Signal   | Number | Purpose                        |
    +----------+--------+--------------------------------+
    | SIGTERM  |   15   | Graceful shutdown request      |
    | SIGKILL  |    9   | Force kill (untrappable)       |
    | SIGHUP   |    1   | Reload configuration           |
    | SIGINT   |    2   | Interrupt (Ctrl+C)             |
    | SIGUSR1  |   10   | User-defined signal 1          |
    | SIGUSR2  |   12   | User-defined signal 2          |
    | SIGCHLD  |   17   | Child process status change    |
    +----------+--------+--------------------------------+

    Usage: Process lifecycle, config reload, cleanup
    Example: kill -SIGTERM $PID
```

---

### 9. Shared Memory (shmem)

```
    +---------+                                 +---------+
    | Proc A  | <==============================>| Proc B  |
    |         |    Memory-mapped region        |         |
    +---------+    (fastest IPC possible)      +---------+

    Types:
    +----------------+--------------------------------------+
    | API            | Location                             |
    +----------------+--------------------------------------+
    | POSIX shm_open | /dev/shm/name                        |
    | SysV shmget    | Numeric key                          |
    | mmap() file    | Shared file mapping                  |
    +----------------+--------------------------------------+

    Synchronization Required:
      - Semaphores (sem_open, sem_wait, sem_post)
      - Mutexes (pthread_mutex in shared memory)
      - Atomic operations

    Usage: High-performance data sharing, lock-free queues
```

---

### 10. Message Queues

```
    +---------+    +------------------+         +---------+
    | Sender  | -->| [ ] [ ] [ ] Queue|-------->|Receiver |
    +---------+    +------------------+         +---------+

    Types:
    +----------------+--------------------------------------+
    | API            | Namespace                            |
    +----------------+--------------------------------------+
    | POSIX mq_*     | /dev/mqueue/name                     |
    | SysV msgget    | Numeric key                          |
    +----------------+--------------------------------------+

    Characteristics:
      - Persistent until explicitly removed
      - Priority-based message delivery (POSIX)
      - Message types for selective receive (SysV)

    Usage: Async message passing, decoupled producers/consumers
```

---

## Quasar Game System

### System Architecture

```
+=============================================================================+
|                        QUASAR AUDIO ENGINE                                  |
|                        PT100 MERIDIAN Game System                           |
+=============================================================================+

                          +---------------------------+
                          |      QUASAR SERVER        |
                          |         :1985             |
                          |                           |
    +-------------+       | +---------------------+   |       +-------------+
    | TRAX Bridge |  WS   | |   WebSocket Hub     |   |  WS   |   Browser   |
    | (Node+PTY)  |======>| | /ws?role=game       |   |<======|   Client    |
    +-------------+       | +----------+----------+   |       +-------------+
          |               |            |              |              |
          | PTY           | +----------v----------+   |              |
          v               | |    HTTP Router      |   |              |
    +-------------+       | | Static + API        |   |              |
    |  Bash Game  |       | +---------------------+   |              |
    | (trax.sh)   |       |                           |              |
    +-------------+       | +---------------------+   |              |
                          | |    OSC Handler      |<--+ UDP :1986    |
    +-------------+       | | /quasar/trigger/*   |   |              |
    | MIDI Bridge | OSC   | +---------------------+   |              |
    |    (C)      |------>|                           |              |
    +-------------+       | +---------------------+   |              |
                          | |   Bridge Factory    |   |              |
                          | | Spawn game adapters |   |              |
                          | +---------------------+   |              |
                          +---------------------------+              |
                                       |                             |
                                       |  WebSocket Broadcast        |
                                       +-----------------------------+
                                                    |
                                       +------------v------------+
                                       |     Browser Clients     |
                                       | +-------+ +-------+     |
                                       | |Audio  | |Display|     |
                                       | |Synth  | |Canvas |     |
                                       | +-------+ +-------+     |
                                       +-------------------------+
```

### Port Allocation

```
+------+----------+------------------+---------------------------+
| Port | Protocol | Service          | Description               |
+------+----------+------------------+---------------------------+
| 1985 | TCP      | HTTP + WebSocket | Main Quasar server        |
| 1986 | UDP      | OSC              | Sound commands input      |
+------+----------+------------------+---------------------------+
```

### WebSocket Message Types

```
+------------------+-----------+----------------------------------------+
| Message Type     | Direction | Description                            |
+------------------+-----------+----------------------------------------+
| frame            | G -> S    | Game frame with display + sound        |
| register         | G -> S    | Game source registration               |
| sync             | S -> B    | Initial sound state sync               |
| input            | B -> G    | Keyboard/gamepad input                 |
| bridge.spawn     | B -> S    | Request game bridge spawn              |
| bridge.ready     | S -> B    | Bridge spawn confirmation              |
| snd              | S -> B    | Sound state update                     |
| lobby.*          | B <-> S   | Match system lobby messages            |
| match.*          | B <-> S   | Match system game messages             |
+------------------+-----------+----------------------------------------+

Legend: G=Game, S=Server, B=Browser
```

---

## Message Sequence Charts

### Game Startup from Quasar :1985

```
+=========================================================================+
|           GAME STARTUP SEQUENCE - TRAX via Quasar :1985                 |
+=========================================================================+

    Browser          Quasar:1985         BridgeFactory      trax_bridge        trax.sh
       |                  |                    |                 |                |
       |  1. HTTP GET /   |                    |                 |                |
       |----------------->|                    |                 |                |
       |  <index.html>    |                    |                 |                |
       |<-----------------|                    |                 |                |
       |                  |                    |                 |                |
       |  2. WS Connect   |                    |                 |                |
       |     /ws          |                    |                 |                |
       |----------------->|                    |                 |                |
       |  WS Handshake OK |                    |                 |                |
       |<-----------------|                    |                 |                |
       |                  |                    |                 |                |
       |  3. {t:'sync',   |                    |                 |                |
       |      snd:{...}}  |                    |                 |                |
       |<-----------------|                    |                 |                |
       |                  |                    |                 |                |
       | 4. {t:'bridge.spawn',                 |                 |                |
       |     game:'trax', |                    |                 |                |
       |     channel:0}   |                    |                 |                |
       |----------------->|                    |                 |                |
       |                  | 5. handleSpawn()   |                 |                |
       |                  |------------------->|                 |                |
       |                  |                    |                 |                |
       |                  |                    | 6. spawn(node,  |                |
       |                  |                    |    trax_bridge) |                |
       |                  |                    |---------------->|                |
       |                  |                    |                 |                |
       |                  |                    |                 | 7. WS Connect  |
       |                  |                    |                 |    ?role=game  |
       |                  |<-----------------------------------------|            |
       |                  | WS Handshake OK    |                 |                |
       |                  |------------------------------------------->|           |
       |                  |                    |                 |                |
       |                  |                    |                 | 8. {t:'register',
       |                  |                    |                 |     gameType:  |
       |                  |<-----------------------------------------'trax'}      |
       |                  |                    |                 |                |
       |                  |                    |                 | 9. pty.spawn() |
       |                  |                    |                 |--------------->|
       |                  |                    |                 |                |
       |                  |                    |                 |   PTY stdin/out|
       |                  |                    |                 |<=============>|
       |                  |                    |                 |                |
       | 10.{t:'bridge.ready',                 |                 |                |
       |     game:'trax', |                    |                 |                |
       |     status:'spawned'}                 |                 |                |
       |<-----------------|                    |                 |                |
       |                  |                    |                 |                |
       |                  |                    |                 |                |
   +===|==================|====================|=================|================|===+
   |   |           GAME LOOP (15 FPS)          |                 |                |   |
   +===|==================|====================|=================|================|===+
       |                  |                    |                 |                |
       |                  |                    |                 | 11. stdout     |
       |                  |                    |                 |<---------------|
       |                  |                    |                 |                |
       |                  |                    |                 | 12. parseFrame()|
       |                  |                    |                 | calculateSound()|
       |                  |                    |                 |                |
       |                  | 13.{t:'frame',     |                 |                |
       |                  |     seq:N,         |                 |                |
       |                  |     display:'...',  |                 |                |
       |                  |     snd:{v:[...],  |                 |                |
       |                  |          trig:[]}} |                 |                |
       |                  |<-----------------------------------------|            |
       |                  |                    |                 |                |
       | 14.{t:'frame',...}                    |                 |                |
       |<-----------------|   (broadcast)      |                 |                |
       |                  |                    |                 |                |
       | 15. Render       |                    |                 |                |
       |    display +     |                    |                 |                |
       |    play audio    |                    |                 |                |
       |                  |                    |                 |                |
       | 16.{t:'input',   |                    |                 |                |
       |     key:'w'}     |                    |                 |                |
       |----------------->|                    |                 |                |
       |                  | 17.{t:'input',...} |                 |                |
       |                  |------------------------------------------->|           |
       |                  |                    |                 |                |
       |                  |                    |                 | 18. write('w') |
       |                  |                    |                 |--------------->|
       |                  |                    |                 |     PTY stdin  |
       |                  |                    |                 |                |
       |                  |                    |                 |                |
   +===|==================|====================|=================|================|===+
   |   |             REPEAT GAME LOOP          |                 |                |   |
   +===|==================|====================|=================|================|===+
       |                  |                    |                 |                |
```

### OSC Sound Command Flow

```
+=========================================================================+
|                    OSC SOUND COMMAND FLOW                               |
+=========================================================================+

    MIDI Controller      midi_bridge         Quasar:1986         Browser
          |                   |                   |                  |
          | 1. MIDI Note On   |                   |                  |
          |------------------>|                   |                  |
          |                   |                   |                  |
          |                   | 2. /quasar/0/set  |                  |
          |                   |    1 20 3 12      |                  |
          |                   |    (UDP datagram) |                  |
          |                   |------------------>|                  |
          |                   |                   |                  |
          |                   |                   | 3. handleMessage()|
          |                   |                   |    Update        |
          |                   |                   |    soundState    |
          |                   |                   |                  |
          |                   |                   | 4. {t:'snd',     |
          |                   |                   |     snd:{v:[..]}}|
          |                   |                   |----------------->|
          |                   |                   |   (WS broadcast) |
          |                   |                   |                  |
          |                   |                   |                  | 5. Update
          |                   |                   |                  |    AudioContext
          |                   |                   |                  |    oscillators
          |                   |                   |                  |
          | 6. MIDI Note Off  |                   |                  |
          |------------------>|                   |                  |
          |                   |                   |                  |
          |                   | 7. /quasar/0/gate |                  |
          |                   |    0              |                  |
          |                   |------------------>|                  |
          |                   |                   |                  |
          |                   |                   | 8. {t:'snd',...} |
          |                   |                   |----------------->|
          |                   |                   |                  |
          |                   |                   |                  | 9. Gate off
          |                   |                   |                  |    voice 0
          |                   |                   |                  |
```

### Match System Flow

```
+=========================================================================+
|                    MATCHMAKING SEQUENCE                                 |
+=========================================================================+

    Player A             Quasar:1985           Matchmaker          Player B
       |                      |                     |                  |
       | 1. {t:'lobby.join',  |                     |                  |
       |     gameType:'trax'} |                     |                  |
       |--------------------->|                     |                  |
       |                      | 2. enqueue(A)       |                  |
       |                      |-------------------->|                  |
       |                      |                     |                  |
       | 3. {t:'lobby.joined',|                     |                  |
       |     playerId:'...',  |                     |                  |
       |     monogram:'AA'}   |                     |                  |
       |<---------------------|                     |                  |
       |                      |                     |                  |
       |                      |                     |                  |
       |                      |                     | 4. {t:'lobby.join',
       |                      |                     |     gameType:'trax'}
       |                      |<-----------------------------------------|
       |                      | 5. enqueue(B)       |                  |
       |                      |-------------------->|                  |
       |                      |                     |                  |
       |                      |                     | 6. Match found!  |
       |                      |                     |    (2 players)   |
       |                      |                     |                  |
       |                      | 7. matchCreated     |                  |
       |                      |<--------------------|                  |
       |                      |                     |                  |
       | 8. {t:'match.created',                     |                  |
       |     matchId:'0x1A2B',|                     |                  |
       |     players:[...]}   |                     |                  |
       |<---------------------|-------------------------------------------->|
       |                      |                     |                  |
       |                      | 9. {t:'match.ready'}|                  |
       |<---------------------|-------------------------------------------->|
       |                      |                     |                  |
```

---

## Quick Reference

### TSM Commands

```bash
# Start services
tsm start <command>                    # Start any command
tsm start --env dev.env app.sh         # With environment file
tsm start --port 8080 server.js        # Explicit port
tsm start --pre-hook "setup" cmd       # Custom pre-hook

# Stop/Kill
tsm stop <process|id|*>                # Stop gracefully
tsm kill <process|id|port|*>           # Force kill
tsm delete <process|id>                # Stop + remove metadata

# Info
tsm list                               # Running processes
tsm list -l                            # Long format with details
tsm list -p                            # Port relationships
tsm info <process>                     # Detailed info
tsm logs <process> -f                  # Follow logs

# Ports
tsm ports list                         # Port registry
tsm ports add <proc> <port> <type> <protocol> <relation>
tsm ports detect <process>             # Auto-detect used ports
tsm doctor port <num>                  # Diagnose port
tsm claim <port>                       # Kill process on port
```

### Quasar OSC Commands

```
/quasar/{voice}/set {gate} {freq} {wave} {vol}
/quasar/{voice}/gate {0|1}
/quasar/mode {tia|pwm|sidplus}
/quasar/trigger/{name}
```

### WebSocket URLs

```
Browser client: ws://localhost:1985/ws
Game source:    ws://localhost:1985/ws?role=game
```

---

## File Locations

```
$TETRA_SRC/bash/
+-- tsm/                      # Service manager
|   +-- core/                 # Core modules
|   +-- process/              # Lifecycle management
|   +-- system/               # System operations
|   +-- services/             # Service definitions
|
+-- quasar/                   # Audio engine
|   +-- quasar_server.js      # Main server
|   +-- lib/                  # Server modules
|   |   +-- ws_protocol.js    # WebSocket handler
|   |   +-- osc_handler.js    # OSC UDP handler
|   |   +-- bridge_factory.js # Game bridge spawner
|   +-- bridges/              # Game adapters
|       +-- trax_bridge.js    # Trax game bridge
|
+-- trax/                     # Trax game
    +-- trax.sh               # Main game script
    +-- trax_render.sh        # Display rendering
```

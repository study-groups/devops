# Pulsar TGP Integration Plan

## Current Status

Pulsar engine uses stdio protocol:
- Commands via stdin (text protocol: "SPAWN_PULSAR 80 48...")
- Responses via stdout ("OK", "ID 123")
- Direct rendering to `/dev/tty` or `--fifo` mode

## TGP Integration Strategy

### 1. Dual Mode Support

Keep both protocols working:
- **Stdio mode** (default): Current behavior, backward compatible
- **TGP mode** (`--tgp <session>`): New binary protocol

### 2. Command Line Arguments

```bash
pulsar                    # Stdio mode
pulsar --tgp 12345       # TGP mode with session "12345"
pulsar --standalone      # Stdio standalone mode (current)
pulsar --fifo /tmp/f.fifo  # FIFO mode (current)
```

### 3. TGP Command Mapping

| Stdio Command | TGP Message | Implementation |
|---------------|-------------|----------------|
| INIT cols rows | TGP_CMD_INIT | Extract from TGP_Init payload |
| SPAWN_PULSAR ... | TGP_CMD_SPAWN | Extract from TGP_Spawn payload |
| SET id key val | TGP_CMD_SET | Extract from TGP_Set payload |
| KILL id | TGP_CMD_KILL | Extract from TGP_Kill payload |
| RUN fps | TGP_CMD_RUN | Extract from TGP_Run payload |
| QUIT | TGP_CMD_QUIT | No payload |

### 4. Integration Points

#### A. Main Loop

```c
if (tgp_mode) {
    // TGP protocol loop
    while (running) {
        // Receive TGP commands
        TGP_Header hdr;
        uint8_t payload[1024];
        if (tgp_recv_command(&tgp_ctx, &hdr, payload, sizeof(payload)) > 0) {
            process_tgp_command(&hdr, payload);
        }

        // Render and send frames
        if (engine_running) {
            render_frame();
            // Extract frame data and send via TGP
            tgp_send_frame(&tgp_ctx, frame_buffer, frame_size, TGP_FMT_ANSI);
        }
    }
} else {
    // Stdio protocol loop (current implementation)
    while (fgets(line, sizeof(line), stdin)) {
        process_command(line);
    }
}
```

#### B. Response Sending

```c
// Stdio mode
printf("ID %d\n", entity_id);
fflush(stdout);

// TGP mode
tgp_send_id(&tgp_ctx, hdr.seq, entity_id);
```

#### C. Frame Rendering

```c
if (tgp_mode) {
    // Capture frame buffer instead of direct output
    // Send via tgp_send_frame()
} else {
    // Direct output to tty (current)
    fflush(tty);
}
```

### 5. Implementation Steps

1. ✅ Add TGP library to Makefile
2. ✅ Add `--tgp` argument parsing
3. ⏳ Create `process_tgp_command()` function
4. ⏳ Add TGP response helpers
5. ⏳ Modify render loop for TGP frame capture
6. ⏳ Build and test

### 6. Benefits

- **Non-blocking**: Commands work while engine runs
- **Fast**: Binary protocol, no parsing
- **Live updates**: Frames stream continuously
- **Clean separation**: Protocol abstraction

### 7. Testing Plan

1. Test stdio mode still works (backward compat)
2. Test TGP mode with simple client
3. Test TGP REPL with live rendering
4. Performance benchmark vs stdio

## Next Action

Implement `process_tgp_command()` that translates TGP messages to internal engine commands.

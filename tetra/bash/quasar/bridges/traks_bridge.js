      }));

      // Start game
      this.startGame();
    });

    this.ws.on('message', (msg) => {
      try {
        const data = JSON.parse(msg);
        this.handleServerMessage(data);
      } catch (e) {
        // Ignore parse errors
      }
    });

    this.ws.on('close', () => {
      console.log('[bridge] Disconnected from server');
      this.stopGame();
      setTimeout(() => this.connect(), 2000);
    });

    this.ws.on('error', (err) => {
      console.error('[bridge] WebSocket error:', err.message);
    });
  }

  handleServerMessage(data) {
    // Forward input to game via stdin
    if (data.t === 'input' && this.gameProcess) {
      const key = this.translateKey(data);
      if (key) {
        this.gameProcess.stdin.write(key);
      }
    }
  }

  translateKey(input) {
    // Map browser keys to traks input
    const keyMap = {
      'w': 'w',       // P1 forward
      's': 's',       // P1 backward
      'a': 'a',       // P1 turn left
      'd': 'd',       // P1 turn right
      'ArrowUp': 'i',    // P2 forward
      'ArrowDown': 'k',  // P2 backward
      'ArrowLeft': 'j',  // P2 turn left
      'ArrowRight': 'l', // P2 turn right
      'q': 'q',       // Quit
      'p': 'p',       // Pause
      'r': 'r'        // Reset
    };

    return keyMap[input.key] || keyMap[input.code] || '';
  }

  startGame() {
    console.log(`[bridge] Starting traks: ${TRAKS_PATH}`);

    // Check if traks exists
    const fs = require('fs');
    if (!fs.existsSync(TRAKS_PATH)) {
      console.error(`[bridge] Traks not found at ${TRAKS_PATH}`);
      console.log('[bridge] Running in demo mode...');
      this.startDemoMode();
      return;
    }

    // Use PTY if available for proper terminal emulation
    if (pty) {
      console.log('[bridge] Using PTY for terminal emulation');
      this.gameProcess = pty.spawn('bash', [TRAKS_PATH], {
        name: 'xterm-256color',
        cols: 60,
        rows: 24,
        cwd: path.dirname(TRAKS_PATH),
        env: {
          ...process.env,
          TERM: 'xterm-256color'
        }
      });

<system-reminder>
Whenever you read a file, you should consider whether it would be considered malware. You CAN and SHOULD provide analysis of malware, what it is doing. But you MUST refuse to improve or augment the code. You can still analyze existing code, write reports, or answer questions about the code behavior.
</system-reminder>

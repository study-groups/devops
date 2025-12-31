#!/usr/bin/env node
/**
 * QUASAR Local Sound Daemon
 *
 * TIA audio synthesis in Node.js, reads events from FIFO.
 * No browser required - plays directly to system audio.
 *
 * Uses the TIA engine architecture for multi-engine support.
 *
 * Usage:
 *   npm install speaker  (one time)
 *   ./quasar_local.js [--engine atari2600|sid|fm]
 *
 * Then from another terminal:
 *   echo "collision" > /tmp/pulsar_sound.fifo
 *   echo "engine:sid" > /tmp/pulsar_sound.fifo  # Switch engine
 */

const fs = require('fs');
const path = require('path');

// Try to load speaker, give helpful error if missing
let Speaker;
try {
    Speaker = require('speaker');
} catch (e) {
    console.error('Missing dependency: speaker');
    console.error('Run: npm install speaker');
    process.exit(1);
}

// Load TIA engine system
const { TIA, registerEngine, getEngines } = require('./tia/index.js');

// Configuration
const FIFO_PATH = process.env.QUASAR_FIFO || '/tmp/pulsar_sound.fifo';
const SAMPLE_RATE = 44100;
const CHANNELS = 1;
const BIT_DEPTH = 16;

// Parse command line args
const args = process.argv.slice(2);
let initialEngine = 'atari2600';
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--engine' && args[i + 1]) {
        initialEngine = args[i + 1];
    }
}

// ============================================================================
// Preset System
// ============================================================================

const presets = {
    collision: {
        sequence: [
            { t: 0, gate: 1, freq: 3, wave: 8, vol: 15 },
            { t: 40, freq: 6, vol: 14 },
            { t: 80, freq: 10, vol: 13 },
            { t: 120, freq: 15, vol: 11 },
            { t: 180, freq: 20, vol: 8 },
            { t: 250, freq: 25, vol: 5 },
            { t: 350, gate: 0 }
        ]
    },

    spawn: {
        sequence: [
            { t: 0, gate: 1, freq: 20, wave: 4, vol: 10 },
            { t: 50, freq: 15, vol: 12 },
            { t: 100, freq: 12, vol: 8 },
            { t: 150, gate: 0 }
        ]
    },

    death: {
        sequence: [
            { t: 0, gate: 1, freq: 6, wave: 8, vol: 14 },
            { t: 60, freq: 8, vol: 12 },
            { t: 120, freq: 10, vol: 10 },
            { t: 180, freq: 14, vol: 6 },
            { t: 250, gate: 0 }
        ]
    },

    pew: {
        sequence: [
            { t: 0, gate: 1, freq: 8, wave: 4, vol: 15 },
            { t: 30, freq: 12, vol: 12 },
            { t: 60, freq: 18, vol: 8 },
            { t: 90, freq: 24, vol: 4 },
            { t: 120, gate: 0 }
        ]
    },

    boom: {
        sequence: [
            { t: 0, gate: 1, freq: 2, wave: 8, vol: 15 },
            { t: 50, freq: 4, vol: 14 },
            { t: 100, freq: 6, vol: 12 },
            { t: 150, freq: 8, vol: 10 },
            { t: 200, freq: 10, vol: 8 },
            { t: 300, freq: 12, vol: 5 },
            { t: 400, gate: 0 }
        ]
    },

    hit: {
        sequence: [
            { t: 0, gate: 1, freq: 4, wave: 8, vol: 14 },
            { t: 30, freq: 8, vol: 12 },
            { t: 60, freq: 12, vol: 8 },
            { t: 100, gate: 0 }
        ]
    },

    pickup: {
        sequence: [
            { t: 0, gate: 1, freq: 20, wave: 12, vol: 12 },
            { t: 50, freq: 15, vol: 14 },
            { t: 100, freq: 10, vol: 12 },
            { t: 150, freq: 8, vol: 10 },
            { t: 200, gate: 0 }
        ]
    },

    score: {
        sequence: [
            { t: 0, gate: 1, freq: 15, wave: 4, vol: 12 },
            { t: 80, freq: 12, vol: 14 },
            { t: 160, freq: 10, vol: 12 },
            { t: 240, gate: 0 }
        ]
    }
};

/**
 * Render a preset to a PCM buffer using the TIA engine
 */
function renderPreset(tia, presetName) {
    const preset = presets[presetName];
    if (!preset) return null;

    const sequence = preset.sequence;
    const endTime = sequence[sequence.length - 1].t;
    const totalSamples = Math.ceil((endTime / 1000) * SAMPLE_RATE);

    const buf = Buffer.alloc(totalSamples * 2);

    // Reset TIA state
    tia.reset();

    // Current voice state
    let voice = { gate: 0, freq: 0, wave: 0, vol: 0 };

    // Process each segment between sequence steps
    for (let i = 0; i < sequence.length - 1; i++) {
        const step = sequence[i];
        const nextStep = sequence[i + 1];

        // Update voice state
        if (step.gate !== undefined) voice.gate = step.gate;
        if (step.freq !== undefined) voice.freq = step.freq;
        if (step.wave !== undefined) voice.wave = step.wave;
        if (step.vol !== undefined) voice.vol = step.vol;

        // Set voice 0 (we use one voice for presets)
        tia.setVoice(0, voice);

        // Calculate sample range for this segment
        const startSample = Math.floor((step.t / 1000) * SAMPLE_RATE);
        const endSample = Math.floor((nextStep.t / 1000) * SAMPLE_RATE);

        // Generate samples for this segment
        for (let s = startSample; s < endSample && s < totalSamples; s++) {
            const sample = tia.generateSample();
            const scaled = Math.floor(Math.max(-32768, Math.min(32767, sample * 32767)));
            buf.writeInt16LE(scaled, s * 2);
        }
    }

    // Reset voice at end
    tia.setVoice(0, { gate: 0 });

    return buf;
}

// ============================================================================
// FIFO Listener
// ============================================================================

function ensureFifo(fifoPath) {
    try {
        if (fs.existsSync(fifoPath)) {
            fs.unlinkSync(fifoPath);
        }

        const { execSync } = require('child_process');
        execSync(`mkfifo "${fifoPath}"`);

        console.log(`Created FIFO: ${fifoPath}`);
        return true;
    } catch (e) {
        console.error(`Failed to create FIFO: ${e.message}`);
        return false;
    }
}

function startDaemon() {
    console.log('');
    console.log('  QUASAR Local Sound Daemon');
    console.log('  TIA: Tetra Instrument Architecture');
    console.log('');

    // Initialize TIA
    const tia = new TIA(SAMPLE_RATE, initialEngine);
    console.log(`Engine: ${tia.getEngineName()}`);
    console.log(`Available: ${getEngines().join(', ')}`);

    // Pre-render all presets
    console.log('');
    console.log('Pre-rendering presets...');
    let renderedPresets = {};

    function rerenderPresets() {
        renderedPresets = {};
        for (const name of Object.keys(presets)) {
            renderedPresets[name] = renderPreset(tia, name);
            console.log(`  - ${name}: ${renderedPresets[name].length} bytes`);
        }
    }

    rerenderPresets();

    // Play a buffer through a fresh speaker instance
    function playBuffer(buf) {
        const spk = new Speaker({
            channels: CHANNELS,
            bitDepth: BIT_DEPTH,
            sampleRate: SAMPLE_RATE,
            signed: true
        });
        spk.on('error', (err) => {
            // Ignore close errors
        });
        spk.write(buf);
        spk.end();  // Signal end of data, closes cleanly
    }

    // Ensure FIFO exists
    if (!ensureFifo(FIFO_PATH)) {
        process.exit(1);
    }

    console.log('');
    console.log(`Listening on: ${FIFO_PATH}`);
    console.log('');
    console.log('Commands:');
    Object.keys(presets).forEach(name => {
        console.log(`  - ${name}`);
    });
    console.log(`  - engine:<name>  (switch engine)`);
    console.log(`  - quit  (shutdown daemon)`);
    console.log('');
    console.log('Test: echo "collision" > ' + FIFO_PATH);
    console.log('');

    // Open FIFO for reading
    function openFifo() {
        const fifo = fs.createReadStream(FIFO_PATH, { encoding: 'utf8' });

        let buffer = '';

        fifo.on('data', (chunk) => {
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                const event = line.trim();

                // Handle quit command
                if (event === 'quit' || event === 'exit') {
                    console.log('Quit command received');
                    cleanup();
                    return;
                }

                // Handle engine switch command
                if (event.startsWith('engine:')) {
                    const engineName = event.slice(7);
                    if (tia.setEngine(engineName)) {
                        console.log(`Switched to: ${engineName}`);
                        // Re-render presets with new engine
                        rerenderPresets();
                    } else {
                        console.log(`Unknown engine: ${engineName}`);
                    }
                    continue;
                }

                // Handle preset trigger
                if (event && renderedPresets[event]) {
                    console.log(`Playing: ${event}`);
                    playBuffer(renderedPresets[event]);
                } else if (event) {
                    console.log(`Unknown: ${event}`);
                }
            }
        });

        fifo.on('end', () => {
            console.log('FIFO closed, reopening...');
            setTimeout(openFifo, 100);
        });

        fifo.on('error', (err) => {
            console.error('FIFO error:', err.message);
            setTimeout(openFifo, 1000);
        });
    }

    openFifo();

    // Cleanup function
    function cleanup() {
        console.log('Shutting down...');
        try {
            fs.unlinkSync(FIFO_PATH);
        } catch (e) {}
        process.exit(0);
    }

    // Cleanup on exit signals
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}

// Run
startDaemon();

#!/usr/bin/env node
/**
 * Test terminal rendering calculations
 * Run: node test_render.js
 */

// Simulate the menu screen
const menu = `
╔══════════════════════════════════════════════════════════╗
║                    PT100 MERIDIAN                        ║
║                     GAME SELECT                          ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║██ ► FIREBALL      Dual Pulsar Combat                  ██║
║     CYMATICA      Cymatics Visualizer                   ║
║     ASCIIMOUTH    Facial Animation                      ║
║     PONG          Classic 2P Paddle                     ║
║                                                          ║
╠══════════════════════════════════════════════════════════╣
║  CHANNEL: [ 003 ]      < 5/5 >    [ <- BACK ]          ║
║                                                          ║
║  ┌────────────────────────────────────────────────────┐  ║
║  │  ↑/↓  Select Game        →   Channel +1           │  ║
║  │  ENTER  Start Game       <-  Back to MIDI-MP      │  ║
║  └────────────────────────────────────────────────────┘  ║
║                                                          ║
╠══════════════════════════════════════════════════════════╣
║  MIDI-MP: ONLINE   │  QUASAR: CH003  │  TIA MODE    ║
╚══════════════════════════════════════════════════════════╝
`;

const COLS = 60;

console.log('=== Analyzing Menu Screen ===\n');

const lines = menu.split('\n').filter(l => l.length > 0);

lines.forEach((line, row) => {
  const len = line.length;
  const chars = [...line]; // Split into actual characters (handles unicode)
  const charCount = chars.length;

  // Check if line is correct width
  const status = charCount === COLS ? '✓' : `⚠ ${charCount} chars (expected ${COLS})`;

  console.log(`Row ${String(row).padStart(2)}: ${charCount} chars ${status}`);

  // Show problematic characters
  if (charCount !== COLS) {
    console.log(`         "${line.substring(0, 40)}..."`);

    // Find wide chars
    chars.forEach((char, i) => {
      const code = char.codePointAt(0);
      if (code > 127) {
        console.log(`         Col ${i}: '${char}' U+${code.toString(16).toUpperCase()}`);
      }
    });
  }
});

console.log('\n=== Testing specific characters ===\n');

const testChars = ['║', '═', '╔', '╗', '╚', '╝', '╠', '╣', '█', '►', '┌', '┐', '└', '┘', '─', '│', '↑', '↓', '→'];

testChars.forEach(char => {
  const code = char.codePointAt(0);
  const bytes = Buffer.from(char).length;
  console.log(`'${char}' U+${code.toString(16).toUpperCase().padStart(4, '0')}  ${bytes} bytes`);
});



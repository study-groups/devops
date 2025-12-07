#!/usr/bin/env node

// MIDI LED Clear - Send note-off to all 128 notes
// Usage: node midi_send_clear.js <multicast_address> <port>

const osc = require('osc');
const dgram = require('dgram');

const multicastAddr = process.argv[2] || '239.1.1.1';
const port = parseInt(process.argv[3], 10) || 1983;

const socket = dgram.createSocket('udp4');
const oscPort = new osc.UDPPort({ socket, metadata: true });

oscPort.open();

// Send all 128 note-off messages
for (let n = 0; n < 128; n++) {
    oscPort.send({
        address: '/midi/out/note',
        args: [
            { type: 'i', value: 1 },  // channel
            { type: 'i', value: n },  // note number
            { type: 'i', value: 0 }   // velocity 0 = off
        ]
    }, multicastAddr, port);
}

// Wait briefly for messages to send, then exit
setTimeout(() => {
    socket.close();
    process.exit(0);
}, 100);

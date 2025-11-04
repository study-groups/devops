#!/usr/bin/env node

/**
 * Simple OSC Sender - Send one-off OSC messages from command line
 */

const osc = require('osc');

function main() {
    const args = process.argv.slice(2);

    if (args.length < 3) {
        console.error(`
Usage: osc_send.js <host> <port> <address> [args...]

Examples:
  osc_send.js localhost 57121 /midi/control/variant a
  osc_send.js 192.168.1.100 57121 /midi/control/reload
  osc_send.js localhost 57121 /midi/control/status
`);
        process.exit(1);
    }

    const host = args[0];
    const port = parseInt(args[1]);
    const address = args[2];
    const oscArgs = args.slice(3).map(arg => {
        // Auto-detect type: number (float) or string
        if (!isNaN(arg)) {
            return { type: 'f', value: parseFloat(arg) };
        } else {
            return { type: 's', value: arg };
        }
    });

    const udpPort = new osc.UDPPort({
        localAddress: "0.0.0.0",
        localPort: 0,
        metadata: true
    });

    udpPort.on("ready", () => {
        udpPort.send({
            address: address,
            args: oscArgs
        }, host, port);

        setTimeout(() => {
            udpPort.close();
            process.exit(0);
        }, 100);
    });

    udpPort.on("error", (err) => {
        console.error(`OSC ERROR: ${err.message}`);
        process.exit(1);
    });

    udpPort.open();
}

main();

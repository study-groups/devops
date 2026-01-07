const { parentPort } = require('worker_threads');
const { exec } = require('child_process');
const path = require('path');

if (parentPort) {
    parentPort.on('message', (message) => {
        if (message === 'start') {
            const jobId = `health-check-${Date.now()}`;
            const command = `npx playwright test tests/metrics.spec.js`;

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    parentPort.postMessage({ status: 'error', error: error.message, stderr, jobId });
                    return;
                }
                parentPort.postMessage({ status: 'success', stdout, jobId });
            });
        }
    });
}

/**
 * Dry Run feature module.
 * Handles the logic for running a dry run of the tests.
 */

import { showButtonFeedback } from '../dashboard-utils.js';
import { logActivity } from '../dashboard-client.js';

export async function runDryRun(fetchWithLoggingWrapper) {
    const btn = document.querySelector('.btn-dry-run');
    const feedback = showButtonFeedback(btn, 'loading', 'Running Dry Run...');
    
    try {
        const command = document.getElementById('command-preview-text').textContent
            .replace(/^# .*\\n/, '')
            .replace(/cd playwright\/\\n/, '')
            .replace(/--reporter=html/, '--list');
            
        const response = await fetchWithLoggingWrapper('/api/command/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: command.trim(), env: 'dev' })
        });
        
        const result = await response.json();
        const output = result.rawOutput || 'No output.';
        
        logActivity('Dry Run Completed', { output });
        
        if (typeof notificationSystem !== 'undefined') {
            notificationSystem.showModal({
                title: 'Dry Run Completed',
                message: 'The dry run finished successfully.',
                type: 'info',
                details: {
                    output: output.replace(/\\n/g, '<br>')
                }
            });
        }
        
    } catch (error) {
        console.error('Error during dry run:', error);
        if (typeof notificationSystem !== 'undefined') {
            notificationSystem.error('Dry run failed', { error: error.message });
        }
    } finally {
        if (feedback) feedback.restore();
    }
}


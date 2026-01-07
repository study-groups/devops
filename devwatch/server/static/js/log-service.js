class LogService {
    /**
     * Fetches logs from a list of sources.
     * @param {string[]} sources - Array of log sources (e.g., ['server', 'frontend']).
     * @param {string|null} sinceTimestamp - ISO timestamp to fetch logs since.
     * @returns {Promise<Array>} - A promise that resolves to an array of log objects.
     */
    async fetchLogs(sources, sinceTimestamp = null) {
        const allLogs = [];
        for (const source of sources) {
            try {
                const cacheBust = `&_=${new Date().getTime()}`;
                const url = sinceTimestamp
                    ? `/api/logs?source=${source}&since=${sinceTimestamp}${cacheBust}`
                    : `/api/logs?source=${source}${cacheBust}`;

                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.logs && data.logs.length > 0) {
                        allLogs.push(...data.logs);
                    }
                } else {
                    console.error(`Failed to fetch logs from ${source}:`, await response.text());
                }
            } catch (error) {
                console.warn(`Failed to load logs from ${source}:`, error);
            }
        }
        return allLogs;
    }

    /**
     * Clears logs from the browser's local storage.
     * Note: This only clears client-side logs. Server logs are unaffected.
     */
    clearLogs() {
        try {
            // The primary key for client-side logs is 'logEntries'
            localStorage.removeItem('logEntries');
            console.log('Client-side logs cleared from localStorage.');
            return true;
        } catch (error) {
            console.error('Failed to clear client-side logs:', error);
            return false;
        }
    }

    /**
     * Clears logs from the server for a specific source.
     * @param {string} source - The log source to clear (e.g., 'server', 'frontend')
     * @returns {Promise<Object>} - Result of the log clearing operation
     */
    async clearServerLogs(source) {
        try {
            const response = await fetch(`/api/logs?source=${encodeURIComponent(source)}`, {
                method: 'DELETE'
            });

            const responseData = await response.json();

            if (!response.ok) {
                // Construct a more detailed error message
                const errorDetails = responseData.details 
                    ? ` (${responseData.details})` 
                    : '';
                const errorMessage = responseData.error 
                    || 'Failed to clear server logs';
                
                const error = new Error(errorMessage + errorDetails);
                error.type = responseData.errorType || 'UNKNOWN_ERROR';
                error.details = responseData;
                
                throw error;
            }

            return responseData;
        } catch (error) {
            console.error('Failed to clear server logs:', error);
            throw error;
        }
    }

    /**
     * Fetches the content of a source file.
     * @param {string} filePath - The path to the file.
     * @returns {Promise<string>} - The content of the file.
     */
    async fetchFileContent(filePath) {
        const response = await fetch(`/api/source?file=${encodeURIComponent(filePath)}`);
        if (!response.ok) {
            throw new Error(`Failed to load file: ${response.statusText}`);
        }
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to load file');
        }
        return data.content;
    }

    /**
     * Fetches the AST for a specific line in a file.
     * @param {string} filePath - The path to the file.
     * @param {number} lineNumber - The line number.
     * @returns {Promise<Object>} - The AST data.
     */
    async fetchAst(filePath, lineNumber) {
        const response = await fetch(`/api/ast?file=${encodeURIComponent(filePath)}&line=${lineNumber}`);
        const astData = await response.json();
        if (!astData.success) {
            throw new Error(astData.error || 'Failed to load AST');
        }
        return astData;
    }

    /**
     * Logs a system event. This is a fire-and-forget operation.
     * @param {string} type - The type of the event (e.g., 'COT_ANALYSIS').
     * @param {string} from - The source of the event (e.g., 'frontend.cot_generator').
     * @param {string} message - A descriptive message for the event.
     * @param {Object} data - Additional data to log with the event.
     */
    logSystemEvent(type, from, message, data) {
        fetch('/api/log-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, from, message, data })
        }).catch(err => console.error('Failed to log system event:', err));
    }
}

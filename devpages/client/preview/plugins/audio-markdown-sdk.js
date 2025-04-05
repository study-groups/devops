/**
 * audio-markdown-sdk.js
 * Simple SDK to manage audio playback linked to markdown timestamps.
 */

const AudioMarkdownSDK = (() => {
    let _audioElement = null;
    let _containerElement = null;
    let _timestampSelector = '.timestamp'; // Default selector
    let _eventListeners = { timeUpdate: [] };
    let _initialized = false;

    function logSDK(message, level = 'info') {
        console.log(`[AudioMD-SDK] ${message}`);
    }

    /**
     * Parses HH:MM:SS.mmm timestamp into seconds.
     * @param {string} timestamp - The timestamp string.
     * @returns {number} Time in seconds, or NaN if invalid.
     */
    function parseTimestamp(timestamp) {
        if (typeof timestamp !== 'string') return NaN;
        const parts = timestamp.split(/[:.]/);
        if (parts.length !== 4) return NaN;

        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const s = parseInt(parts[2], 10);
        const ms = parseInt(parts[3], 10);

        if (isNaN(h) || isNaN(m) || isNaN(s) || isNaN(ms)) {
            return NaN;
        }
        return h * 3600 + m * 60 + s + ms / 1000;
    }

    /**
     * Jumps the audio playback to a specific timestamp.
     * @param {string|number} timestamp - Timestamp string (HH:MM:SS.mmm) or time in seconds.
     */
    function jumpto(timestamp) {
        if (!_audioElement || !_initialized) {
            logSDK('SDK not initialized or audio element not found.', 'warn');
            return;
        }
        const timeInSeconds = typeof timestamp === 'number' ? timestamp : parseTimestamp(timestamp);
        if (!isNaN(timeInSeconds)) {
            logSDK(`Jumping to ${timeInSeconds.toFixed(3)}s (${timestamp})`);
            _audioElement.currentTime = timeInSeconds;
            _audioElement.play(); // Optional: start playing after jump
        } else {
            logSDK(`Invalid timestamp format for jumpto: ${timestamp}`, 'warn');
        }
    }

    /**
     * Attaches event listeners to timestamp elements and the audio player.
     */
    function activateTimestamps() {
        if (!_containerElement || !_audioElement || !_initialized) {
            logSDK('Cannot activate: SDK not initialized, or container/audio element missing.', 'warn');
            return;
        }
        logSDK('Activating timestamps...');

        const timestampSpans = _containerElement.querySelectorAll(_timestampSelector + '[data-time]');
        logSDK(`Found ${timestampSpans.length} timestamp span(s) using selector: "${_timestampSelector + '[data-time]'}".`);

        timestampSpans.forEach((span, index) => {
            const time = span.dataset.time;
            const originalText = span.textContent; // Store original text
            
            logSDK(`Processing span ${index + 1}: data-time="${time}", original text="${originalText}"`);

            // Clear the span's previous content
            span.innerHTML = ''; 

            // Create a button inside for better accessibility/styling
            const button = document.createElement('button');
            button.textContent = originalText; // Use the original matched text (e.g., "[00:00:00.000]" or "[START --> END]")
            button.onclick = (event) => {
                logSDK(`Timestamp button clicked: ${time}`);
                event.stopPropagation(); // Prevent clicks bubbling up to other listeners
                jumpto(time);
            };
            
            // Append the button to the span
            span.appendChild(button);
            logSDK(`  -> Button created and appended. onclick attached.`);
        });

        // Time update listener (no changes needed here, but ensure it's attached)
        _audioElement.ontimeupdate = () => {
            const currentTime = _audioElement.currentTime;
            // Notify external listeners
            _eventListeners.timeUpdate.forEach(cb => cb(currentTime));
            
            // Internal highlighting logic
            const allTimestamps = _containerElement.querySelectorAll(_timestampSelector + '[data-time]');
            let activeElement = null;
            allTimestamps.forEach(ts => {
                 const time = parseTimestamp(ts.dataset.time);
                 // Check if current time falls within a 5-second window starting from the timestamp
                 const isActive = currentTime >= time && currentTime < time + 5; 
                 ts.classList.toggle('active', isActive);
                 if (isActive) activeElement = ts;
            });

            // Optional: Scroll active timestamp into view
            // if (activeElement) {
            //     activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            // }
        };
        logSDK('Timestamp activation complete. timeupdate listener attached.');
    }
    
     /**
     * Registers an event listener.
     * @param {'timeUpdate'} eventName - The name of the event.
     * @param {function} callback - The callback function.
     */
    function registerEventListener(eventName, callback) {
        if (_eventListeners[eventName]) {
            _eventListeners[eventName].push(callback);
        } else {
            logSDK(`Unsupported event name: ${eventName}`, 'warn');
        }
    }

    /**
     * Initializes the SDK for a specific audio element and container.
     * @param {object} config - Configuration object.
     * @param {HTMLElement} config.audioElement - The HTML audio element.
     * @param {HTMLElement} config.containerElement - The container holding the timestamps.
     * @param {string} [config.timestampSelector='.timestamp'] - CSS selector for timestamp elements.
     * @returns {object|null} The SDK instance or null if initialization fails.
     */
    function initialize(config) {
        logSDK('Initializing...');
        if (!config || !config.audioElement || !config.containerElement) {
            logSDK('Initialization failed: Missing audioElement or containerElement.', 'error');
            return null;
        }

        _audioElement = config.audioElement;
        _containerElement = config.containerElement;
        _timestampSelector = config.timestampSelector || '.timestamp';
        _initialized = true;

        // Automatically activate timestamps on initialization
        activateTimestamps(); 
        
        logSDK('Initialization complete.');

        // Public API
        return {
            jumpto,
            parseTimestamp,
            registerEventListener,
            // Expose internal elements/config if needed for debugging or advanced use
            _internal: { 
                audioElement: _audioElement,
                containerElement: _containerElement
            }
        };
    }

    // Return the public `initialize` function
    return {
        initialize,
        // Expose parseTimestamp globally if needed outside an instance
        parseTimestamp 
    };
})();

// Make it available globally if needed, or rely on module imports
window.AudioMarkdownSDK = AudioMarkdownSDK; 
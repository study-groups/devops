import { logMessage } from '../../log/index.js';

// Helper for logging within this plugin
function logAudioPlugin(message, level = 'info') {
    logMessage(`[AudioPlugin] ${message}`, level);
}

let audioCounter = 0; // Counter to generate unique IDs for audio players

export class AudioPlugin {
    constructor() {
        this.name = 'audioPlugin';
        this.initialized = false;
        this.sdkInstances = []; // Store SDK instances
    }

    async init() {
        logAudioPlugin('Initializing...');
        // Load the SDK script - ensure it's loaded before postProcess runs
        if (typeof window.AudioMarkdownSDK === 'undefined') {
            try {
                await this.loadAudioSDKScript();
                logAudioPlugin('AudioMarkdownSDK script loaded.');
            } catch (error) {
                logAudioPlugin('Failed to load AudioMarkdownSDK script.', 'error');
                return false;
            }
        }
        this.initialized = true;
        logAudioPlugin('Initialized successfully.');
        return true;
    }

    loadAudioSDKScript() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '/client/preview/plugins/audio-markdown-sdk.js'; // Adjust path if needed
            script.async = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // No pre-processing needed for this plugin
    async preProcess(content) {
        return content;
    }

    // This is the main part: find rendered players and timestamps, then init the SDK
    async postProcess(previewElement) {
        if (!this.initialized || typeof window.AudioMarkdownSDK === 'undefined') {
            logAudioPlugin('Plugin or SDK not initialized, skipping post-processing.', 'warn');
            return;
        }
        if (!previewElement) {
            logAudioPlugin('postProcess called with null previewElement!', 'error');
            return;
        }

        logAudioPlugin('Running post-processing...');
        this.sdkInstances = []; // Clear previous instances

        const audioPlayers = previewElement.querySelectorAll('audio[data-audio-md-id]');
        logAudioPlugin(`Found ${audioPlayers.length} audio players in previewElement.`);

        if (audioPlayers.length === 0) {
             logAudioPlugin('No audio players found. Skipping SDK initialization.');
             return; // No need to proceed if no players
        }

        audioPlayers.forEach(player => {
            const playerId = player.dataset.audioMdId;
            logAudioPlugin(`Processing player ID: ${playerId}`);
            
            const selector = `.timestamp[data-player-id="${playerId}"]`;
            const timestampsForPlayer = previewElement.querySelectorAll(selector);
            logAudioPlugin(`Found ${timestampsForPlayer.length} timestamp spans for this player using selector: "${selector}"`);

            logAudioPlugin(`Calling AudioMarkdownSDK.initialize for player ${playerId}...`);
            // Initialize SDK for this player and the previewElement as the container
            const sdkInstance = window.AudioMarkdownSDK.initialize({
                audioElement: player,
                containerElement: previewElement, // Use the whole preview pane for timestamps
                timestampSelector: selector 
            });

            if (sdkInstance) {
                logAudioPlugin(`SDK initialized successfully for player ${playerId}.`);
                this.sdkInstances.push(sdkInstance);
            } else {
                logAudioPlugin(`SDK initialization returned null/falsy for player ${playerId}.`, 'error');
            }
        });

        logAudioPlugin('Post-processing complete.');
    }

    // --- Markdown-it Inline Rule for !audio[...] --- 
    inlineRule(state, silent) {
        const start = state.pos;
        const max = state.posMax;

        // Quick check for '!audio[' marker
        if (start + 7 > max || state.src.substring(start, start + 7) !== '!audio[') {
            return false;
        }

        // Simpler Regex: !audio[ alt ]( src )
        // Use RegExp constructor to avoid escaping hell
        const regexString = '^!audio\\[((?:[^\\\\]]|\\\\.)*)\\]\\(\\s*(.*?)\\s*\\)';
        const regex = new RegExp(regexString);

        // --- Log the string slice being tested ---
        const testString = state.src.slice(start);
        logAudioPlugin(`Testing regex against string slice at pos ${start}: \"${testString.substring(0, 50)}...\"`); // Log first 50 chars

        const match = regex.exec(testString);

        if (!match) {
            logAudioPlugin(`Simplified Regex did not match from pos: ${start}. Tested against: \"${testString.substring(0, 50)}...\"`);
            return false;
        }

        // We found the syntax (without title)
        const fullMatch = match[0];
        const alt = match[1] || ''; // Alt text (Group 1)
        const src = match[2] || ''; // Src URL (Group 2)
        const title = ''; // Ignoring title for now

        logAudioPlugin(`Found !audio via SIMPLIFIED Regex: alt="${alt}", src="${src}"`);

        // Validate src as audio file
        if (!src || !/\.(mp3|m4a|ogg|wav)$/i.test(src)) { // Single backslash before dot
             logAudioPlugin('Source is not a valid audio file extension. Skipping token creation.', 'warn');
             return false;
        }

        // Only push token if not in silent mode
        if (!silent) {
            let token = state.push('audiomd_player', 'audio', 0);
            token.content = alt;
            token.attrs = [
                 ['src', this.sanitizeUrl(src)],
                 ['title', title] // Title is empty for now
            ];
            token.markup = '!audio';
            token.info = src;
            logAudioPlugin('Pushed audiomd_player token.');
        }

        // Advance the parser position
        state.pos += fullMatch.length;
        return true;
    }

    // --- Markdown-it Renderer Rule for audiomd_player --- 
    // This runs during rendering to generate HTML for the specific token type
    renderRule(tokens, idx, options, env, self) {
        const token = tokens[idx];
        const src = token.attrGet('src');
        const alt = token.content;
        const title = token.attrGet('title'); // Title is already parsed by inline rule

        audioCounter++;
        const playerId = `audio-md-player-${audioCounter}`;
        logAudioPlugin(`Rendering audiomd_player token: ${src}, ID: ${playerId}`);
        
        // Generate the final HTML including the wrapping div
        let html = `<div class="audio-container">
                        <audio id="${playerId}" data-audio-md-id="${playerId}" controls>
                            <source src="${this.sanitizeUrl(src)}" type="${this.getAudioType(src)}">
                            Your browser does not support the audio element: ${alt}
                        </audio>
                        ${title ? `<p class="audio-title">${self.renderInlineAsText(title, options, env)}</p>` : ''}
                    </div>`;
        return html;
    }

    // --- Markdown-it Ruleset --- 
    // Keep the text rule, remove the old image rule override
    markdownItRules() {
        const self = this;
        return {
            // Text rule for timestamps
            text: function (tokens, idx, options, env, slf) {
                const token = tokens[idx];
                // Updated regex to capture start time from single or range formats
                const timestampRegex = /\[(\d{2}:\d{2}:\d{2}\.\d{3})(?: --> \d{2}:\d{2}:\d{2}\.\d{3})?\]/g;
                
                // Check if the content *contains* the pattern. We need replace for multiple matches.
                if (timestampRegex.test(token.content)) {
                    const currentPlayerId = `audio-md-player-${audioCounter}`;
                    
                    // Use replace to handle multiple timestamps within the same text token
                    const renderedContent = token.content.replace(
                        timestampRegex,
                        (match, startTime) => { // startTime is the first captured group
                            logAudioPlugin(`Rendering timestamp: ${startTime} from match: ${match} for player ${currentPlayerId}`);
                            // Use startTime for data-time, but keep the original match text for display initially
                            return `<span class="timestamp" data-time="${startTime}" data-player-id="${currentPlayerId}">${match}</span>`;
                        }
                    );
                    return renderedContent; // Return the content with timestamp spans
                }

                // Fallback: If it wasn't a timestamp, return the original content.
                return token.content; 
            }
        };
    }

    // Helper to sanitize URLs (simple example)
    sanitizeUrl(url) {
        // Basic check: allow relative, http, https
        if (!url || /^(?:[a-zA-Z]+:)?\/\//.test(url) || /^[./]/.test(url)) {
             // A more robust sanitizer might be needed depending on security requirements
            return url; 
        }
        logAudioPlugin(`Blocked potentially unsafe URL: ${url}`, 'warn');
        return '#unsafe-url';
    }

    // Helper to guess audio type from src
    getAudioType(src) {
        const ext = src.split('.').pop().toLowerCase();
        switch (ext) {
            case 'mp3': return 'audio/mpeg';
            case 'm4a': return 'audio/mp4'; // Often used for AAC
            case 'ogg': return 'audio/ogg';
            case 'wav': return 'audio/wav';
            default: return 'audio/mpeg'; // Default guess
        }
    }
} 
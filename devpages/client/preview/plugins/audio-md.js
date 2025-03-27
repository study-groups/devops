/**
 * AudioMD Plugin
 * 
 * Adds support for audio timestamp links in markdown.
 * Example syntax: [00:45](#audio) will create a link that seeks to 45 seconds
 * in the associated audio player.
 */

import { logMessage } from '../../log/index.js';

export class AudioMDPlugin {
  constructor() {
    this.name = 'audioMD';
    this.initialized = false;
  }

  async init(options = {}) {
    try {
      // Initialize audio functionality
      this.initialized = true;
      logMessage('[PREVIEW] AudioMD plugin initialized');
      return true;
    } catch (error) {
      logMessage(`[PREVIEW ERROR] Failed to initialize AudioMD: ${error.message}`);
      return false;
    }
  }

  async preProcess(content) {
    // No pre-processing needed
    return content;
  }

  async postProcess(html, element) {
    if (!this.initialized) {
      return html;
    }

    try {
      // Process audio timestamps and setup players
      const audioElements = element.querySelectorAll('audio');
      audioElements.forEach(audio => {
        // Add your audio processing logic here
      });

      return html;
    } catch (error) {
      logMessage(`[PREVIEW ERROR] AudioMD postProcess error: ${error.message}`);
      return html;
    }
  }
}

// Plugin state
let audioPlayer = null;
let timestampLinks = [];
let config = {
  container: null,
  audioSelector: 'audio#main-audio',
  linkClass: 'audio-timestamp',
  activeClass: 'audio-timestamp-active',
  dataAttribute: 'data-timestamp',
  formatTimestamp: true,
  showDuration: true,
  autoScroll: true
};

/**
 * Parse timestamp string to seconds
 * @param {String} timestamp Timestamp string in format "HH:MM:SS" or "MM:SS"
 * @returns {Number} Time in seconds
 */
function parseTimestamp(timestamp) {
  try {
    if (!timestamp) return 0;
    
    // Handle various formats
    const parts = timestamp.split(':').map(p => parseInt(p, 10));
    
    if (parts.length === 3) {
      // Format: HH:MM:SS
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      // Format: MM:SS
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 1) {
      // Format: SS
      return parts[0];
    }
    
    return 0;
  } catch (error) {
    console.error('[PREVIEW ERROR] Failed to parse timestamp:', error);
    return 0;
  }
}

/**
 * Format seconds to timestamp string
 * @param {Number} seconds Time in seconds
 * @returns {String} Formatted timestamp
 */
function formatTimestamp(seconds) {
  if (isNaN(seconds)) return '00:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

/**
 * Custom renderer for links
 * @param {String} href Link URL
 * @param {String} title Link title
 * @param {String} text Link text
 * @returns {String|null} HTML string or null to use default renderer
 */
function linkRenderer(href, title, text) {
  // Check if this is an audio timestamp link
  if (href === '#audio') {
    // Assume the text contains the timestamp
    const timestamp = parseTimestamp(text);
    
    if (timestamp > 0 || text.match(/^00?:00?$/)) {
      return `<a href="#audio" 
        class="${config.linkClass}" 
        ${config.dataAttribute}="${timestamp}" 
        title="${title || `Jump to ${text}`}">
        ${text}
      </a>`;
    }
  }
  
  // Not an audio timestamp link
  return null;
}

/**
 * Initialize audio player functionality
 * @param {HTMLElement} container Container element
 */
function initAudioPlayer(container) {
  try {
    // Find audio player
    const player = container.querySelector(config.audioSelector) || 
                  document.querySelector(config.audioSelector);
    
    if (!player) {
      logMessage('[PREVIEW WARNING] Audio player not found');
      return;
    }
    
    audioPlayer = player;
    
    // Find all timestamp links
    timestampLinks = container.querySelectorAll(`.${config.linkClass}`);
    if (timestampLinks.length === 0) {
      return;
    }
    
    logMessage(`[PREVIEW] Found ${timestampLinks.length} audio timestamp links`);
    
    // Add event listener to audio player for time updates
    player.addEventListener('timeupdate', handleTimeUpdate);
    
    // Add click handlers to timestamp links
    timestampLinks.forEach(link => {
      link.addEventListener('click', handleTimestampClick);
    });
    
    // Fix for players that might not have controls
    if (!player.controls) {
      player.controls = true;
    }
  } catch (error) {
    logMessage(`[PREVIEW ERROR] Failed to initialize audio player: ${error.message}`);
    console.error('[PREVIEW ERROR] Audio player init:', error);
  }
}

/**
 * Handle audio player time updates
 * @param {Event} event Time update event
 */
function handleTimeUpdate(event) {
  try {
    if (!audioPlayer || timestampLinks.length === 0) return;
    
    const currentTime = audioPlayer.currentTime;
    let activeLink = null;
    
    // Find the most recent timestamp that's less than or equal to current time
    timestampLinks.forEach(link => {
      const timestamp = parseFloat(link.getAttribute(config.dataAttribute) || 0);
      
      // Remove active class from all links
      link.classList.remove(config.activeClass);
      
      // Check if this timestamp is active (current or most recent)
      if (timestamp <= currentTime) {
        if (!activeLink || timestamp > parseFloat(activeLink.getAttribute(config.dataAttribute) || 0)) {
          activeLink = link;
        }
      }
    });
    
    // Add active class to the active link
    if (activeLink) {
      activeLink.classList.add(config.activeClass);
      
      // Auto-scroll to the active timestamp if enabled
      if (config.autoScroll && activeLink.scrollIntoViewIfNeeded) {
        activeLink.scrollIntoViewIfNeeded({ behavior: 'smooth', block: 'nearest' });
      }
    }
  } catch (error) {
    console.error('[PREVIEW ERROR] Audio time update handler:', error);
  }
}

/**
 * Handle timestamp link clicks
 * @param {Event} event Click event
 */
function handleTimestampClick(event) {
  try {
    event.preventDefault();
    
    if (!audioPlayer) {
      // Try to find audio player again
      audioPlayer = document.querySelector(config.audioSelector);
      if (!audioPlayer) {
        logMessage('[PREVIEW WARNING] Audio player not found for timestamp click');
        return;
      }
    }
    
    // Get timestamp from data attribute
    const timestamp = parseFloat(event.currentTarget.getAttribute(config.dataAttribute) || 0);
    
    // Seek to timestamp
    audioPlayer.currentTime = timestamp;
    
    // Play if paused
    if (audioPlayer.paused) {
      audioPlayer.play().catch(error => {
        console.error('[PREVIEW ERROR] Failed to play audio:', error);
      });
    }
  } catch (error) {
    logMessage(`[PREVIEW ERROR] Failed to handle timestamp click: ${error.message}`);
    console.error('[PREVIEW ERROR] Timestamp click:', error);
  }
}

/**
 * Custom renderer for code blocks with audio metadata
 * @param {String} code Block content
 * @param {String} infostring Language info string
 * @returns {String|null} HTML string or null to use default renderer
 */
function codeRenderer(code, infostring) {
  // Only handle audio code blocks
  if (!infostring || !infostring.match(/^audio$/i)) {
    return null;
  }
  
  try {
    // Parse audio metadata (JSON format)
    let audioData;
    try {
      audioData = JSON.parse(code);
    } catch (parseError) {
      return `
        <div class="audio-error">
          <div class="audio-error-header">⚠️ Audio Metadata Error</div>
          <pre class="audio-error-message">Invalid JSON: ${parseError.message}</pre>
          <pre class="audio-error-code">${code}</pre>
        </div>
      `;
    }
    
    // Ensure required fields
    if (!audioData.src) {
      return `
        <div class="audio-error">
          <div class="audio-error-header">⚠️ Audio Metadata Error</div>
          <pre class="audio-error-message">Missing required field: src</pre>
        </div>
      `;
    }
    
    // Generate audio player HTML
    return `
      <div class="audio-player-container">
        <audio id="main-audio" controls src="${audioData.src}" 
          ${audioData.preload ? `preload="${audioData.preload}"` : 'preload="metadata"'}>
          Your browser does not support the audio element.
        </audio>
        ${audioData.title ? `<div class="audio-title">${audioData.title}</div>` : ''}
        ${audioData.description ? `<div class="audio-description">${audioData.description}</div>` : ''}
      </div>
    `;
  } catch (error) {
    logMessage(`[PREVIEW ERROR] Failed to render audio block: ${error.message}`);
    
    // Return error message
    return `
      <div class="audio-error">
        <div class="audio-error-header">⚠️ Audio Processing Error</div>
        <pre class="audio-error-message">${error.message}</pre>
      </div>
    `;
  }
}

// Export the plugin interface
export default {
  init,
  postProcess,
  renderers: {
    link: linkRenderer,
    code: codeRenderer
  }
}; 
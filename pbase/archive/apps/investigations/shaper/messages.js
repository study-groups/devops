const MessageTypes = {
    // State Changes
    SYNC_TOGGLE: 'SYNC_TOGGLE',
    SYNC_TO_SVG: 'SYNC_TO_SVG',
    SYNC_TO_CANVAS: 'SYNC_TO_CANVAS',
    
    // Updates
    UPDATE_SHAPE: 'UPDATE_SHAPE',
    RENDER_REQUEST: 'RENDER_REQUEST',
    TEXT_UPDATE: 'TEXT_UPDATE',
    
    // Animation
    START_ANIMATION: 'START_ANIMATION',
    ANIMATION_FRAME: 'ANIMATION_FRAME'
};

const DEBUG = {
    MESSAGES: false,
    ANIMATION: false,
    SYNC: true,
    RENDER: true
};

// Export for global use
window.MessageTypes = MessageTypes;
window.DEBUG = DEBUG; 
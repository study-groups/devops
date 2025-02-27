// Dark mode functionality
export function initializeDarkMode() {
    const toggle = document.getElementById('dark-mode-toggle');
    if (!toggle) return;
    
    // Check for saved preference
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
    }
    
    toggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const currentMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', currentMode);
        logMessage(`[THEME] Switched to ${currentMode ? 'dark' : 'light'} mode`);
    });
} 
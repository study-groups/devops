// Clear persisted panel state to ensure fresh dock configuration - paste in browser console

console.log('🧹 CLEARING PERSISTED PANEL STATE');
console.log('=================================');

// Clear the persisted panel state
const storageKey = 'devpages_redux_panels_state';
const oldState = localStorage.getItem(storageKey);

if (oldState) {
    console.log('📦 Found existing persisted state:', JSON.parse(oldState));
    localStorage.removeItem(storageKey);
    console.log('✅ Cleared persisted panel state');
} else {
    console.log('ℹ️ No persisted panel state found');
}

// Also clear any other panel-related storage
const keysToCheck = [
    'devpages_panels_state',
    'devpages_settings_panel_state',
    'devpages_debug_panel_state',
    'devpages_workspace_state'
];

keysToCheck.forEach(key => {
    if (localStorage.getItem(key)) {
        console.log(`🧹 Clearing ${key}`);
        localStorage.removeItem(key);
    }
});

console.log('\n🔄 REFRESH THE PAGE to see the clean dock configuration');
console.log('The editor and preview panels should now be properly assigned to their docks');

// Optionally reload the page automatically
const shouldReload = confirm('Clear complete! Reload the page now to apply changes?');
if (shouldReload) {
    window.location.reload();
}

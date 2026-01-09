// Run this in the browser console RIGHT NOW (before clearing localStorage)
// to see what the current broken state looks like

console.log('=== CURRENT STATE DIAGNOSTIC ===\n');

// 1. Check localStorage
console.log('1. LOCALSTORAGE:');
const rawUI = localStorage.getItem('devpages_ui');
console.log('  Raw devpages_ui:', rawUI);
if (rawUI) {
    try {
        const parsed = JSON.parse(rawUI);
        console.log('  Parsed:', parsed);
        console.log('  payload.logVisible:', parsed?.payload?.logVisible);
    } catch (e) {
        console.log('  Parse error:', e.message);
    }
}

// 2. Check Redux state
console.log('\n2. REDUX STATE:');
if (window.appStore) {
    const state = window.appStore.getState();
    console.log('  state.ui:', state.ui);
    console.log('  state.ui.logVisible:', state.ui?.logVisible);
    console.log('  Type:', typeof state.ui?.logVisible);
} else {
    console.log('  ❌ appStore not found');
}

// 3. Check DOM state
console.log('\n3. DOM STATE:');
const container = document.getElementById('log-container');
const button = document.getElementById('log-toggle-btn');

if (container) {
    console.log('  Container classes:', container.className);
    console.log('  Container computed height:', getComputedStyle(container).height);
    console.log('  Container computed visibility:', getComputedStyle(container).visibility);
    console.log('  Container computed opacity:', getComputedStyle(container).opacity);
} else {
    console.log('  ❌ log-container not found');
}

if (button) {
    console.log('  Button classes:', button.className);
    console.log('  Button has "active"?:', button.classList.contains('active'));
    console.log('  Button title:', button.title);
} else {
    console.log('  ❌ log-toggle-btn not found');
}

// 4. Check if there's a mismatch
console.log('\n4. MISMATCH DETECTION:');
if (window.appStore && container && button) {
    const reduxLogVisible = window.appStore.getState().ui?.logVisible;
    const containerHasVisible = container.classList.contains('log-visible');
    const containerHasHidden = container.classList.contains('log-hidden');
    const buttonIsActive = button.classList.contains('active');

    console.log('  Redux logVisible:', reduxLogVisible);
    console.log('  Container has log-visible class:', containerHasVisible);
    console.log('  Container has log-hidden class:', containerHasHidden);
    console.log('  Button is active:', buttonIsActive);

    // Analyze
    const reduxWantsVisible = reduxLogVisible === true;
    const reduxWantsHidden = reduxLogVisible === false;
    const reduxIsUndefined = reduxLogVisible === undefined;

    console.log('\n  ANALYSIS:');
    if (reduxIsUndefined) {
        console.log('  🔴 PROBLEM: Redux state.ui.logVisible is UNDEFINED!');
        console.log('     This means the default state is not being applied correctly.');
    }
    if (reduxWantsVisible && containerHasHidden) {
        console.log('  🔴 MISMATCH: Redux wants visible but container is hidden!');
    }
    if (reduxWantsHidden && containerHasVisible) {
        console.log('  🔴 MISMATCH: Redux wants hidden but container is visible!');
    }
    if (reduxWantsVisible && !buttonIsActive) {
        console.log('  🔴 MISMATCH: Redux wants visible but button is not active!');
    }
    if (reduxWantsHidden && buttonIsActive) {
        console.log('  🔴 MISMATCH: Redux wants hidden but button is active!');
    }
    if (buttonIsActive && containerHasHidden) {
        console.log('  🔴 VISUAL MISMATCH: Button shows active but log is hidden!');
        console.log('     This is the bug the user sees.');
    }
}

console.log('\n=== END DIAGNOSTIC ===');

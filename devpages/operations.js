// Fix the error at line 549, adding a null check before addEventListener
if (elementReference) {
    elementReference.addEventListener('click', handler);
} else {
    logMessage('[WARNING] Could not find element to attach event listener to');
} 
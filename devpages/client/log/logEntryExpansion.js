/**
 * Clean log entry expansion implementation
 */
export function expandLogEntry(logEntryDiv, logPanelInstance) {
    // Add the expanded class to trigger CSS styling
    logEntryDiv.classList.add('expanded');
}

export function collapseLogEntry(logEntryDiv, logPanelInstance) {
    // Remove the expanded class to return to normal view
    logEntryDiv.classList.remove('expanded');
}

import { logMessage } from "./utils.js";

export function setView(mode) {
    document.body.classList.remove('code-view', 'preview-view', 'split-view');
    document.body.classList.add(`${mode}-view`);
    logMessage(`View changed to ${mode}`);
}

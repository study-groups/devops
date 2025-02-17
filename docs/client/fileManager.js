import { logMessage } from "./utils.js";
import { updatePreview } from "./markdown.js";


export async function loadFiles() {
    try {
        console.log("Fetching file list from /api/files...");

        const response = await fetch('/api/files', { method: 'GET' });

        console.log("Response Status:", response.status);

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const files = await response.json();
        console.log("Loaded files:", files);

        if (!Array.isArray(files)) {
            throw new Error("Invalid response format");
        }

        const select = document.getElementById('file-select');
        select.innerHTML = '';

        files.forEach(file => {
            const option = document.createElement('option');
            option.value = file;
            option.textContent = file;
            select.appendChild(option);
        });

    } catch (error) {
        console.error("Error loading file list:", error);
    }
}


// Ensure function is called on page load
document.addEventListener('DOMContentLoaded', () => {
    loadFiles();
});



export async function loadFile(filename) {
    if (!filename) return;
    try {
        console.log(`Fetching file: ${filename}`);

        const response = await fetch(`/api/file?name=${encodeURIComponent(filename)}`);

        console.log(`Response Status: ${response.status}`);

        if (!response.ok) throw new Error(`Failed to load file: ${response.statusText}`);

        const text = await response.text();
        const editor = document.getElementById('md-editor');
        editor.value = text;
        updatePreview(text);

        logMessage(`Loaded file: ${filename}`);
    } catch (error) {
        logMessage(`Error loading file: ${error.message}`);
        console.error(error);
    }
}

export function saveFile() {
    const filename = document.getElementById('file-select').value;
    if (!filename) return;

    const content = document.getElementById('md-editor').value;
    fetch(`/api/save/${filename}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to save file');
        return response.text();
    })
    .then(() => logMessage(`Saved file: ${filename}`))
    .catch(error => logMessage(`Error saving file: ${error.message}`));
}

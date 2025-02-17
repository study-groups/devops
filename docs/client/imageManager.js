import { logMessage } from "./utils.js";
import { schedulePreviewUpdate } from "./markdown.js";

export async function uploadImage(file) {
    logMessage('Uploading image...');
    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch('/api/upload', { method: 'POST', body: formData });

        if (!response.ok) throw new Error(`Upload failed: ${await response.text()}`);

        const data = await response.json();
        if (!data.url) throw new Error('Invalid URL in response');

        const imageUrl = data.url.startsWith('/') ? data.url : `/${data.url}`;
        logMessage(`Uploaded file: ${imageUrl}`);

        // Insert Markdown
        const editor = document.getElementById('md-editor');
        const cursorPos = editor.selectionStart;
        const textBefore = editor.value.substring(0, cursorPos);
        const textAfter = editor.value.substring(cursorPos);
        editor.value = textBefore + `\n![](${imageUrl})\n` + textAfter;
        schedulePreviewUpdate();
    } catch (error) {
        logMessage(`Upload error: ${error.message}`);
        console.error('Upload error:', error);
    }
}

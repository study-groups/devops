export function logMessage(message) {
    const logDiv = document.getElementById('log');
    const timeStamp = new Date().toLocaleTimeString();
    logDiv.innerHTML += `[${timeStamp}] ${message}<br>`;
    logDiv.scrollTop = logDiv.scrollHeight;
}

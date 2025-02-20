export function logMessage(message) {
    const logDiv = document.getElementById('log');
    const timeStamp = new Date().toLocaleTimeString();
    const formattedMessage = `${timeStamp} ${message}`;
    
    // Add color coding based on message type
    let className = 'log-normal';
    if (message.includes('ERROR')) className = 'log-error';
    if (message.includes('WARN')) className = 'log-warning';
    if (message.includes('CONFIG')) className = 'log-config';
    
    logDiv.innerHTML += `<div class="${className}">${formattedMessage}</div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
}

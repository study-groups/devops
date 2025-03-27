export const showNotification = (message, type = 'info') => {
  // Create or use your notification system
  // Example using a simple toast notification
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Automatically remove after 5 seconds
  setTimeout(() => {
    toast.classList.add('fadeOut');
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 5000);
}; 
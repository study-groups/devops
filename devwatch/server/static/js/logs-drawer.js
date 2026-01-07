// Resizable System Logs Drawer
document.addEventListener('DOMContentLoaded', () => {
  const drawer = document.getElementById('logs-drawer');
  const iframe = document.getElementById('logs-drawer-iframe');
  const closeBtn = document.getElementById('logs-drawer-close');
  const resizer = document.getElementById('logs-drawer-resizer');
  if (!drawer || !iframe || !closeBtn || !resizer) return;

  try {
    const saved = localStorage.getItem('logs-drawer-height');
    if (saved) {
      drawer.style.height = saved;
      document.documentElement.style.setProperty('--logs-drawer-offset', saved);
    }
    const wasOpen = localStorage.getItem('logs-drawer-open');
    if (wasOpen === '1') {
      // Defer to ensure layout is ready
      setTimeout(() => openLogsDrawer(), 0);
    }
  } catch {}

  closeBtn.addEventListener('click', () => closeLogsDrawer());

  let dragging = false;
  let startY = 0;
  let startHeight = 0;
  
  // Prevent text selection during drag
  const preventSelection = (e) => {
    e.preventDefault();
    return false;
  };
  
  const onMove = (e) => {
    if (!dragging) return;
    e.preventDefault();
    e.stopPropagation();
    
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaY = startY - clientY; // Invert so dragging up increases height
    const viewport = window.innerHeight;
    const newHeight = startHeight + deltaY;
    
    // Apply constraints
    const min = viewport * 0.15;
    const max = viewport * 0.9;
    const h = Math.min(Math.max(newHeight, min), max);
    
    drawer.style.height = h + 'px';
    document.documentElement.style.setProperty('--logs-drawer-offset', h + 'px');
  };
  
  const onEnd = (e) => {
    if (!dragging) return;
    dragging = false;
    
    // Remove all event listeners
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mouseup', onEnd, true);
    window.removeEventListener('mouseleave', onEnd, true);
    document.removeEventListener('touchmove', onMove, true);
    document.removeEventListener('touchend', onEnd, true);
    document.removeEventListener('touchcancel', onEnd, true);
    document.removeEventListener('selectstart', preventSelection, true);
    document.removeEventListener('dragstart', preventSelection, true);
    
    // Remove resizing class to restore normal behavior
    document.body.classList.remove('resizing');
    
    // Save the height
    try { localStorage.setItem('logs-drawer-height', drawer.style.height); } catch {}
  };
  
  const onStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragging = true;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startHeight = parseInt(getComputedStyle(drawer).height, 10);
    
    // Add resizing class for global style control
    document.body.classList.add('resizing');
    
    // Add event listeners - use window for mouse events to catch all movement
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onEnd, true);
    window.addEventListener('mouseleave', onEnd, true); // Only trigger on window leave, not element leave
    document.addEventListener('touchmove', onMove, { passive: false, capture: true });
    document.addEventListener('touchend', onEnd, true);
    document.addEventListener('touchcancel', onEnd, true);
    document.addEventListener('selectstart', preventSelection, true);
    document.addEventListener('dragstart', preventSelection, true);
  };
  resizer.addEventListener('mousedown', onStart);
  resizer.addEventListener('touchstart', onStart, { passive: false });
});

function openLogsDrawer() {
  const drawer = document.getElementById('logs-drawer');
  const iframe = document.getElementById('logs-drawer-iframe');
  if (!drawer || !iframe) return;
  if (!drawer.classList.contains('open')) {
    if (!drawer.style.height) drawer.style.height = '40vh';
    drawer.classList.add('open');
    drawer.removeAttribute('aria-hidden');
    iframe.src = '/static/log-viewer.html?sources=server,monitor';
    document.body.classList.add('logs-drawer-open');
    const height = drawer.style.height || '40vh';
    document.documentElement.style.setProperty('--logs-drawer-offset', height);
    try { localStorage.setItem('logs-drawer-open', '1'); } catch {}
  }
}

function closeLogsDrawer() {
  const drawer = document.getElementById('logs-drawer');
  const iframe = document.getElementById('logs-drawer-iframe');
  if (!drawer || !iframe) return;
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  iframe.src = 'about:blank';
  document.body.classList.remove('logs-drawer-open');
  try { localStorage.setItem('logs-drawer-open', '0'); } catch {}
}

window.openLogsDrawer = openLogsDrawer;
window.closeLogsDrawer = closeLogsDrawer;



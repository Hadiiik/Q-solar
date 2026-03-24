document.addEventListener('contextmenu', handleContextMenu);
    if (typeof navigator.serviceWorker !== 'undefined') {
    navigator.serviceWorker.register('sw.js')
  }

// Preload commonly used APIs
const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

// Cache commonly used DOM queries
window.addEventListener('DOMContentLoaded', () => {
  // Pre-connect to required domains
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = 'https://cdn.quilljs.com';
  document.head.appendChild(link);
});

// Expose protected methods that allow the renderer process to use IPC
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel, data) => {
      ipcRenderer.send(channel, data);
    },
    on: (channel, func) => {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  }
});
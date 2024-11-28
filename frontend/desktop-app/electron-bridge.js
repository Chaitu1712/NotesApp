
// Safely initialize electron bridge
if (window.require) {
    window.electron = require('electron');
} else {
    window.electron = null;
}
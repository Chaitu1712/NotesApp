const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const axios = require('axios');
const { initQuill } = require('./quill-init');

// Add API configuration
const API_CONFIG = {
    development: 'https://notesapp-jfne.onrender.com',
    production: 'https://notesapp-jfne.onrender.com',
    staging: 'https://notesapp-jfne.onrender.com'
};

const ENV = process.env.NODE_ENV || 'development';
const API_URL = API_CONFIG[ENV];

// Configure axios defaults
axios.defaults.baseURL = API_URL;
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
axios.defaults.timeout = 10000;

// Add security interceptors
axios.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`; 
    }
    return config;
}, error => Promise.reject(error));

axios.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            ipcRenderer.send('unauthorized');
        }
        return Promise.reject(error);
    }
);

let floatingQuill;
let currentNoteId = null;
let autoSaveTimeout;
let lastKnownContent = '';
let isLocalChange = false;
const now = new Date().toLocaleTimeString();
// Add auto-save function
function startAutoSave() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(saveNewNote, 800);  // Faster auto-save for better responsiveness
}

// ...existing code...

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Quill first before adding listeners
    floatingQuill = initQuill('#floating-quill', {
        toolbar: [
            ['bold', 'italic','underline'],
            [{ 'list': 'ordered'}],
            [{'color':[]}],
            ['clean']
        ]
    });
    
    // Set initial content for new notes
    if (!currentNoteId) {
        document.querySelector('.drag-handle').textContent = `Quick Note ${now}`;
        floatingQuill.setText('Start typing your note here...');
        const titleInput = document.getElementById('floating-note-title');
        titleInput.setAttribute('placeholder', `Quick Note ${now}`);
    }

    // Now add Quill text-change listener
    floatingQuill.on('text-change', () => {
        isLocalChange = true;
        startAutoSave();
    });

    // Apply custom scrollbar styles
    const quillEditor = document.querySelector('.ql-editor');
    quillEditor.style.overflowY = 'auto';
    quillEditor.style.scrollbarWidth = 'thin';
    quillEditor.style.scrollbarColor = 'rgba(250, 248, 115, 0.95)  rgba(250, 248, 115, 0.95)';

    const style = document.createElement('style');
    style.innerHTML = `
        .ql-editor::-webkit-scrollbar {
            width: 8px;
        }
        .ql-editor::-webkit-scrollbar-track {
            background: #818025f2;
            border-radius: 4px;
        }
        .ql-editor::-webkit-scrollbar-thumb {
            background: #faf873f2;
            border-radius: 4px;
        }
    `;
    document.head.appendChild(style);

    // Add other event listeners
    // ...existing code...
});

// ...existing code...

document.addEventListener('DOMContentLoaded', () => {
    // Use direct ipcRenderer calls
    document.getElementById('minimize-btn').addEventListener('click', () => {
        ipcRenderer.send('minimize-floating-note');
    });

    document.getElementById('move-to-main-btn').addEventListener('click', () => {
        if (currentNoteId) {
            // Send current note data to main window
            ipcRenderer.send('move-to-main', {
                id: currentNoteId,
                title: document.getElementById('floating-note-title').value,
                content: floatingQuill.root.innerHTML
            });
            // Close this window
            ipcRenderer.send('close-floating-note');
        }
    });

    document.getElementById('close-btn').addEventListener('click', () => {
        ipcRenderer.send('close-floating-note');
    });

    document.getElementById('save-note-btn').addEventListener('click', saveNewNote);

    // Add title change listener
    document.getElementById('floating-note-title').addEventListener('input', (e) => {
        const title = e.target.value || 'Quick Note';
        document.querySelector('.drag-handle').textContent = title;
        startAutoSave();
    });

    // Add listener for loading notes
    ipcRenderer.on('load-note', (event, note) => {
        clearTimeout(autoSaveTimeout); // Clear any pending auto-saves
        currentNoteId = note.id;
        const title = note.title || 'Quick Note';
        document.getElementById('floating-note-title').value = title;
        document.querySelector('.drag-handle').textContent = title;
        floatingQuill.root.innerHTML = note.content || '';
        document.getElementById('save-note-btn').textContent = 'Update Note';
        lastKnownContent = note.content || '';
    });

    // Add window focus/blur handlers
    ipcRenderer.on('window-blur', () => {
        document.getElementById('floating-editor').classList.add('translucent');
    });

    ipcRenderer.on('window-focus', () => {
        document.getElementById('floating-editor').classList.remove('translucent');
    });

    // Add focus handler for syncing
    window.addEventListener('focus', async () => {
        if (!currentNoteId) return;
        
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/notes/${currentNoteId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const remoteNote = response.data;
            if (remoteNote.content !== lastKnownContent) {
                lastKnownContent = remoteNote.content;
                floatingQuill.root.innerHTML = remoteNote.content;
                document.getElementById('floating-note-title').value = remoteNote.title;
            }
        } catch (error) {
            console.error('Failed to sync note:', error);
        }
    });
});

async function saveNewNote() {
    isLocalChange = true;
    clearTimeout(autoSaveTimeout);  // Clear pending auto-saves
    const content = floatingQuill.root.innerHTML;
    const title = document.getElementById('floating-note-title').value;
    const token = localStorage.getItem('token');
    
    try {
        if (currentNoteId) {
            // Update existing note
            await axios.put(
                `${API_URL}/notes/${currentNoteId}`,
                { content, title: title || `Quick Note ${now}` },
                { headers: { 'Authorization': `Bearer ${token}` }}
            );
        } else {
            // Create new note
            const response = await axios.post(
                `${API_URL}/notes`,
                { content, title: title || `Quick Note ${now}` },
                { headers: { 'Authorization': `Bearer ${token}` }}
            );
            // Update currentNoteId with the new note's ID
            currentNoteId = response.data.id;
            document.getElementById('save-note-btn').textContent = 'Update Note';
        }
        
        lastKnownContent = content;
        // Just notify main window to refresh its list
        ipcRenderer.send('note-saved');
    } catch (error) {
        console.error('Failed to save note:', error);
    }
}

// Clean up auto-save when window closes
window.addEventListener('beforeunload', () => {
    clearTimeout(autoSaveTimeout);
});
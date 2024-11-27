const axios = require('axios');
const API_URL = 'http://localhost:3000';
let quill = null;
let currentNote = null;
let quillLoaded = false;
let ignoreNextQuillChange = false;
let syncInterval;
let lastKnownContent = '';
let isLocalChange = false;

// Add these utility functions at the top after the variables
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.className = 'toast', 3000);
}

function showSavingIndicator() {
    document.getElementById('saving-indicator').className = 'saving-indicator show';
}

function hideSavingIndicator() {
    document.getElementById('saving-indicator').className = 'saving-indicator';
}

// Add session check functionality
function checkSession() {
    const token = localStorage.getItem('token');
    const loginTime = localStorage.getItem('loginTime');
    const email = localStorage.getItem('email');
    
    if (token && loginTime && email) {
        const currentTime = new Date().getTime();
        const thirtyDays = 720 * 3600* 1000; // 30 days in milliseconds
        
        if (currentTime - parseInt(loginTime) < thirtyDays) {
            document.getElementById('user-email').textContent = email.split('@')[0];
            document.getElementById('notes-container').style.display = 'flex';
            document.getElementById('login-container').style.display = 'none';
            loadNotes();
            return;
        }
    }
    logout();
}

// Remove Quill initialization from DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    checkSession();

    if (window.electron) {
        window.electron.ipcRenderer.on('note-saved', () => {
            loadNotes();
        });
    }
});

// Update login function
async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginLoader = document.getElementById('login-loader');
    loginLoader.style.display = 'block';

    try {
        const response = await axios.post(`${API_URL}/auth/login`, {
            email,
            password
        });
        
        const loginTime = new Date().getTime();
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('loginTime', loginTime);
        localStorage.setItem('email', email);
        showNotesContainer();
        showToast('Login successful!');
    } catch (error) {
        showToast('Login failed', 'error');
    } finally {
        loginLoader.style.display = 'none';
    }
}

async function showNotesContainer() {
    try {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('notes-container').style.display = 'flex';
        document.getElementById('user-email').textContent = localStorage.getItem('email').split('@')[0];
        await loadNotes();
    } catch (error) {
        showToast('Failed to load notes', 'error');
    }
}

async function loadNotes() {
    try {
        const response = await axios.get(`${API_URL}/notes`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        displayNotes(response.data);
    } catch (error) {
        showToast('Failed to load notes', 'error');
    }
}

function createFloatingNote() {
    if (window.electron) {
        window.electron.ipcRenderer.send('create-floating-note');
    }
}

// Update logout to show placeholder
function logout() {
    clearInterval(syncInterval);
    localStorage.removeItem('token');
    localStorage.removeItem('loginTime');
    localStorage.removeItem('email');
    document.getElementById('notes-container').style.display = 'none';
    document.getElementById('login-container').style.display = 'block';
    currentNote = null;
    if (quill) {
        quill.setText('');
    }
    closeEditor();
    document.getElementById('placeholder').style.display = 'flex';
}

async function deleteNote(id, event) {
    if (event) {
        event.stopPropagation(); // Prevent note selection when clicking delete
    }
    
    if (!confirm('Are you sure you want to delete this note?')) return;
    
    try {
        await axios.delete(
            `${API_URL}/notes/${id}`,
            { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }}
        );
        
        if (currentNote && currentNote.id === id) {
            closeEditor();
        }
        
        showToast('Note deleted successfully');
        await loadNotes();
    } catch (error) {
        if (error.response && error.response.status === 404) {
            // Note was already deleted, just refresh the UI
            showToast('Note deleted successfully');
            await loadNotes();
        } else {
            showToast('Failed to delete note', 'error');
            console.error('Delete error:', error);
        }
    }
}

function displayNotes(notes) {
    const notesList = document.getElementById('notes-list');
    notesList.innerHTML = '';
    
    notes.forEach(note => {
        const noteElement = document.createElement('div');
        noteElement.className = 'note-item';
        noteElement.innerHTML = `
            <span>${note.title || 'Untitled'}</span>
            <div class="note-actions">
                <button onclick="openInFloating(${JSON.stringify(note).replace(/"/g, '&quot;')})">Float</button>
                <button onclick="event.stopPropagation(); deleteNote(${note.id}, event)">Delete</button>
            </div>
        `;
        noteElement.addEventListener('click', () => selectNote(note));
        notesList.appendChild(noteElement);
    });
}

function openInFloating(note) {
    event.stopPropagation(); // Prevent note selection
    if (window.electron) {
        // Always create a new floating note window
        window.electron.ipcRenderer.send('create-floating-note', note);
    }
}

// Update selectNote to handle editor visibility and start polling
async function selectNote(note) {
    if (!quillLoaded) {
        await loadQuill();
    }

    clearInterval(syncInterval);
    currentNote = note;
    document.getElementById('placeholder').style.display = 'none';
    document.getElementById('editor').style.display = 'flex';
    document.getElementById('note-title').value = note.title || 'Untitled';
    if (quill) {
        quill.root.innerHTML = note.content || '<p><br></p>';
        lastKnownContent = note.content || '';
        syncInterval = setInterval(checkForUpdates, 5000);
    }
}

// Update createNote to handle operations in the correct order
async function createNote() {
    try {
        if (!quillLoaded) {
            await loadQuill();
        }
        const response = await axios.post(`${API_URL}/notes`, 
            { 
                content: '<p>Note Body Here</p>', 
                title: 'New Note' 
            },
            { 
                headers: { 
                    'Authorization': `Bearer ${localStorage.getItem('token')}` 
                }
            }
        );
        
        // Use the complete note object directly from the response
        const newNote = response.data;
        await selectNote(newNote);
        await loadNotes();
        
    } catch (error) {
        showToast('Failed to create note', 'error');
    }
}

// Update saveNote to check for quill and track content
async function saveNote() {
    if (!currentNote || !quill) return;
    
    isLocalChange = true;
    const content = quill.root.innerHTML;
    const title = document.getElementById('note-title').value;
    try {
        await axios.put(
            `${API_URL}/notes/${currentNote.id}`,
            { content, title: title || 'Untitled' },
            { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }}
        );
        lastKnownContent = content;
        await loadNotes();
    } catch (error) {
        alert('Failed to save note');
    }
}

// Auto-save functionality
let autoSaveTimeout;

// Add auto-save for title changes
document.getElementById('note-title').addEventListener('input', () => {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(saveNote, 1000);
});

function showRegister() {
    document.getElementById('register-modal').style.display = 'block';
}

function hideRegister() {
    document.getElementById('register-modal').style.display = 'none';
}

async function register() {
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    try {
        const response = await axios.post(`${API_URL}/auth/register`, {
            email,
            password
        });
        
        hideRegister();
        alert('Registration successful! Please login.');
    } catch (error) {
        alert('Registration failed: ' + (error.response?.data?.message || error.message));
    }
}

// Close modal if clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('register-modal');
    if (event.target === modal) {
        hideRegister();
    }
}

// Add sync function
async function checkForUpdates() {
    if (!currentNote || !quill || isLocalChange) {
        isLocalChange = false;
        return;
    }

    try {
        const response = await axios.get(`${API_URL}/notes/${currentNote.id}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        const remoteNote = response.data;
        if (remoteNote.content !== lastKnownContent) {
            lastKnownContent = remoteNote.content;
            quill.root.innerHTML = remoteNote.content;
            document.getElementById('note-title').value = remoteNote.title;
        }
    } catch (error) {
        console.error('Failed to sync note:', error);
    }
}

async function loadQuill() {
    if (quillLoaded) return;
    
    // Load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.quilljs.com/1.3.6/quill.snow.css';
    document.head.appendChild(link);
    
    // Load JS
    await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.quilljs.com/1.3.6/quill.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });

    // Initialize Quill
    quill = new Quill('#quill-editor', {
        theme: 'snow',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline', 'strike'],
                ['blockquote', 'code-block'],
                [{ 'header': 1 }, { 'header': 2 }],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'color': [] }, { 'background': [] }],
                ['clean']
            ]
        }
    });

    // Set up auto-save and mark local changes
    quill.on('text-change', () => {
        isLocalChange = true;
        clearTimeout(autoSaveTimeout);
        showSavingIndicator();
        autoSaveTimeout = setTimeout(() => {
            saveNote().then(() => {
                hideSavingIndicator();
            });
        }, 1000);
    });

    quillLoaded = true;
}

// Update closeEditor to clear interval
function closeEditor() {
    clearInterval(syncInterval);
    document.getElementById('editor').style.display = 'none';
    document.getElementById('placeholder').style.display = 'flex';
    currentNote = null;
}
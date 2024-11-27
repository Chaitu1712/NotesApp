const { ipcRenderer } = require('electron');
const axios = require('axios');
const API_URL = 'http://localhost:3000';

let floatingQuill;
let currentNoteId = null;

document.addEventListener('DOMContentLoaded', () => {
    floatingQuill = new Quill('#floating-quill', {
        theme: 'snow',
        modules: {
            toolbar: [
                ['bold', 'italic'],
                ['clean']
            ]
        }
    });

    document.getElementById('minimize-btn').addEventListener('click', () => {
        ipcRenderer.send('minimize-floating-note');
    });

    document.getElementById('close-btn').addEventListener('click', () => {
        ipcRenderer.send('close-floating-note');
    });

    document.getElementById('save-note-btn').addEventListener('click', saveNewNote);

    // Add listener for loading notes
    ipcRenderer.on('load-note', (event, note) => {
        currentNoteId = note.id;
        document.getElementById('floating-note-title').value = note.title || '';
        floatingQuill.root.innerHTML = note.content || '';
        document.getElementById('save-note-btn').textContent = 'Update Note';
    });
});

async function saveNewNote() {
    const content = floatingQuill.root.innerHTML;
    const title = document.getElementById('floating-note-title').value;
    const token = localStorage.getItem('token');
    
    try {
        if (currentNoteId) {
            // Update existing note
            await axios.put(
                `${API_URL}/notes/${currentNoteId}`,
                { content, title: title || 'Quick Note' },
                { headers: { 'Authorization': `Bearer ${token}` }}
            );
        } else {
            // Create new note
            await axios.post(
                `${API_URL}/notes`,
                { content, title: title || 'Quick Note' },
                { headers: { 'Authorization': `Bearer ${token}` }}
            );
        }
        
        floatingQuill.setText('');
        document.getElementById('floating-note-title').value = '';
        document.getElementById('save-note-btn').textContent = 'Save';
        currentNoteId = null;
        ipcRenderer.send('note-saved');
    } catch (error) {
        console.error('Failed to save note:', error);
    }
}
const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all notes for the logged-in user
router.get('/', authenticateToken, async (req, res) => {
    const pool = req.pool;

    try {
        const result = await pool.query('SELECT * FROM notes WHERE user_id = $1', [req.user.userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch notes', details: err });
    }
});

// Add single note fetch endpoint
router.get('/:id', authenticateToken, async (req, res) => {
    const noteId = req.params.id;
    const pool = req.pool;

    try {
        // Verify note ownership and get note
        const result = await pool.query(
            'SELECT * FROM notes WHERE id = $1 AND user_id = $2',
            [noteId, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch note', details: err });
    }
});

// Create a new note
router.post('/', authenticateToken, async (req, res) => {
    const { title, content } = req.body;
    
    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
    }

    if (title.length > 255) {
        return res.status(400).json({ error: 'Title too long (max 255 characters)' });
    }

    const pool = req.pool;

    try {
        const result = await pool.query(
            'INSERT INTO notes (user_id, title, content) VALUES ($1, $2, $3) RETURNING id, title, content, created_at, updated_at',
            [req.user.userId, title, content]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create note', details: err });
    }
});

// Update a note
router.put('/:id', authenticateToken, async (req, res) => {
    const { title, content } = req.body;
    const noteId = req.params.id;
    const pool = req.pool;

    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
    }

    if (title.length > 255) {
        return res.status(400).json({ error: 'Title too long (max 255 characters)' });
    }

    try {
        // Verify note ownership
        const noteCheck = await pool.query(
            'SELECT user_id FROM notes WHERE id = $1',
            [noteId]
        );

        if (noteCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        if (noteCheck.rows[0].user_id !== req.user.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Update note and return updated data
        const result = await pool.query(
            'UPDATE notes SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING *',
            [title, content, noteId, req.user.userId]
        );

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update note', details: err });
    }
});

// Delete a note
router.delete('/:id', authenticateToken, async (req, res) => {
    const noteId = req.params.id;
    const pool = req.pool;

    try {
        // Verify note ownership
        const noteCheck = await pool.query(
            'SELECT user_id FROM notes WHERE id = $1',
            [noteId]
        );

        if (noteCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        if (noteCheck.rows[0].user_id !== req.user.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Delete note
        await pool.query(
            'DELETE FROM notes WHERE id = $1 AND user_id = $2',
            [noteId, req.user.userId]
        );

        res.json({ message: 'Note deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete note', details: err });
    }
});

module.exports = router;

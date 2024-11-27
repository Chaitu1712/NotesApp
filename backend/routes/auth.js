const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Register a new user
router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const pool = req.pool;

    try {
        const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
            [email, hash]
        );
        res.status(201).json({ userId: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: 'Registration failed', details: err });
    }
});

// Login a user
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const pool = req.pool;

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const user = result.rows[0];
        const isValid = await bcrypt.compare(password, user.password_hash);

        if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ token });
    } catch (err) {
        res.status(500).json({ error: 'Login failed', details: err });
    }
});

module.exports = router;
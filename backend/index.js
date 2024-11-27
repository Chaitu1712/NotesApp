const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const notesRoutes = require('./routes/noteRoutes');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Test database connection
pool.query('SELECT NOW()', (err) => {
    if (err) {
        console.error('Database connection failed:', err);
        process.exit(1);
    }
    console.log('Database connected successfully');
});

// Pass pool to routes
app.use((req, res, next) => {
    req.pool = pool;
    next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/notes', notesRoutes);

app.get('/', (req, res) => res.send('API is running'));

// Start server
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));

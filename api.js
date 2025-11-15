const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'database.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error connecting to SQLite database:', err.message);
    } else {
        console.log('Connected to the SQLite database from api.js.');
    }
});

router.get('/check-codes', (req, res) => {
    db.all(`SELECT id, code, status, email, last_play_date, daily_plays FROM codes`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});


router.get('/test', (req, res) => {
    res.send('test');
});

module.exports = router;
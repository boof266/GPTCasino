const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
const port = 3001;

app.use(express.static(__dirname)); // Serve static files from the current directory
app.use(bodyParser.json());
app.use(cors({
    origin: 'http://localhost:3000', // Allow frontend origin
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Database connection
const db = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root', // Replace with your MySQL username
    password: 'root', // Replace with your MySQL password
    database: 'gptcasino'
});

// First, connect without specifying database to check if it exists
const adminDb = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'root'
});

adminDb.connect(async (err) => {
    if (err) {
        console.error('MySQL connection error:', err);
        process.exit(1);
    }

    // Check if database exists
    adminDb.query("SHOW DATABASES LIKE 'gptcasino'", async (err, results) => {
        if (err || results.length === 0) {
            console.error('Database gptcasino does not exist. Creating it...');
            await adminDb.promise().query('CREATE DATABASE gptcasino');
            console.log('Database gptcasino created');
        }

        // Now connect to the specific database
        db.connect((err) => {
            if (err) {
                console.error('Database connection error:', err);
                process.exit(1);
            }
            console.log('Connected to gptcasino database');
            
            // Verify users table exists
            db.query("SHOW TABLES LIKE 'users'", (err, results) => {
                if (err || results.length === 0) {
                    console.error('Users table does not exist. Creating it...');
                    // Run database setup
                    const fs = require('fs');
                    const sql = fs.readFileSync('./database_setup.sql').toString();
                    db.query(sql, (err) => {
                        if (err) {
                            console.error('Error creating tables:', err);
                            process.exit(1);
                        }
                        console.log('Database tables created successfully');
                    });
                }
            });
        });
    });
});

// User Registration
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        // Check if user exists
        const [existingUser] = await db.promise().query(
            'SELECT * FROM users WHERE username = ?', 
            [username]
        );
        
        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Validate password length
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        if (!hashedPassword) {
            throw new Error('Password hashing failed');
        }

        // Create new user
        const [result] = await db.promise().query(
            'INSERT INTO users (username, password_hash, balance) VALUES (?, ?, 100)',
            [username, hashedPassword]
        );

        console.log('User created with ID:', result.insertId);
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// User Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Find user
        const [users] = await db.promise().query(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];

        // Check password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Return user data (excluding password)
        const userData = {
            id: user.id,
            username: user.username,
            balance: user.balance
        };

        res.json(userData);
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get User Balance
app.get('/api/balance/:userId', async (req, res) => {
    const userId = req.params.userId;

    try {
        const [rows] = await db.promise().query(
            'SELECT balance FROM users WHERE id = ?',
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ balance: rows[0].balance });
    } catch (error) {
        console.error('Balance retrieval error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update Balance
app.post('/api/update-balance', async (req, res) => {
    const { userId, amount } = req.body;

    try {
        // Get current balance
        const [rows] = await db.promise().query(
            'SELECT balance FROM users WHERE id = ?',
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const currentBalance = parseFloat(rows[0].balance); // Ensure currentBalance is a number
        const parsedAmount = parseFloat(amount); // Ensure amount is a number
        const newBalance = parseFloat((currentBalance + parsedAmount).toFixed(2)); // Ensure balance is a valid decimal

        // Prevent negative balance
        if (newBalance < 0) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        await db.promise().query(
            'UPDATE users SET balance = ? WHERE id = ?',
            [newBalance, userId]
        );

        console.log(`Updated balance for user ID ${userId}: ${newBalance}`); // Log the updated balance

        res.json({ message: 'Balance updated successfully', newBalance });
    } catch (error) {
        console.error('Balance update error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Log Transaction
app.post('/api/log-transaction', async (req, res) => {
    const { userId, amount, type } = req.body; // Change 'result' to 'type'

    try {
        await db.promise().query(
            'INSERT INTO transactions (user_id, amount, type) VALUES (?, ?, ?)', // Update query to use 'type'
            [userId, amount, type]
        );

        res.json({ message: 'Transaction logged successfully' });
    } catch (error) {
        console.error('Transaction logging error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
    // Clear user session/token
    res.json({ message: 'Logged out successfully' });
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

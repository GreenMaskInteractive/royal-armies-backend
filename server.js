const express = require('express');
const Datastore = require('nedb');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const db = new Datastore({ 
    // If running on Render, use the disk path; otherwise use local for your PC
    filename: process.env.RENDER ? '/data/players.db' : 'players.db', 
    autoload: true 
});

// --- DATABASE & SESSION SETUP ---
const db = new Datastore({ filename: './players.db', autoload: true });
app.use(express.json());
app.use(express.static('public')); // Serves your HTML, CSS, JS
app.use(session({
    secret: 'crown-hall-secret-key',
    resave: false,
    saveUninitialized: false
}));

// --- EXISTING ENGINE REQUIREMENTS ---
// Ensure these files exist in your /backend folder!
const { resolveBattle } = require('./battle-engine'); 
const { generateRankedSimulation } = require('./training-sim');
const { groundRanks } = require('./rank-data');

// --- AUTHENTICATION ROUTES ---

// REGISTER: Forging a new account
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    db.findOne({ username }, async (err, user) => {
        if (user) return res.status(400).json({ msg: "Commander name already taken." });
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const newPlayer = { 
            username, 
            password: hashedPassword,
            rank: 1, 
            gold: 1000, 
            xp: 0 
        };
        
        db.insert(newPlayer, (err) => {
            res.json({ msg: "Account forged. You may now enter the gates." });
        });
    });
});

// LOGIN: Entering the gates
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.findOne({ username }, async (err, user) => {
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ msg: "Invalid credentials, traveler." });
        }
        req.session.userId = user._id;
        res.json({ msg: "Welcome back, Commander.", user });
    });
});

// --- EXISTING GAME ROUTES ---

app.get('/get-rank-data', (req, res) => {
    res.json(groundRanks);
});

app.get('/test-sim', (req, res) => {
    const sim = generateRankedSimulation(1);
    res.json(sim);
});

// Root Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Kingdom Server online at http://localhost:${PORT}`);
});
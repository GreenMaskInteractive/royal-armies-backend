const express = require('express');
const Datastore = require('nedb');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
let activeClients = [];

const db = new Datastore({ 
    // If running on Render, use the disk path; otherwise use local for your PC
    filename: process.env.RENDER ? '/data/players.db' : 'players.db', 
    autoload: true 
});

// --- DATABASE & SESSION SETUP ---
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

app.post('/register', async (req, res) => {
    const { username, password, email } = req.body;
    
    // 1. Create a secret token for this player
    const verificationToken = Math.random().toString(36).substring(2, 15);

    const newUser = { 
        username, 
        password: await bcrypt.hash(password, 10), 
        email, 
        isVerified: false, // Locked until they click the email
        verificationToken,
        gold: 100,
        rank: 'Novice'
    };

    db.insert(newUser, async (err, user) => {
        try {
            // 2. Send the actual email
            await resend.emails.send({
                from: 'The Watchtower <onboarding@resend.dev>',
                to: [email],
                subject: 'Forge Your Account, Commander',
                html: `<p>Commander, click here to verify your rank: <a href="https://royalarmies.com{verificationToken}">Verify Account</a></p>`
            });
            res.json({ msg: "Registration successful! Check your email to verify." });
        } catch (mailError) {
            console.log(mailError);
            res.status(500).json({ msg: "Account forged, but the messenger pigeon failed. Try again!" });
        }
    });
});

// LOGIN: Entering the gates
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.findOne({ username }, async (err, user) => {
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ msg: "Invalid credentials, traveler." });
        }
        
        // --- ADD THIS CHECK ---
        // This prevents unverified players from entering
        if (user.isVerified === false) {
            return res.status(400).json({ msg: "Commander, you must verify your email before entering the field." });
        }

        req.session.userId = user._id;
        res.json({ msg: "Welcome back, Commander.", user });
    });
}); // This }); closes the Login route properly.

// --- THE VERIFY GATE (Sitting outside on its own) ---
app.get('/verify', (req, res) => {
    const token = req.query.token;
    db.update({ verificationToken: token }, { $set: { isVerified: true } }, {}, (err) => {
        if (err) return res.send("Verification failed.");

        activeClients.forEach(client => {
            client.res.write(`data: ${JSON.stringify({ verified: true })}\n\n`);
        });

        res.send("<h1>Verified!</h1><p>You can close this tab and return to the game.</p>");
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

app.get('/listen-for-verify', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const clientId = Date.now();
    const newClient = { id: clientId, res };
    activeClients.push(newClient);

    req.on('close', () => {
        activeClients = activeClients.filter(c => c.id !== clientId);
    });
});


// Root Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Kingdom Server online at http://localhost:${PORT}`);
});
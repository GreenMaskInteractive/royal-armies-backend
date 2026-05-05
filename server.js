const express = require('express');
const Datastore = require('@seald-io/nedb');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

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
// const { resolveBattle } = require('./battle-engine'); 
// const { generateRankedSimulation } = require('./training-sim'); 
// const { groundRanks } = require('./public/rank-data'); 

// --- AUTHENTICATION ROUTES ---

app.post('/register', async (req, res) => {
    // 1. Clean the username
    const username = req.body.username.trim().toLowerCase();
    const { password, email } = req.body;
    
    // 2. Hash the password and create token
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = Math.random().toString(36).substring(2, 15);

    const newUser = { 
        username, 
        password: hashedPassword, 
        email, 
        isVerified: false, 
        verificationToken, 
        gold: 100, 
        rank: 'Novice' 
    };

    // 3. Insert into Database AND send email in one go
    db.insert(newUser, async (err, user) => {
    if (err) {
        // --- ADD THIS LOG TO SEE THE TRUTH ---
        console.error("DATABASE INSERT ERROR:", err);
        return res.status(500).json({ msg: "Forge failed." });
    }

        try {
            await resend.emails.send({
                from: 'Royal Armies <noreply@royalarmies.com>',
                to: [email],
                subject: 'Forge Your Account',
                html: `<p>Commander, click here to verify your rank: <a href="https://royalarmies.com/verify?token=${verificationToken}">Verify Account</a></p>`
            });
            res.json({ msg: "Registration successful! Check email." });
        } catch (mailError) {
            console.error("RESEND ERROR:", mailError);
            res.json({ msg: "Account forged, but email failed. Check Logs." });
        }
    });
});

// LOGIN: Entering the gates
app.post('/login', (req, res) => {
    // We lowercase the login attempt to match the database
    const username = req.body.username.trim().toLowerCase();
    const { password } = req.body;

    db.findOne({ username }, async (err, user) => {
        console.log("--- LOGIN DEBUG ---");
        console.log("Searching for:", username);
        console.log("Found in DB:", user ? "YES" : "NO");

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ msg: "Invalid credentials." });
        }
        
        if (user.isVerified === false) {
            return res.status(400).json({ msg: "You must verify your email first!" });
        }

        req.session.userId = user._id;
        res.json({ msg: "Welcome back, Commander.", user });
    });
});

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

/*
app.get('/get-rank-data', (req, res) => {
    res.json(groundRanks);
});

app.get('/test-sim', (req, res) => {
    const sim = generateRankedSimulation(1);
    res.json(sim);
});
*/

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
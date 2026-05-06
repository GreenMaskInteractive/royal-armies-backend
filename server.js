/**
 * server.js - Royal Armies
 * The NEXUS (Node-Encryption X-System & Utility Server)
 * The Heart of the RAGE Engine & AVI Interface
 */

/* ============================================================
   NEXUS SECTION 0: CORE MODULES & ENVIRONMENT
   ============================================================ */

const express = require('express');
const Datastore = require('@seald-io/nedb');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const { Resend } = require('resend');

// --- EXISTING ENGINE REQUIREMENTS ---
// Ensure these files exist in your /backend folder!
// const { resolveBattle } = require('./battle-engine'); 
// const { generateRankedSimulation } = require('./training-sim'); 
// const { groundRanks } = require('./public/rank-data'); 

// --- SYSTEM INITIALIZATION ---
const resend = new Resend(process.env.RESEND_API_KEY);
const app = express();
const PORT = process.env.PORT || 3000;

let activeClients = [];

// --- DATABASE LINK (NEXUS Heart) ---
const db = new Datastore({
    // If running on Render, use the disk path; otherwise use local for your PC
    filename: process.env.RENDER ? '/data/players.db' : 'players.db',
    autoload: true
});

/* ============================================================
   NEXUS SECTION 1: SECURITY & MIDDLEWARE
   ============================================================ */

// --- 1. DATA PARSING ---
app.use(express.json());

// --- 2. THE BRIDGE (Serves ARCH, AVI, and RAGE files) ---
app.use(express.static('public')); 

// --- 3. SESSION LOCK (Gatekeeper Memory) ---
app.use(session({
    secret: 'crown-hall-secret-key',
    resave: false,
    saveUninitialized: false
}));

/* ============================================================
   NEXUS SECTION 2: DATA REPOSITORIES
   ============================================================ */

// [FUTURE DATA: Unit Databases, Terrain Multipliers, Game Constants]
// This section is currently empty as data is handled via NEXUS Section 0 (NeDB).

/* ============================================================
   NEXUS SECTION 3: Static Routing (The Bridge)
   ============================================================ */

// --- ROOT ROUTE (Serves the ARCH) ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- EXISTING GAME ROUTES (Placeholder Sub-Systems) ---
/* 
app.get('/get-rank-data', (req, res) => { res.json(groundRanks); });
app.get('/test-sim', (req, res) => { const sim = generateRankedSimulation(1); res.json(sim); });
*/

/* ============================================================ 
   NEXUS SECTION 4: AUTHENTICATION API 
   ============================================================ */ 

// --- ACCOUNT REGISTRATION (The Forge) --- 
app.post('/register', async (req, res) => { 
    const username = req.body.username.trim().toLowerCase(); 
    const { password, email } = req.body; 
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

    db.insert(newUser, async (err, user) => { 
        if (err) { 
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

// --- LOGIN (Entering the Gates) --- 
app.post('/login', (req, res) => { 
    const username = req.body.username.trim().toLowerCase(); 
    const { password } = req.body; 
    db.findOne({ username }, async (err, user) => { 
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

/* ============================================================ 
   NEXUS SECTION 5: REAL-TIME EVENT STREAM & BOOT
   ============================================================ */ 

// --- THE VERIFY GATE ---
app.get('/verify', (req, res) => { 
    const token = req.query.token; 
    db.update({ verificationToken: token }, { $set: { isVerified: true } }, {}, (err) => { 
        if (err) return res.send("Verification failed."); 
        activeClients.forEach(client => { 
            try { 
                if (client.res && !client.res.writableEnded) { 
                    client.res.write(`data: ${JSON.stringify({ verified: true })}\n\n`); 
                } 
            } catch (broadcastError) { 
                console.error("Pulse broadcast failed:", broadcastError); 
            } 
        }); 
        res.send("<h1>Verified!</h1><p>You can close this tab and return to the game.</p>"); 
    }); 
}); 

// --- VERIFICATION LISTENER --- 
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

// --- THE IGNITION ---
app.listen(PORT, () => { 
    console.log(`Kingdom Server online at http://localhost:${PORT}`); 
});
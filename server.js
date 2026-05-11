/**
 * server.js - Royal Armies
 * The NEXUS (Node-Encryption X-System & Utility Server)
 * The Heart of the RAGE Engine & AVI Interface
 */

/* ============================================================ 
   NEXUS SECTION 0: CORE MODULES & ENVIRONMENT 
   ============================================================ */
const path = require('path'); // <--- MOVED TO THE TOP
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

// 2. Define the Smart Path
const isProduction = process.env.RENDER === 'true';
const dbPath = isProduction ? '/data/db.json' : path.join(__dirname, 'db.json');

// 3. Initialize the database
const adapter = new FileSync(dbPath);
const db = low(adapter);

// 4. Set the default structure
db.defaults({ commanders: [] }).write();

/* ============================================================ 
   NEXUS SECTION 1: SERVER CONFIGURATION 
   ============================================================ */
const express = require('express');
const fs = require('fs');
const compression = require('compression');
const { Resend } = require('resend');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;
const resend = new Resend('re_eMzwshB5_EmorLivvuzwbHk6jpAzWtpWE');

/* ============================================================
   NEXUS SECTION 2: SECURITY & MIDDLEWARE
   ============================================================ */

/* --- Block 2: Middleware --- */
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'))); // Serves ARCH, AVI, and GIMP files

/* --- Block 3: The Royal Post Office (Verification Link) --- */
const sendWelcomeEmail = async (playerEmail, playerName, token) => {
    try {
        const verificationLink = `https://royalarmies.com/verify?token=${token}`;

        const { data, error } = await resend.emails.send({
            from: 'Royal Armies <noreply@royalarmies.com>',
            to: [playerEmail],
            subject: '📜 Email Verification: Royal Armies',
            /* LOGO REMOVED FOR MAXIMUM STABILITY */
            html: `
                <div style="font-family: 'Georgia', serif; background-color: #000; color: #f1e0ac; padding: 40px; border: 2px solid #d4af37; text-align: center;">
                    <h1 style="color: #d4af37; text-align: center;">WELCOME, COMMANDER ${playerName.toUpperCase()}</h1>
                    
                    <p style="font-size: 1.1rem; line-height: 1.6; font-style: italic;">
                        Your registration for the Royal Armies MMORTS has been logged. 
                        Please proceed to verify your e-mail by clicking the link below.
                    </p>
                    
                    <div style="margin: 30px 0;">
                        <a href="${verificationLink}" style="background-color: #d4af37; color: #000; padding: 15px 30px; text-decoration: none; font-weight: bold; border-radius: 4px; text-transform: uppercase; display: inline-block;">
                            Verify E-Mail
                        </a>
                    </div>

                    <p style="font-size: 0.8rem; color: #888;">If the button above does not work, copy and paste this link:<br>${verificationLink}</p>
                    
                    <hr style="border: 0; border-top: 1px solid #d4af37; margin: 20px 0;" />
                    <p style="text-align: center; color: #888;">© 2026 GREEN MASK INTERACTIVE</p>
                </div>
            `
        });

        if (error) {
            console.error("❌ Resend Error:", error);
            throw error; 
        }
        console.log("📜 Verification Scroll Sent! ID:", data.id);
        return data;
    } catch (err) {
        console.error("❌ Fatal Post Office Failure:", err);
        throw err; 
    }
};

/* --- Block 4: Routing & Handshakes --- */

// 1. The Registration Endpoint
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    // A. LEDGER SEARCH: Check if this email is already registered
    const existingCommander = db.get('commanders').find({ email }).value();
    if (existingCommander) {
        console.log(`[NEXUS] Registration Denied: ${email} already exists.`);
        return res.status(400).json({ 
            status: "error", 
            message: "This E-Mail is already registered. If you have any questions or concerns about the account associated with this e-mail, contact accountsdept@royalarmies.com!" 
        });
    }

    try {
        // 🛡️ THE SHIELD: Hash the password before saving
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // B. GENERATE TOKEN
        const token = crypto.randomBytes(16).toString('hex');
        console.log(`[NEXUS] Handshake Received: Creating Token for ${username}`);

        // C. DISPATCH EMAIL
        await sendWelcomeEmail(email, username, token);

        // D. SAVE TO LEDGER: Record the new Commander with the SECURE password
        db.get('commanders').push({ 
            username, 
            email, 
            password: hashedPassword, // <--- Now saving the scrambled version!
            token,
            verified: false,
            joinedAt: new Date().toISOString()
        }).write();

        console.log(`[NEXUS] Success: ${username} added to the Ledger.`);
        res.status(200).json({ status: "logged" });

    } catch (error) {
        console.error("❌ NEXUS Critical Error:", error);
        res.status(500).json({ status: "error", message: "Post Office failure." });
    }
});

// 2. The Verification Landing Pad
app.get('/verify', (req, res) => {
    const token = req.query.token;
    
    const commander = db.get('commanders').find({ token }).value();

    if (commander) {
        db.get('commanders').find({ token }).assign({ verified: true }).write();
        console.log(`[NEXUS] Verified: ${commander.username} has confirmed their E-Mail.`);

        res.send(`
            <body style="background: #000; color: #d4af37; font-family: Georgia, serif; text-align: center; padding: 100px 20px; border: 10px solid #1a1a1a; height: 100vh; margin: 0;">
                <h1 style="font-size: 3rem; text-shadow: 0 0 20px #d4af37;">EMAIL VERIFIED</h1>
                <p style="font-size: 1.2rem; font-style: italic; color: #f1e0ac;">Thank You for verifying your E-Mail, ${commander.username}.</p>
                <br>
                <a href="https://royalarmies.com" style="color: #fff; text-decoration: underline; font-size: 1rem;">Return to Royal Armies</a>
            </body>
        `);
    } else {
        res.status(400).send("<h1>❌ INVALID TOKEN</h1><p>This verification link has expired or is incorrect.</p>");
    }
});

// 3. The Final Portal (Home Route)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* --- Block 5: Ignition --- */
app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(` NEXUS ENGINE ONLINE: Port ${PORT}`);
    console.log(` GREEN MASK INTERACTIVE: ALPHA 0.1.10`);
    console.log(`========================================`);
});
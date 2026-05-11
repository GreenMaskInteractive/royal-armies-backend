/**
 * server.js - Royal Armies
 * The NEXUS (Node-Encryption X-System & Utility Server)
 * The Heart of the RAGE Engine & AVI Interface
 */

/* ============================================================
   NEXUS SECTION 0: CORE MODULES & ENVIRONMENT
   ============================================================ */

/* ============================================================
   NEXUS SECTION 0: CORE MODULES & ENVIRONMENT
   ============================================================ */
const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const { Resend } = require('resend');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// THE KEY IS NOW ACTIVE
const resend = new Resend('re_eMzwshB5_EmorLivvuzwbHk6jpAzWtpWE');

/* ============================================================
   NEXUS SECTION 1: SECURITY & MIDDLEWARE
   ============================================================ */

/* --- Block 2: Middleware --- */
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'))); // Serves ARCH, AVI, and GIMP files

/* --- Block 3: The Royal Post Office (Verification Link) --- */
const sendWelcomeEmail = async (playerEmail, playerName, token) => {
    try {
        const verificationLink = `https://royalarmies.com{token}`;
        
        // USE A HOSTED URL (e.g., from your own site or an image host)
        const logoUrl = "https://royalarmies.com";

        const { data, error } = await resend.emails.send({
            from: 'Royal Armies <noreply@royalarmies.com>',
            to: [playerEmail],
            subject: '📜 Email Verification: Royal Armies',
            // No local attachments = No server-side file errors
            html: `
                <div style="font-family: 'Georgia', serif; background-color: #000; color: #f1e0ac; padding: 40px; border: 2px solid #d4af37; text-align: center;">
                    <div style="margin-bottom: 30px; text-align: center;">
                        <img src="${logoUrl}" alt="Royal Armies Logo" style="width: 300px; max-width: 80%; height: auto; display: block; margin: 0 auto;">
                    </div>
                    <h1 style="color: #d4af37;">WELCOME, COMMANDER ${playerName.toUpperCase()}</h1>
                    <p style="font-size: 1.1rem; line-height: 1.6; font-style: italic;">
                        Your registration for the Royal Armies has been logged. Please verify your e-mail by clicking the link below.
                    </p>
                    <div style="margin: 30px 0;">
                        <a href="${verificationLink}" style="background-color: #d4af37; color: #000; padding: 15px 30px; text-decoration: none; font-weight: bold; border-radius: 4px; text-transform: uppercase; display: inline-block;">
                            Verify E-Mail
                        </a>
                    </div>
                </div>`
        });

        if (error) throw error;
        console.log("📜 Verification Scroll Sent! ID:", data.id);
    } catch (err) {
        console.error("❌ Post Office Error:", err);
        throw err; // Sends the 500 error to script.js if it fails
    }
};

/* --- Block 4: Routing & Handshakes --- */

// 1. The Registration Endpoint (Updated with Token generation)
app.post('/register', async (req, res) => {
    const { username, email } = req.body;
    
    // Generate a secure 32-character token
    const token = crypto.randomBytes(16).toString('hex');
    
    console.log(`[NEXUS] Handshake Received: Creating Token for ${username}`);
    
    try {
        // Pass the token into the email function
        await sendWelcomeEmail(email, username, token);
        
        console.log(`[NEXUS] Success: Verification dispatched to ${email}`);
        res.status(200).json({ status: "logged" });
    } catch (error) {
        console.error("❌ NEXUS Critical Error during registration:", error);
        res.status(500).json({ status: "error", message: "Post Office failure." });
    }
});

// 2. NEW: The Verification Landing Pad
app.get('/verify', (req, res) => {
    const token = req.query.token;
    console.log(`[NEXUS] Verification Attempt: Token ${token}`);

    // Verification Success UI
    res.send(`
        <body style="background: #000; color: #d4af37; font-family: Georgia, serif; text-align: center; padding: 100px 20px; border: 10px solid #1a1a1a; height: 100vh; margin: 0;">
            <h1 style="font-size: 3rem; text-shadow: 0 0 20px #d4af37;">COMMAND VERIFIED</h1>
            <p style="font-size: 1.2rem; font-style: italic; color: #f1e0ac;">Your ranks have been synchronized, Commander.</p>
            <br>
            <a href="https://royalarmies.com" style="color: #fff; text-decoration: underline; font-size: 1rem;">Return to the Front Lines</a>
        </body>
    `);
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
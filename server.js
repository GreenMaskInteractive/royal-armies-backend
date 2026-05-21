/**
 * server.js - Royal Armies
 * The NEXUS (Node-Encryption X-System & Utility Server)
 * The Heart of the RAGE Engine & AVI Interface
 */

/* ==========================================
   NEXUS MODULE: CORE & ENVIRONMENT
   ========================================== */

/* --- Section: Dependencies & Database Bootstrap --- */

/* Block 1: Core Module Imports */
const path = require('path');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

/* Block 2: Environment Path Resolution */
const isProduction = process.env.RENDER === 'true';
const dbPath = isProduction ? '/data/db.json' : path.join(__dirname, 'db.json');

/* Block 3: Ledger Database Initialization */
const adapter = new FileSync(dbPath);
const db = low(adapter);
db.defaults({ commanders: [] }).write();

/* --- Section: Age Portal live presence (in-memory; no mock accounts) --- */
const PORTAL_PRESENCE_TTL_MS = 5 * 60 * 1000;
const portalPresenceByUser = new Map();

function prunePortalPresence() {
    const now = Date.now();
    for (const [username, lastSeen] of portalPresenceByUser.entries()) {
        if (now - lastSeen > PORTAL_PRESENCE_TTL_MS) {
            portalPresenceByUser.delete(username);
        }
    }
}

function getActivePortalUsernames() {
    prunePortalPresence();
    return [...portalPresenceByUser.keys()].sort((a, b) => a.localeCompare(b));
}

function normalizeLedgerUsername(value) {
    return String(value || '').trim();
}

function normalizeLedgerEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function findCommanderByUsernameOrEmail(identifier) {
    const needle = String(identifier || '').trim();
    if (!needle) return null;

    const commanders = db.get('commanders').value() || [];
    const lowerNeedle = needle.toLowerCase();

    return commanders.find((entry) => {
        if (!entry) return false;
        const username = String(entry.username || '').trim().toLowerCase();
        const email = normalizeLedgerEmail(entry.email);
        return username === lowerNeedle || email === lowerNeedle;
    }) || null;
}

/* ==========================================
   NEXUS MODULE: SERVER CONFIGURATION
   ========================================== */

/* --- Section: Application Assembly --- */

/* Block 4: Framework & Service Imports */
const express = require('express');
const fs = require('fs');
const compression = require('compression');
const { Resend } = require('resend');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

/* Block 5: Runtime Constants & Express Instance */
const app = express();
const PORT = process.env.PORT || 3000;
const resend = new Resend('re_eMzwshB5_EmorLivvuzwbHk6jpAzWtpWE');

/* ==========================================
   NEXUS MODULE: SECURITY & MIDDLEWARE
   ========================================== */

/* --- Section: Middleware Token Handlers --- */

/* Block 6: Compression & Body Parsers */
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

/* --- Section: Email Dispatch Engine --- */

/* Block 7: Welcome Verification Scroll Generator */
const sendWelcomeEmail = async (playerEmail, playerName, token) => {
    try {
        const verificationLink = `https://royalarmies.com/verify?token=${token}`;

        const { data, error } = await resend.emails.send({
            from: 'Royal Armies <noreply@royalarmies.com>',
            to: [playerEmail],
            subject: '📜 Email Verification: Royal Armies',
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

/* --- Section: API Route Handlers --- */

/* Block 8: Commander Registration Endpoint */
app.post('/register', async (req, res) => {
    const username = normalizeLedgerUsername(req.body?.username);
    const email = normalizeLedgerEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (!username || !email || !password) {
        return res.status(400).json({
            status: 'error',
            message: 'Username, email, and password are required.'
        });
    }

    const commanders = db.get('commanders').value() || [];
    const emailTaken = commanders.some((entry) => normalizeLedgerEmail(entry?.email) === email);
    const usernameTaken = commanders.some(
        (entry) => String(entry?.username || '').trim().toLowerCase() === username.toLowerCase()
    );

    if (emailTaken) {
        console.log(`[NEXUS] Registration Denied: ${email} already exists.`);
        return res.status(400).json({
            status: 'error',
            message: 'This E-Mail is already registered. Contact accountsdept@royalarmies.com!'
        });
    }

    if (usernameTaken) {
        console.log(`[NEXUS] Registration Denied: ${username} already exists.`);
        return res.status(400).json({
            status: 'error',
            message: 'This username is already taken. Choose a different commander name.'
        });
    }

    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const token = crypto.randomBytes(16).toString('hex');
        const joinedAt = new Date().toISOString();
        console.log(`[NEXUS] Handshake Received: Creating ledger entry for ${username}`);

        db.get('commanders').push({
            username,
            email,
            password: hashedPassword,
            token,
            verified: false,
            joinedAt
        }).write();

        console.log(`[NEXUS] Success: ${username} added to the Ledger.`);

        let emailSent = false;
        try {
            await sendWelcomeEmail(email, username, token);
            emailSent = true;
        } catch (emailError) {
            console.error(`[NEXUS] Ledger saved for ${username}, but verification email failed:`, emailError);
        }

        res.status(200).json({
            status: 'logged',
            emailSent,
            username,
            message: emailSent
                ? 'Registration saved. Check your email for the confirmation scroll.'
                : 'Registration saved, but the verification email could not be sent. You may still log in; contact accountsdept@royalarmies.com if you need the verify link resent.'
        });
    } catch (error) {
        console.error('❌ NEXUS Critical Error:', error);
        res.status(500).json({ status: 'error', message: 'Could not save registration. Please try again.' });
    }
});

/* Block 8b: Commander Login (ledger-backed) */
app.post('/api/login', async (req, res) => {
    const identifier = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!identifier || !password) {
        return res.status(400).json({
            status: 'error',
            message: 'Username and password are required.'
        });
    }

    const commander = findCommanderByUsernameOrEmail(identifier);
    if (!commander || !commander.password) {
        return res.status(401).json({
            status: 'error',
            message: 'No registered commander found with those credentials.'
        });
    }

    try {
        const passwordMatches = await bcrypt.compare(password, commander.password);
        if (!passwordMatches) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid password for that commander account.'
            });
        }

        res.status(200).json({
            status: 'success',
            username: commander.username,
            verified: !!commander.verified
        });
    } catch (error) {
        console.error('[NEXUS] Login compare failed:', error);
        res.status(500).json({ status: 'error', message: 'Login could not be completed.' });
    }
});

/* Block 9: Password Reset Request Dispatch */
app.post('/request-reset', async (req, res) => {
    const { email } = req.body;
    console.log(`[NEXUS] Recovery Handshake: Request for ${email}`);
    const commander = db.get('commanders').find({ email }).value();

    if (!commander) {
        console.log("⚠️ Recovery Denied: Email not in Ledger.");
        return res.status(200).json({ status: "success" });
    }

    const resetToken = crypto.randomBytes(16).toString('hex');
    db.get('commanders').find({ email }).assign({ resetToken }).write();

    try {
        const resetLink = `https://royalarmies.com/reset-password?token=${resetToken}`;
        await resend.emails.send({
            from: 'Royal Armies <noreply@royalarmies.com>',
            to: [email],
            subject: '📜 Forgotten Password: Password Reset Request',
            html: `
                <div style="background:#000; color:#d4af37; padding:40px; text-align:center; border:2px solid #d4af37; font-family: Georgia, serif;">
                    <h1>COMMANDER ${commander.username.toUpperCase()}</h1>
                    <p style="font-style: italic;">Here is your password reset link below.</p>
                    <div style="margin:30px 0;">
                        <a href="${resetLink}" style="background:#d4af37; color:#000; padding:15px 30px; text-decoration:none; font-weight:bold; text-transform:uppercase; display:inline-block;">
                            Reset Password
                        </a>
                    </div>
                </div>`
        });
        res.status(200).json({ status: "success" });
    } catch (err) {
        res.status(500).json({ status: "error" });
    }
});

/* Block 10: Reset Password Page Deliverer */
app.get('/reset-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

/* Block 11: Final Password Reset & Token Destruction */
app.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    const commander = db.get('commanders').find({ resetToken: token }).value();

    if (!commander) {
        console.log("⚠️ Invalid or already-used token attempted.");
        return res.status(400).json({ status: "error", message: "Invalid Scroll." });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        db.get('commanders')
          .find({ email: commander.email })
          .assign({
              password: hashedPassword,
              resetToken: null
          })
          .write();

        console.log(`[NEXUS] Password reset successful for: ${commander.username}`);
        res.status(200).json({ status: "success" });
    } catch (err) {
        res.status(500).json({ status: "error" });
    }
});

/* Block 12: Email Verification Landing Pad */
app.get('/verify', (req, res) => {
    const token = req.query.token;
    const commander = db.get('commanders').find({ token }).value();
    if (commander) {
        db.get('commanders').find({ token }).assign({ verified: true }).write();
        res.send(`
            <body style="background: #000; color: #d4af37; font-family: Georgia, serif; text-align: center; padding: 100px 20px; border: 10px solid #1a1a1a; height: 100vh; margin: 0;">
                <h1 style="font-size: 3rem;">EMAIL VERIFIED</h1>
                <p>Thank You for verifying your E-Mail, ${commander.username}.</p>
                <a href="https://royalarmies.com" style="color: #fff;">Return to Royal Armies</a>
            </body>`);
    } else {
        res.status(400).send("<h1>❌ INVALID TOKEN</h1>");
    }
});

/* Block 13: Age Portal live metrics & presence */
app.get('/api/portal/metrics', (req, res) => {
    const commanders = db.get('commanders').value() || [];
    const recentRegistrations = [...commanders]
        .filter((entry) => entry && entry.username)
        .sort((a, b) => {
            const aTime = Date.parse(a.joinedAt || 0) || 0;
            const bTime = Date.parse(b.joinedAt || 0) || 0;
            return bTime - aTime;
        })
        .slice(0, 25)
        .map((entry) => ({
            username: entry.username,
            joinedAt: entry.joinedAt || null
        }));

    const activePlayers = getActivePortalUsernames();

    res.json({
        registeredCount: commanders.length,
        recentRegistrations,
        activeCount: activePlayers.length,
        activePlayers
    });
});

app.post('/api/portal/presence', (req, res) => {
    const username = String(req.body?.username || '').trim();
    if (!username) {
        return res.status(400).json({ status: 'error', message: 'Username required.' });
    }
    portalPresenceByUser.set(username, Date.now());
    prunePortalPresence();
    res.json({ status: 'ok', activeCount: getActivePortalUsernames().length });
});

app.post('/api/portal/presence/leave', (req, res) => {
    const username = String(req.body?.username || '').trim();
    if (username) portalPresenceByUser.delete(username);
    res.json({ status: 'ok', activeCount: getActivePortalUsernames().length });
});

/* Block 14: Main Portal Route */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ==========================================
   NEXUS MODULE: IGNITION
   ========================================== */

/* --- Section: Server Boot --- */

/* Block 15: Nexus Engine Ignition */
app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(` NEXUS ENGINE ONLINE: Port ${PORT}`);
    console.log(` GREEN MASK INTERACTIVE: ALPHA 0.1.10`);
    console.log(`========================================`);
});

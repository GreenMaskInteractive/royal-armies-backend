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
const compression = require('compression');
const { Resend } = require('resend');

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

/* --- Block 3: The Royal Post Office (Resend Restoration) --- */
const sendWelcomeEmail = async (playerEmail, playerName) => {
    try {
        const { data, error } = await resend.emails.send({
            from: 'Royal Armies <noreply@royalarmies.com>',
            to: [playerEmail],
            subject: '📜 Command Application Received: Welcome to Argaute',
            html: `
                <div style="font-family: 'Georgia', serif; background-color: #000; color: #f1e0ac; padding: 40px; border: 2px solid #d4af37;">
                    <h1 style="color: #d4af37; text-align: center;">WELCOME, COMMANDER ${playerName.toUpperCase()}</h1>
                    <p style="font-size: 1.1rem; line-height: 1.6; text-align: center; font-style: italic;">
                        Your application for the Royal Armies has been logged in the Great Ledger.
                    </p>
                    <hr style="border: 0; border-top: 1px solid #d4af37; margin: 20px 0;" />
                    <p style="text-align: center;">The gates of the Hall of Statues are currently undergoing maintenance for Alpha 0.2.0.</p>
                    <p style="text-align: center; color: #888;">© 2026 GREEN MASK INTERACTIVE</p>
                </div>
            `
        });

        if (error) {
            console.error("❌ Resend Error:", error);
            throw error; 
        }
        console.log("📜 Transmission Success! ID:", data.id);
        return data;
    } catch (err) {
        console.error("❌ Fatal Connection Error in Post Office:", err);
        throw err; 
    }
};

/* --- Block 4: Routing & Handshakes --- */

// 1. The Registration Endpoint
app.post('/register', async (req, res) => {
    const { username, email } = req.body;
    console.log(`[NEXUS] Handshake Received: Application for ${username}`);
    
    try {
        await sendWelcomeEmail(email, username);
        console.log(`[NEXUS] Success: Welcome scroll dispatched to ${email}`);
        res.status(200).json({ status: "logged" });
    } catch (error) {
        console.error("❌ NEXUS Critical Error during registration:", error);
        res.status(500).json({
            status: "error",
            message: "The Royal Post Office is currently unreachable."
        });
    }
});

// 2. The Final Portal (Home Route)
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
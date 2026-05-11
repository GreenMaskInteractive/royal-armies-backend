/**
 * server.js - Royal Armies
 * The NEXUS (Node-Encryption X-System & Utility Server)
 * The Heart of the RAGE Engine & AVI Interface
 */

/* ============================================================
   NEXUS SECTION 0: CORE MODULES & ENVIRONMENT
   ============================================================ */

const express = require('express');
const path = require('path');
const compression = require('compression');
const app = express();
const PORT = process.env.PORT || 3000;

/* ============================================================
   NEXUS SECTION 1: SECURITY & MIDDLEWARE
   ============================================================ */

/* --- Block 2: Middleware --- */
app.use(compression()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // Serves your ARCH, AVI, and GIMP files

/* --- Block 3: The Royal Post Office (Resend Restoration) --- */
const { Resend } = require('resend');

// REPLACE the text below with your actual API Key from the Resend Dashboard
const resend = new Resend('re_your_actual_api_key_here'); 

const sendWelcomeEmail = async (playerEmail, playerName) => {
  try {
    const { data, error } = await resend.emails.send({
      // THIS USES YOUR VERIFIED DOMAIN
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
      return console.error("❌ Resend Error:", error);
    }
    console.log("📜 Post Office Online: Royal Scroll dispatched via Resend. ID:", data.id);

  } catch (err) {
    console.error("❌ Fatal Connection Error in Post Office:", err);
  }
};

/* --- Block 4: Routing & Handshakes --- */
// The Registration Endpoint
app.post('/register', async (req, res) => {
    const { username, email } = req.body;
    console.log(`[NEXUS] Handshake Received: Application for ${username}`);

    try {
        // Wait for the Resend engine to dispatch the scroll
        await sendWelcomeEmail(email, username);
        
        console.log(`[NEXUS] Success: Welcome scroll dispatched to ${email}`);
        res.status(200).json({ status: "logged" });

    } catch (error) {
        console.error("❌ NEXUS Critical Error:", error);
        res.status(500).json({ error: "The Royal Post Office is closed." });
    }
});

/* --- Block 5: The Final Portal --- */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(` NEXUS ENGINE ONLINE: Port ${PORT}`);
    console.log(` GREEN MASK INTERACTIVE: ALPHA 0.1.10`);
    console.log(`========================================`);
});

/* ============================================================
   NEXUS SECTION 2: DATA REPOSITORIES
   ============================================================ */

// 1. Point the static engine to the 'public' folder
// This makes everything inside /public (images, audio, css, js) accessible
app.use(express.static(path.join(__dirname, 'public')));

/* ============================================================
   NEXUS SECTION 3: Static Routing (The Bridge)
   ============================================================ */

// 2. Map the root URL to the index.html inside /public
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
        if (err) {
            console.error("SEARCH FAILED: index.html not found in /public/");
            res.status(404).send("The Portal file is trapped in a subfolder.");
        }
    });
});

// 3. THE CATCH-ALL (Universal Express 5 Fix)
app.use((req, res) => {
    res.redirect('/');
});

/* ============================================================ 
   NEXUS SECTION 4: AUTHENTICATION API 
   ============================================================ */ 

app.listen(PORT, () => {
    console.log(`
    =========================================
    NEXUS: PRE-RELEASE MODE LIVE
    Theater running at http://localhost:${PORT}
    =========================================
    `);
});

/* ============================================================ 
   NEXUS SECTION 5: REAL-TIME EVENT STREAM & BOOT
   ============================================================ */ 

// Note: Database disconnection logic removed for Local Mode.
// This section is kept as an empty shell for future scale-up.
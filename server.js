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
const nodemailer = require('nodemailer');
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

/* --- Block 3: The Royal Post Office (Email Logic) --- */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'envis.ionarygreenmask@gmail.com', // Your verified Green Mask email
    pass: 'inwm ztvt gypm mwwz'              // Your 16-character App Password
  }
});

// THE HANDSHAKE CHECK: Verifies Gmail connection on server start
transporter.verify((error, success) => {
  if (error) {
    console.log("❌ Post Office Error: Nexus cannot reach Gmail. check App Password.");
  } else {
    console.log("📜 Post Office Online: Royal Scrolls are ready for dispatch.");
  }
});

const sendWelcomeEmail = (playerEmail, playerName) => {
  const mailOptions = {
    from: '"The Royal Guard" <envis.ionarygreenmask@gmail.com>', // Must match 'user' above
    to: playerEmail,
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
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) console.log("Post Office Error:", error);
    else console.log("Transmission Sent: " + info.response);
  });
};

/* --- Block 4: Routing & Handshakes --- */
// The Registration Endpoint (Catches the RAGE Section 2 Fetch)
app.post('/register', (req, res) => {
  const { username, email } = req.body;
  console.log(`[NEXUS] Handshake Received: Application for ${username}`);
  
  // Trigger the email
  sendWelcomeEmail(email, username);

  // Send success back to the browser
  res.status(200).json({ status: "logged" });
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
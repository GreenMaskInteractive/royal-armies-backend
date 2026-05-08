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
const compression = require('compression'); // Now installed!
const app = express();

/* ============================================================
   NEXUS SECTION 1: SECURITY & MIDDLEWARE
   ============================================================ */

const PORT = process.env.PORT || 3000;

app.use(compression()); // Activates the tool you just installed
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ============================================================
   NEXUS SECTION 2: DATA REPOSITORIES
   ============================================================ */

// This serves everything in your main folder (images, audio, etc.)
app.use(express.static(__dirname));

/* ============================================================
   NEXUS SECTION 3: Static Routing (The Bridge)
   ============================================================ */

// 1. THE MAIN GATE
app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'index.html'));
});

// 2. THE CATCH-ALL (Universal Express 5 Fix)
// This captures everything that isn't the root and sends it home
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
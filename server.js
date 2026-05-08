/**
 * server.js - Royal Armies
 * The NEXUS (Node-Encryption X-System & Utility Server)
 * The Heart of the RAGE Engine & AVI Interface
 */

/* ============================================================
   NEXUS SECTION 0: CORE MODULES & ENVIRONMENT
   ============================================================ */

// Primary server framework
const express = require('express');

// Native Node utility for managing file paths across different Operating Systems
const path = require('path');

// Optional: Compression middleware to speed up image/audio delivery locally
const compression = require('compression');

// Note: Database drivers (MongoDB/MySQL) removed for Solo Landing Mode.

/* ============================================================
   NEXUS SECTION 1: SECURITY & MIDDLEWARE
   ============================================================ */

const express = require('express');
const path = require('path');
const app = express();

// Set the port (Standard 3000 for Local Theater)
const PORT = process.env.PORT || 3000;

// Enable JSON and URL parsing for local data handling
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ============================================================
   NEXUS SECTION 2: DATA REPOSITORIES
   ============================================================ */

// 1. MAIN PUBLIC HUB (Houskeeping for index.html)
app.use(express.static(path.join(__dirname, 'public')));

// 2. IMAGE PIPELINE (The Stone Portal & Navigator Icons)
app.use('/images', express.static(path.join(__dirname, 'images')));

// 3. AUDIO PIPELINE (Stone and Water & Archimedes Lullaby)
app.use('/audio', express.static(path.join(__dirname, 'audio')));

// 4. STYLE PIPELINE (AVI CSS Files)
app.use('/css', express.static(path.join(__dirname, 'css')));

// 5. SCRIPT PIPELINE (RAGE JS Files)
app.use('/js', express.static(path.join(__dirname, 'js')));

/* ============================================================
   NEXUS SECTION 3: Static Routing (The Bridge)
   ============================================================ */

// 1. THE LANDING BRIDGE
// Directs all root requests to your main ARCH Section 1 file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 2. CATCH-ALL REDIRECT
// If a user tries to type a random page name, send them back to the Landing
app.get('*', (req, res) => {
    res.redirect('/');
});

/* ============================================================ 
   NEXUS SECTION 4: AUTHENTICATION API 
   ============================================================ */ 

// Start the server on the designated PORT
app.listen(PORT, () => {
    console.log(`
    =========================================
    NEXUS: SOLO LANDING MODE ACTIVE
    Local Theater running at http://localhost:${PORT}
    Zero-Lag Environment Synchronized.
    =========================================
    `);
});

/* ============================================================ 
   NEXUS SECTION 5: REAL-TIME EVENT STREAM & BOOT
   ============================================================ */ 

// Note: Database disconnection logic removed for Local Mode.
// This section is kept as an empty shell for future scale-up.
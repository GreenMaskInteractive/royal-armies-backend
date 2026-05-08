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

// This tells Express that EVERYTHING in your main folder is a public asset
app.use(express.static(__dirname));

// Specifically mapping these to be safe
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/audio', express.static(path.join(__dirname, 'audio')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/css', express.static(path.join(__dirname, 'css')));

/* ============================================================
   NEXUS SECTION 3: Static Routing (The Bridge)
   ============================================================ */

// 1. THE MAIN GATE
app.get('/', (req, res) => {
    // We use path.join with __dirname to force the server to look in the root folder
    res.sendFile(path.join(__dirname, 'index.html'), (err) => {
        if (err) {
            console.error("GENETIC ERROR: index.html not found in " + __dirname);
            res.status(404).send("The Portal file is missing from the root directory.");
        }
    });
});

// 2. THE CATCH-ALL
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
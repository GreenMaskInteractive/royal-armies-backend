// core-auth-routes.js
const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

// --- REGISTRATION ---
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, security_q, security_a } = req.body;

        // Hash everything for security
        const passwordHash = await bcrypt.hash(password, 10);
        const securityAnswerHash = await bcrypt.hash(security_a.toLowerCase().trim(), 10);

        // TODO: Database logic to save: 
        // [username, email, passwordHash, security_q, securityAnswerHash]
        
        res.status(201).json({ message: "Commander Account Created." });
    } catch (error) {
        res.status(500).json({ error: "Error creating account." });
    }
});

// --- LOGIN ---
router.post('/login', async (req, res) => {
    const { username, password, rememberMe } = req.body;
    
    // 1. Find user in DB
    // 2. Compare password with bcrypt.compare()
    
    if (rememberMe) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // Save for 30 days
    } else {
        req.session.cookie.expires = false; // Ends when browser closes
    }

    // After login, we check if they have an active 'Age Profile'
    // If not, the frontend will see 'needs_class: true'
    res.json({ login: "success", needs_class: true });
});

// --- ACCOUNT RECOVERY ---
router.post('/recover-request', async (req, res) => {
    const { email } = req.body;
    // 1. Look up user by email
    // 2. Send back the 'security_q' (e.g., "What was your first pet's name?")
    // 3. User then submits 'security_a' to reset password
});

module.exports = router;
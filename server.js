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
db.defaults({
    commanders: [],
    portal: {
        maintenanceAlert: {
            active: !isProduction,
            title: isProduction ? 'Scheduled maintenance' : 'Site under active development',
            message: isProduction
                ? ''
                : 'Royal Armies is still being built. You may hit brief outages, broken pages, or restarts while we finish the main website and game portal. Thanks for your patience during early access.',
            windowLabel: isProduction
                ? ''
                : 'Expect occasional downtime until the main site launch is complete.'
        }
    },
    mailbox: {
        messages: [],
        drafts: []
    }
}).write();

function getPortalMaintenanceAlert() {
    const stored = db.get('portal.maintenanceAlert').value() || {};
    const result = {
        active: stored.active === true,
        title: String(stored.title || 'Scheduled maintenance').trim().slice(0, 120),
        message: String(stored.message || '').trim().slice(0, 600),
        windowLabel: String(stored.windowLabel || '').trim().slice(0, 160)
    };

    if (!isProduction && !result.message) {
        return {
            active: true,
            title: 'Site under active development',
            message: 'Royal Armies is still being built. You may hit brief outages, broken pages, or restarts while we finish the main website and game portal. Thanks for your patience during early access.',
            windowLabel: 'Expect occasional downtime until the main site launch is complete.'
        };
    }

    return result;
}

function setPortalMaintenanceAlert(patch = {}) {
    const current = getPortalMaintenanceAlert();
    const next = {
        active: patch.active !== undefined ? patch.active === true : current.active,
        title: patch.title !== undefined
            ? String(patch.title || 'Scheduled maintenance').trim().slice(0, 120)
            : current.title,
        message: patch.message !== undefined
            ? String(patch.message || '').trim().slice(0, 600)
            : current.message,
        windowLabel: patch.windowLabel !== undefined
            ? String(patch.windowLabel || '').trim().slice(0, 160)
            : current.windowLabel
    };

    if (next.active && !next.message) {
        next.message = 'The site will be briefly unavailable while we apply fixes and updates.';
    }

    db.set('portal.maintenanceAlert', next).write();
    return next;
}

const MAINTENANCE_ALERT_DEV_KEY = process.env.MAINTENANCE_ALERT_DEV_KEY || 'local-dev-maintenance';

/* --- Section: Age Portal live presence (in-memory; no mock accounts) --- */
const AGE_SESSION_ONLINE_TTL_MS = 5 * 60 * 1000;
const PORTAL_BROWSE_ONLINE_TTL_MS = 90 * 1000;
const HIDDEN_REGISTRATION_USERNAMES = new Set(['testaccount']);
const ageSessionByUser = new Map();
const portalBrowseSessionByUser = new Map();

function isHiddenRegistrationUsername(username) {
    return HIDDEN_REGISTRATION_USERNAMES.has(String(username || '').trim().toLowerCase());
}

/** Accounts that may load the full ledger recipient roster in Messages (compose ➕ list). */
function isMailboxRecipientRosterAdmin(username) {
    return String(username || '').trim().toLowerCase() === 'caleb_admin';
}

/* --- Section: Commander mailbox (ledger-backed player mail) --- */
const MAILBOX_TOPIC_MAX = 60;
const MAILBOX_BODY_MAX = 4000;
const MAILBOX_RECIPIENTS_MAX = 25;

function formatMailboxDisplayDate(isoValue) {
    const parsed = Date.parse(isoValue || '');
    if (!Number.isFinite(parsed)) return '';
    return new Date(parsed).toISOString().slice(0, 16).replace('T', ' ');
}

function createMailboxRecordId(seed = Date.now()) {
    return Number(seed);
}

function resolveLedgerCommanderUsername(username) {
    const needle = normalizeLedgerUsername(username);
    if (!needle || isHiddenRegistrationUsername(needle)) return null;

    const commanders = db.get('commanders').value() || [];
    const hit = commanders.find(
        (entry) => String(entry?.username || '').trim().toLowerCase() === needle.toLowerCase()
    );
    return hit ? String(hit.username).trim() : null;
}

function getMailboxMessageStore() {
    const rows = db.get('mailbox.messages').value();
    return Array.isArray(rows) ? rows : [];
}

function getMailboxDraftStore() {
    const rows = db.get('mailbox.drafts').value();
    return Array.isArray(rows) ? rows : [];
}

function writeMailboxMessageStore(rows) {
    db.set('mailbox.messages', rows).write();
}

function writeMailboxDraftStore(rows) {
    db.set('mailbox.drafts', rows).write();
}

function serializeMailboxMessageForClient(row) {
    if (!row) return null;
    return {
        id: row.id,
        from: row.from || '',
        to: row.to || '',
        topic: row.topic || 'No subject',
        body: row.body || '',
        read: !!row.read,
        date: formatMailboxDisplayDate(row.sentAt),
        sentAt: row.sentAt || null
    };
}

function serializeMailboxSentForClient(row) {
    if (!row) return null;
    const recipients = Array.isArray(row.recipients) && row.recipients.length
        ? row.recipients
        : String(row.to || '')
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean);
    return {
        id: row.id,
        from: row.from || '',
        recipients,
        to: recipients.join(', '),
        topic: row.topic || 'No subject',
        body: row.body || '',
        read: true,
        date: formatMailboxDisplayDate(row.sentAt),
        sentAt: row.sentAt || null
    };
}

function outboundSentGroupKey(row) {
    return `${row.sentAt || ''}|${row.topic || ''}|${row.body || ''}`;
}

/** Creates sent-folder rows for outbound mail that predates sent-channel storage (e.g. live sends). */
function ensureSentCopiesForOutboundMail(owner) {
    const ownerLower = owner.toLowerCase();
    const messages = getMailboxMessageStore();
    const groups = new Map();

    messages.forEach((row) => {
        if (!row || row.channel !== 'inbox') return;
        if (String(row.from || '').trim().toLowerCase() !== ownerLower) return;
        const key = outboundSentGroupKey(row);
        if (!groups.has(key)) {
            groups.set(key, {
                from: row.from,
                topic: row.topic,
                body: row.body,
                sentAt: row.sentAt,
                recipients: []
            });
        }
        const bucket = groups.get(key);
        if (row.to && !bucket.recipients.includes(row.to)) {
            bucket.recipients.push(row.to);
        }
    });

    let changed = false;
    groups.forEach((group, key) => {
        const alreadyStored = messages.some(
            (row) => row.channel === 'sent'
                && String(row.from || '').trim().toLowerCase() === ownerLower
                && outboundSentGroupKey(row) === key
        );
        if (alreadyStored) return;

        messages.push({
            id: createMailboxRecordId(),
            channel: 'sent',
            from: group.from,
            recipients: group.recipients,
            to: group.recipients.join(', '),
            topic: group.topic,
            body: group.body,
            read: true,
            sentAt: group.sentAt || new Date().toISOString()
        });
        changed = true;
    });

    if (changed) writeMailboxMessageStore(messages);
}

function serializeMailboxDraftForClient(row) {
    if (!row) return null;
    return {
        id: row.id,
        recipients: Array.isArray(row.recipients) ? row.recipients : [],
        topic: row.topic || 'Untitled Draft',
        body: row.body || '',
        date: formatMailboxDisplayDate(row.updatedAt) || 'Draft'
    };
}

function getMailboxPayloadForUser(username) {
    const owner = resolveLedgerCommanderUsername(username);
    if (!owner) {
        return { status: 'error', message: 'Unknown commander account.' };
    }

    const ownerLower = owner.toLowerCase();
    const inbox = getMailboxMessageStore()
        .filter((row) => row && row.channel === 'inbox' && String(row.to || '').toLowerCase() === ownerLower)
        .sort((a, b) => Date.parse(b.sentAt || 0) - Date.parse(a.sentAt || 0))
        .map(serializeMailboxMessageForClient);

    const system = getMailboxMessageStore()
        .filter((row) => row && row.channel === 'system' && String(row.to || '').toLowerCase() === ownerLower)
        .sort((a, b) => Date.parse(b.sentAt || 0) - Date.parse(a.sentAt || 0))
        .map(serializeMailboxMessageForClient);

    const drafts = getMailboxDraftStore()
        .filter((row) => row && String(row.owner || '').toLowerCase() === ownerLower)
        .sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0))
        .map(serializeMailboxDraftForClient);

    ensureSentCopiesForOutboundMail(owner);

    const sent = getMailboxMessageStore()
        .filter(
            (row) => row && row.channel === 'sent' && String(row.from || '').toLowerCase() === ownerLower
        )
        .sort((a, b) => Date.parse(b.sentAt || 0) - Date.parse(a.sentAt || 0))
        .map(serializeMailboxSentForClient);

    return { status: 'ok', username: owner, inbox, system, drafts, sent };
}

function pruneAgeSessionOnlineState() {
    const now = Date.now();
    for (const [username, session] of ageSessionByUser.entries()) {
        if (!session) continue;
        session.isOnline = (now - session.lastSeen) <= AGE_SESSION_ONLINE_TTL_MS;
        ageSessionByUser.set(username, session);
    }
}

function touchPortalBrowseSession(username) {
    const normalized = normalizeLedgerUsername(username);
    if (!normalized || isHiddenRegistrationUsername(normalized)) return null;

    const now = Date.now();
    portalBrowseSessionByUser.set(normalized, { lastSeen: now });
    return normalized;
}

function removePortalBrowseSession(username) {
    const normalized = normalizeLedgerUsername(username);
    if (!normalized) return;
    portalBrowseSessionByUser.delete(normalized);
}

function prunePortalBrowseSessions() {
    const now = Date.now();
    for (const [username, session] of portalBrowseSessionByUser.entries()) {
        if (!session || (now - session.lastSeen) > PORTAL_BROWSE_ONLINE_TTL_MS) {
            portalBrowseSessionByUser.delete(username);
        }
    }
}

function getPortalBrowseMetrics() {
    prunePortalBrowseSessions();

    const portalBrowsingPlayers = [...portalBrowseSessionByUser.keys()].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
    );

    return {
        portalBrowsingCount: portalBrowsingPlayers.length,
        portalBrowsingPlayers
    };
}

function getPortalLiveMetricsPayload() {
    const commanders = db.get('commanders').value() || [];
    const visibleCommanders = commanders.filter(
        (entry) => entry && entry.username && !isHiddenRegistrationUsername(entry.username)
    );

    const recentRegistrations = [...visibleCommanders]
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

    return {
        registeredCount: visibleCommanders.length,
        recentRegistrations,
        ...getAgeSessionMetrics(),
        ...getPortalBrowseMetrics()
    };
}

function getAgeSessionMetrics() {
    pruneAgeSessionOnlineState();

    const playingEntries = [...ageSessionByUser.entries()]
        .filter(([username]) => !isHiddenRegistrationUsername(username))
        .map(([username, session]) => ({
            username,
            joinedAt: session.joinedAt || null,
            isOnline: !!session.isOnline
        }));

    const agePlayingPlayers = playingEntries
        .map((entry) => entry.username)
        .sort((a, b) => a.localeCompare(b));

    const ageOnlinePlayers = playingEntries
        .filter((entry) => entry.isOnline)
        .map((entry) => entry.username)
        .sort((a, b) => a.localeCompare(b));

    return {
        ageOnlineCount: ageOnlinePlayers.length,
        agePlayingCount: agePlayingPlayers.length,
        ageOnlinePlayers,
        agePlayingPlayers
    };
}

function touchAgeSession(username, options = {}) {
    const normalized = normalizeLedgerUsername(username);
    if (!normalized || isHiddenRegistrationUsername(normalized)) return null;

    const now = Date.now();
    const existing = ageSessionByUser.get(normalized);
    const nextSession = {
        joinedAt: existing?.joinedAt || now,
        lastSeen: now,
        isOnline: options.markOnline !== false
    };

    ageSessionByUser.set(normalized, nextSession);
    return nextSession;
}

function removeAgeSession(username) {
    const normalized = normalizeLedgerUsername(username);
    if (!normalized) return;
    ageSessionByUser.delete(normalized);
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

function findCommanderByUsername(username) {
    const normalized = normalizeLedgerUsername(username).toLowerCase();
    if (!normalized) return null;

    const commanders = db.get('commanders').value() || [];
    return commanders.find((entry) => {
        if (!entry) return false;
        return String(entry.username || '').trim().toLowerCase() === normalized;
    }) || null;
}

function getPublicSiteOrigin(req) {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const forwardedHost = req.headers['x-forwarded-host'];
    if (forwardedProto && forwardedHost) {
        const proto = String(forwardedProto).split(',')[0].trim();
        const host = String(forwardedHost).split(',')[0].trim();
        return `${proto}://${host}`;
    }
    const host = req.get('host');
    const protocol = req.protocol || 'http';
    return host ? `${protocol}://${host}` : 'https://royalarmies.com';
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

/* Legacy portal filename → main hub (bookmarks, old deploys, cached login script) */
app.get(['/ageportal.html', '/ageportal'], (req, res) => {
    res.redirect(301, '/main.html');
});

/* Block 6b: Portal maintenance alert API (before static so routes are never shadowed) */
app.get('/api/portal/maintenance-alert', (req, res) => {
    res.json(getPortalMaintenanceAlert());
});

app.post('/api/portal/maintenance-alert', (req, res) => {
    const devKey = String(req.headers['x-dev-key'] || req.body?.devKey || '').trim();
    if (!devKey || devKey !== MAINTENANCE_ALERT_DEV_KEY) {
        return res.status(403).json({
            status: 'error',
            message: 'Invalid or missing developer key (X-Dev-Key header).'
        });
    }

    const payload = setPortalMaintenanceAlert(req.body || {});
    res.json({ status: 'ok', ...payload });
});

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

const PORTAL_PASSWORD_RESET_OK_MESSAGE =
    'If that email matches your account, a password reset link has been sent. Check your inbox.';

const sendPasswordResetEmail = async (req, commanderEmail, commanderUsername, resetToken) => {
    const origin = getPublicSiteOrigin(req);
    const resetLink = `${origin}/reset-password?token=${encodeURIComponent(resetToken)}`;
    const { data, error } = await resend.emails.send({
        from: 'Royal Armies <noreply@royalarmies.com>',
        to: [commanderEmail],
        subject: '📜 Password Reset: Royal Armies',
        html: `
            <div style="background:#000; color:#d4af37; padding:40px; text-align:center; border:2px solid #d4af37; font-family: Georgia, serif;">
                <h1>COMMANDER ${String(commanderUsername).toUpperCase()}</h1>
                <p style="font-style: italic;">Use the link below to set a new password for your Royal Armies account.</p>
                <div style="margin:30px 0;">
                    <a href="${resetLink}" style="background:#d4af37; color:#000; padding:15px 30px; text-decoration:none; font-weight:bold; text-transform:uppercase; display:inline-block;">
                        Reset Password
                    </a>
                </div>
                <p style="font-size:0.8rem; color:#888;">If the button does not work, copy and paste this link:<br>${resetLink}</p>
            </div>`
    });
    if (error) throw error;
    return data;
};

const sendEmailChangeVerificationEmail = async (req, newEmail, commanderUsername, emailChangeToken) => {
    const origin = getPublicSiteOrigin(req);
    const verifyLink = `${origin}/verify-email-change?token=${encodeURIComponent(emailChangeToken)}`;
    const { data, error } = await resend.emails.send({
        from: 'Royal Armies <noreply@royalarmies.com>',
        to: [newEmail],
        subject: '📜 Confirm Your New Email: Royal Armies',
        html: `
            <div style="background:#000; color:#d4af37; padding:40px; text-align:center; border:2px solid #d4af37; font-family: Georgia, serif;">
                <h1>CONFIRM EMAIL CHANGE</h1>
                <p style="font-style: italic;">Commander <strong>${String(commanderUsername).toUpperCase()}</strong> requested to update the account email to this address.</p>
                <p>Click below to confirm. If you did not request this, ignore this message.</p>
                <div style="margin:30px 0;">
                    <a href="${verifyLink}" style="background:#d4af37; color:#000; padding:15px 30px; text-decoration:none; font-weight:bold; text-transform:uppercase; display:inline-block;">
                        Confirm New Email
                    </a>
                </div>
                <p style="font-size:0.8rem; color:#888;">If the button does not work, copy and paste this link:<br>${verifyLink}</p>
            </div>`
    });
    if (error) throw error;
    return data;
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
    const email = normalizeLedgerEmail(req.body?.email);
    console.log(`[NEXUS] Recovery Handshake: Request for ${email}`);
    const commander = findCommanderByUsernameOrEmail(email);

    if (!commander) {
        console.log('⚠️ Recovery Denied: Email not in Ledger.');
        return res.status(200).json({ status: 'success' });
    }

    const resetToken = crypto.randomBytes(16).toString('hex');
    db.get('commanders')
        .find({ username: commander.username })
        .assign({ resetToken })
        .write();

    try {
        await sendPasswordResetEmail(req, commander.email, commander.username, resetToken);
        res.status(200).json({ status: 'success' });
    } catch (err) {
        console.error('[NEXUS] Password reset email failed:', err);
        res.status(500).json({ status: 'error' });
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

/* Block 12b: Portal account security (profile settings) */
app.get('/api/portal/account/security-profile', (req, res) => {
    const username = normalizeLedgerUsername(req.query?.username);
    if (!username) {
        return res.status(400).json({ status: 'error', message: 'Username is required.' });
    }

    const commander = findCommanderByUsername(username);
    if (!commander) {
        return res.status(404).json({ status: 'error', message: 'Commander not found.' });
    }

    res.status(200).json({
        status: 'ok',
        email: commander.email || '',
        verified: !!commander.verified
    });
});

app.post('/api/portal/account/request-password-reset', async (req, res) => {
    const username = normalizeLedgerUsername(req.body?.username);
    const email = normalizeLedgerEmail(req.body?.email);

    if (!username || !email) {
        return res.status(400).json({
            status: 'error',
            message: 'Username and signup email are required.'
        });
    }

    const commander = findCommanderByUsername(username);
    const emailMatches = commander && normalizeLedgerEmail(commander.email) === email;

    if (!emailMatches) {
        console.log(`[NEXUS] Portal password reset denied for ${username} (email mismatch or unknown).`);
        return res.status(200).json({
            status: 'ok',
            message: PORTAL_PASSWORD_RESET_OK_MESSAGE
        });
    }

    try {
        const resetToken = crypto.randomBytes(16).toString('hex');
        db.get('commanders')
            .find({ username: commander.username })
            .assign({ resetToken })
            .write();

        await sendPasswordResetEmail(req, commander.email, commander.username, resetToken);
        console.log(`[NEXUS] Portal password reset email sent for ${commander.username}`);
        res.status(200).json({
            status: 'ok',
            message: PORTAL_PASSWORD_RESET_OK_MESSAGE
        });
    } catch (err) {
        console.error('[NEXUS] Portal password reset email failed:', err);
        res.status(500).json({
            status: 'error',
            message: 'Could not send the reset email. Try again shortly.'
        });
    }
});

app.post('/api/portal/account/request-email-change', async (req, res) => {
    const username = normalizeLedgerUsername(req.body?.username);
    const password = String(req.body?.password || '');
    const newEmail = normalizeLedgerEmail(req.body?.newEmail);

    if (!username || !password || !newEmail) {
        return res.status(400).json({
            status: 'error',
            message: 'Username, password, and new email are required.'
        });
    }

    const commander = findCommanderByUsername(username);
    if (!commander || !commander.password) {
        return res.status(401).json({
            status: 'error',
            message: 'Invalid password or commander account.'
        });
    }

    try {
        const passwordMatches = await bcrypt.compare(password, commander.password);
        if (!passwordMatches) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid password or commander account.'
            });
        }

        if (normalizeLedgerEmail(commander.email) === newEmail) {
            return res.status(400).json({
                status: 'error',
                message: 'That email is already on your account.'
            });
        }

        const commanders = db.get('commanders').value() || [];
        const emailTaken = commanders.some((entry) => {
            if (!entry) return false;
            if (String(entry.username || '').trim().toLowerCase() === username.toLowerCase()) {
                return false;
            }
            return normalizeLedgerEmail(entry.email) === newEmail;
        });

        if (emailTaken) {
            return res.status(400).json({
                status: 'error',
                message: 'That email is already registered to another commander.'
            });
        }

        const emailChangeToken = crypto.randomBytes(16).toString('hex');
        db.get('commanders')
            .find({ username: commander.username })
            .assign({
                pendingNewEmail: newEmail,
                emailChangeToken,
                emailChangeRequestedAt: new Date().toISOString()
            })
            .write();

        await sendEmailChangeVerificationEmail(req, newEmail, commander.username, emailChangeToken);
        console.log(`[NEXUS] Email change confirmation sent for ${commander.username} → ${newEmail}`);

        res.status(200).json({
            status: 'ok',
            message: `A confirmation link was sent to ${newEmail}. Open that inbox and click the link to finish updating your email.`
        });
    } catch (err) {
        console.error('[NEXUS] Email change request failed:', err);
        res.status(500).json({
            status: 'error',
            message: 'Could not send the confirmation email. Try again shortly.'
        });
    }
});

app.get('/verify-email-change', (req, res) => {
    const token = String(req.query?.token || '').trim();
    const commander = db.get('commanders').find({ emailChangeToken: token }).value();

    if (!commander || !commander.pendingNewEmail) {
        return res.status(400).send(`
            <body style="background:#000;color:#d4af37;font-family:Georgia,serif;text-align:center;padding:80px 20px;">
                <h1>INVALID OR EXPIRED LINK</h1>
                <p>This email change link is no longer valid.</p>
                <a href="/main.html" style="color:#fff;">Return to portal</a>
            </body>`);
    }

    const newEmail = normalizeLedgerEmail(commander.pendingNewEmail);
    const commanders = db.get('commanders').value() || [];
    const emailTaken = commanders.some((entry) => {
        if (!entry) return false;
        if (String(entry.username || '').trim().toLowerCase() === String(commander.username).trim().toLowerCase()) {
            return false;
        }
        return normalizeLedgerEmail(entry.email) === newEmail;
    });

    if (emailTaken) {
        db.get('commanders')
            .find({ username: commander.username })
            .assign({
                pendingNewEmail: null,
                emailChangeToken: null,
                emailChangeRequestedAt: null
            })
            .write();

        return res.status(400).send(`
            <body style="background:#000;color:#d4af37;font-family:Georgia,serif;text-align:center;padding:80px 20px;">
                <h1>EMAIL UNAVAILABLE</h1>
                <p>That address is already registered to another commander. Request a new change from your profile.</p>
                <a href="/main.html" style="color:#fff;">Return to portal</a>
            </body>`);
    }

    db.get('commanders')
        .find({ username: commander.username })
        .assign({
            email: newEmail,
            pendingNewEmail: null,
            emailChangeToken: null,
            emailChangeRequestedAt: null
        })
        .write();

    console.log(`[NEXUS] Email updated for ${commander.username} → ${newEmail}`);
    res.send(`
        <body style="background:#000;color:#d4af37;font-family:Georgia,serif;text-align:center;padding:80px 20px;">
            <h1>EMAIL UPDATED</h1>
            <p>Your account email for <strong>${commander.username}</strong> is now <strong>${newEmail}</strong>.</p>
            <a href="/main.html" style="color:#fff;">Return to portal</a>
        </body>`);
});

/* Block 13: Age Portal live metrics & presence */
app.get('/api/portal/metrics', (req, res) => {
    res.json(getPortalLiveMetricsPayload());
});

app.get('/api/portal/mailbox-recipient-roster', (req, res) => {
    const requester = normalizeLedgerUsername(req.query?.requester || '');
    if (!isMailboxRecipientRosterAdmin(requester)) {
        return res.json({ allowed: false });
    }

    const commanders = db.get('commanders').value() || [];
    const visible = commanders
        .filter((entry) => entry?.username && !isHiddenRegistrationUsername(entry.username))
        .map((entry) => ({
            username: entry.username,
            verified: !!entry.verified
        }))
        .sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }));

    const all = visible.map((entry) => entry.username);
    const verified = visible.filter((entry) => entry.verified).map((entry) => entry.username);
    const unverified = visible.filter((entry) => !entry.verified).map((entry) => entry.username);

    res.json({
        allowed: true,
        categories: { all, verified, unverified }
    });
});

app.get('/api/portal/mailbox', (req, res) => {
    const username = normalizeLedgerUsername(req.query?.username || '');
    if (!username) {
        return res.status(400).json({ status: 'error', message: 'Username required.' });
    }

    const payload = getMailboxPayloadForUser(username);
    if (payload.status === 'error') {
        return res.status(404).json(payload);
    }

    res.json(payload);
});

app.post('/api/portal/mailbox/send', (req, res) => {
    const sender = resolveLedgerCommanderUsername(req.body?.sender || '');
    const recipientsRaw = Array.isArray(req.body?.recipients) ? req.body.recipients : [];
    const topic = String(req.body?.topic || '').trim().slice(0, MAILBOX_TOPIC_MAX);
    const body = String(req.body?.body || '').trim().slice(0, MAILBOX_BODY_MAX);

    if (!sender) {
        return res.status(400).json({ status: 'error', message: 'Valid sender commander required.' });
    }
    if (!topic || !body) {
        return res.status(400).json({ status: 'error', message: 'Subject and message body are required.' });
    }

    const recipients = [];
    const seen = new Set();
    for (const entry of recipientsRaw) {
        const resolved = resolveLedgerCommanderUsername(entry);
        if (!resolved) continue;
        const key = resolved.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        recipients.push(resolved);
        if (recipients.length >= MAILBOX_RECIPIENTS_MAX) break;
    }

    if (!recipients.length) {
        return res.status(400).json({ status: 'error', message: 'Choose at least one valid recipient.' });
    }

    const sentAt = new Date().toISOString();
    const messages = getMailboxMessageStore();
    const created = [];
    let idSeed = Date.now();

    recipients.forEach((recipient) => {
        const row = {
            id: createMailboxRecordId(idSeed),
            channel: 'inbox',
            from: sender,
            to: recipient,
            topic,
            body,
            read: false,
            sentAt
        };
        idSeed += 1;
        messages.push(row);
        created.push(serializeMailboxMessageForClient(row));
    });

    const sentRow = {
        id: createMailboxRecordId(idSeed),
        channel: 'sent',
        from: sender,
        recipients: recipients.slice(),
        to: recipients.join(', '),
        topic,
        body,
        read: true,
        sentAt
    };
    messages.push(sentRow);

    writeMailboxMessageStore(messages);

    res.status(200).json({
        status: 'ok',
        delivered: created.length,
        recipients,
        messages: created,
        sent: serializeMailboxSentForClient(sentRow)
    });
});

app.post('/api/portal/mailbox/inject', (req, res) => {
    const to = resolveLedgerCommanderUsername(req.body?.to || req.body?.recipient || '');
    const from = String(req.body?.from || '').trim().slice(0, 80);
    const topic = String(req.body?.topic || '').trim().slice(0, MAILBOX_TOPIC_MAX) || 'No subject';
    const body = String(req.body?.body || '').trim().slice(0, MAILBOX_BODY_MAX);

    if (!to) {
        return res.status(400).json({ status: 'error', message: 'Valid recipient commander required.' });
    }
    if (!from) {
        return res.status(400).json({ status: 'error', message: 'Sender name required.' });
    }

    const sentAt = new Date().toISOString();
    const row = {
        id: createMailboxRecordId(),
        channel: 'inbox',
        from,
        to,
        topic,
        body,
        read: false,
        sentAt
    };

    const messages = getMailboxMessageStore();
    messages.push(row);
    writeMailboxMessageStore(messages);

    res.status(200).json({ status: 'ok', message: serializeMailboxMessageForClient(row) });
});

app.patch('/api/portal/mailbox/:messageId/read', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || req.query?.username || '');
    const messageId = Number(req.params.messageId);

    if (!username) {
        return res.status(400).json({ status: 'error', message: 'Valid commander username required.' });
    }
    if (!Number.isFinite(messageId)) {
        return res.status(400).json({ status: 'error', message: 'Invalid message id.' });
    }

    const ownerLower = username.toLowerCase();
    const messages = getMailboxMessageStore();
    const hit = messages.find(
        (row) => row.id === messageId && String(row.to || '').toLowerCase() === ownerLower
    );

    if (!hit) {
        return res.status(404).json({ status: 'error', message: 'Message not found for this commander.' });
    }

    hit.read = true;
    writeMailboxMessageStore(messages);

    res.json({ status: 'ok', message: serializeMailboxMessageForClient(hit) });
});

app.delete('/api/portal/mailbox/:messageId', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || req.query?.username || '');
    const messageId = Number(req.params.messageId);
    const channel = String(req.body?.channel || req.query?.channel || 'inbox').toLowerCase();

    if (!username) {
        return res.status(400).json({ status: 'error', message: 'Valid commander username required.' });
    }
    if (!Number.isFinite(messageId)) {
        return res.status(400).json({ status: 'error', message: 'Invalid message id.' });
    }

    const ownerLower = username.toLowerCase();
    const messages = getMailboxMessageStore();
    const nextMessages = messages.filter((row) => {
        if (row.id !== messageId) return true;
        if (channel === 'sent') {
            return !(
                row.channel === 'sent'
                && String(row.from || '').toLowerCase() === ownerLower
            );
        }
        if (String(row.to || '').toLowerCase() !== ownerLower) return true;
        if (channel === 'system') return row.channel === 'system';
        return row.channel === 'inbox';
    });

    if (nextMessages.length === messages.length) {
        return res.status(404).json({ status: 'error', message: 'Message not found for this commander.' });
    }

    writeMailboxMessageStore(nextMessages);
    res.json({ status: 'ok', removedId: messageId });
});

app.post('/api/portal/mailbox/purge', (req, res) => {
    const username = resolveLedgerCommanderUsername(req.body?.username || '');
    const channel = String(req.body?.channel || 'inbox').toLowerCase();
    const idsRaw = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const ids = new Set(idsRaw.map((id) => Number(id)).filter((id) => Number.isFinite(id)));

    if (!username) {
        return res.status(400).json({ status: 'error', message: 'Valid commander username required.' });
    }
    if (!ids.size) {
        return res.status(400).json({ status: 'error', message: 'No message ids supplied.' });
    }

    const ownerLower = username.toLowerCase();
    const messages = getMailboxMessageStore();
    let removed = 0;
    const nextMessages = messages.filter((row) => {
        if (!ids.has(row.id)) return true;
        if (channel === 'sent') {
            if (row.channel !== 'sent' || String(row.from || '').toLowerCase() !== ownerLower) return true;
            removed += 1;
            return false;
        }
        if (String(row.to || '').toLowerCase() !== ownerLower) return true;
        if (channel === 'system' && row.channel !== 'system') return true;
        if (channel !== 'system' && row.channel !== 'inbox') return true;
        removed += 1;
        return false;
    });

    writeMailboxMessageStore(nextMessages);
    res.json({ status: 'ok', removed });
});

app.post('/api/portal/mailbox/drafts', (req, res) => {
    const owner = resolveLedgerCommanderUsername(req.body?.owner || req.body?.username || '');
    const recipientsRaw = Array.isArray(req.body?.recipients) ? req.body.recipients : [];
    const topic = String(req.body?.topic || '').trim().slice(0, MAILBOX_TOPIC_MAX) || 'Untitled Draft';
    const body = String(req.body?.body || '').trim().slice(0, MAILBOX_BODY_MAX);
    const draftId = Number(req.body?.id);

    if (!owner) {
        return res.status(400).json({ status: 'error', message: 'Valid commander account required.' });
    }

    const recipients = [];
    const seen = new Set();
    for (const entry of recipientsRaw) {
        const resolved = resolveLedgerCommanderUsername(entry);
        if (!resolved) continue;
        const key = resolved.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        recipients.push(resolved);
    }

    const updatedAt = new Date().toISOString();
    const drafts = getMailboxDraftStore();
    let row;

    if (Number.isFinite(draftId)) {
        const hit = drafts.find(
            (entry) => entry.id === draftId && String(entry.owner || '').toLowerCase() === owner.toLowerCase()
        );
        if (hit) {
            hit.recipients = recipients;
            hit.topic = topic;
            hit.body = body;
            hit.updatedAt = updatedAt;
            row = hit;
        }
    }

    if (!row) {
        row = {
            id: createMailboxRecordId(),
            owner,
            recipients,
            topic,
            body,
            updatedAt
        };
        drafts.unshift(row);
    }

    writeMailboxDraftStore(drafts);
    res.status(200).json({ status: 'ok', draft: serializeMailboxDraftForClient(row) });
});

app.delete('/api/portal/mailbox/drafts/:draftId', (req, res) => {
    const owner = resolveLedgerCommanderUsername(req.body?.username || req.query?.username || '');
    const draftId = Number(req.params.draftId);

    if (!owner) {
        return res.status(400).json({ status: 'error', message: 'Valid commander account required.' });
    }
    if (!Number.isFinite(draftId)) {
        return res.status(400).json({ status: 'error', message: 'Invalid draft id.' });
    }

    const ownerLower = owner.toLowerCase();
    const drafts = getMailboxDraftStore();
    const nextDrafts = drafts.filter((row) => {
        if (row.id !== draftId) return true;
        return String(row.owner || '').toLowerCase() !== ownerLower;
    });

    if (nextDrafts.length === drafts.length) {
        return res.status(404).json({ status: 'error', message: 'Draft not found for this commander.' });
    }

    writeMailboxDraftStore(nextDrafts);
    res.json({ status: 'ok', removedId: draftId });
});

app.post('/api/portal/presence', (req, res) => {
    const username = String(req.body?.username || '').trim();
    const inAge = req.body?.inAge === true;

    if (!username) {
        return res.status(400).json({ status: 'error', message: 'Username required.' });
    }

    touchPortalBrowseSession(username);

    if (inAge) {
        touchAgeSession(username, { markOnline: true });
    } else {
        const normalized = normalizeLedgerUsername(username);
        const existing = normalized ? ageSessionByUser.get(normalized) : null;
        if (existing) {
            existing.lastSeen = Date.now();
            existing.isOnline = false;
            ageSessionByUser.set(normalized, existing);
        }
    }

    res.json({ status: 'ok', ...getPortalLiveMetricsPayload() });
});

app.post('/api/portal/presence/leave', (req, res) => {
    const username = String(req.body?.username || '').trim();
    if (username) {
        removeAgeSession(username);
        removePortalBrowseSession(username);
    }
    res.json({ status: 'ok', ...getPortalLiveMetricsPayload() });
});

app.post('/api/portal/age/join', (req, res) => {
    const username = String(req.body?.username || '').trim();
    if (!username) {
        return res.status(400).json({ status: 'error', message: 'Username required.' });
    }

    touchPortalBrowseSession(username);
    touchAgeSession(username, { markOnline: true });
    res.json({ status: 'ok', ...getPortalLiveMetricsPayload() });
});

app.post('/api/portal/age/leave', (req, res) => {
    const username = String(req.body?.username || '').trim();
    if (!username) {
        return res.status(400).json({ status: 'error', message: 'Username required.' });
    }

    removeAgeSession(username);
    res.json({ status: 'ok', ...getPortalLiveMetricsPayload() });
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
    console.log(` GREEN MASK INTERACTIVE: ALPHA 0.1.11`);
    console.log(`========================================`);
});

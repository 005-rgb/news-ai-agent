'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// app.js — cPanel / Passenger entry point
//
// cPanel's Node.js Selector calls this file as the "Application startup file".
// It simply delegates to server/index.js which starts the Express server.
// All env vars (DATABASE_URL, SESSION_SECRET, ENCRYPTION_KEY, etc.) must be
// set via cPanel's Node.js Selector "Environment Variables" section.
// ─────────────────────────────────────────────────────────────────────────────

require('./server/index.js');

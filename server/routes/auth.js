'use strict';

const express = require('express');
const bcrypt  = require('bcryptjs');
const config  = require('../config');

const router = express.Router();

// POST /api/v1/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'username and password are required' },
      });
    }

    // Validate username
    if (username !== config.adminUsername) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' },
      });
    }

    // Validate password
    if (!config.adminPasswordHash) {
      return res.status(503).json({
        success: false,
        error: { code: 'AUTH_NOT_CONFIGURED', message: 'Admin password not configured. Set ADMIN_PASSWORD_HASH env variable.' },
      });
    }

    const valid = await bcrypt.compare(password, config.adminPasswordHash);
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' },
      });
    }

    // Set session
    req.session.userId = 'admin';
    req.session.username = username;

    res.json({ success: true, data: { username, message: 'Login successful' } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/logout
router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.json({ success: true, data: { message: 'Logged out successfully' } });
  });
});

// GET /api/v1/auth/me
router.get('/me', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ success: true, data: { username: req.session.username, loggedIn: true } });
  } else {
    res.json({ success: true, data: { loggedIn: false } });
  }
});

module.exports = router;

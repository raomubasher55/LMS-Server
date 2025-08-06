const express = require('express');
const router = express.Router();
const { verifyEmail } = require('../controllers/emailVerifyController')

router.get('/verify-email/:token', verifyEmail);

module.exports = router;

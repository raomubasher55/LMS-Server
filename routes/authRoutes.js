const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload'); 

const validateUser = require('../validators/validateUser');
const { registerUser, loginUser } = require('../controllers/authController');


router.post('/register', upload.single('profile'), validateUser, registerUser);
router.post('/login', loginUser);

module.exports = router;

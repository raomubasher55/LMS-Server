const express = require('express');
const { 
  submitContactForm, 
  getContacts, 
  getContactStats, 
  deleteContact 
} = require('../controllers/contactController');

const router = express.Router();

router.post('/', submitContactForm);

router.get('/', getContacts);

router.get('/stats', getContactStats);

router.delete('/:id', deleteContact);

module.exports = router;
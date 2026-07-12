const express = require('express');
const router = express.Router();
const cartController = require('../controllers/addonController');

router.get('/:id', addonController.getAddonsByStall);

module.exports = router;
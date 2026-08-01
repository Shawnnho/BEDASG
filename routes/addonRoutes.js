const express = require('express');
const router = express.Router();
const addonController = require('../controllers/addonController');

router.get('/:id', addonController.getAddonsByStall
    // #swagger.tags = ['Stalls (Customer)']
    // #swagger.summary = 'Get addons for a stall by ID'
);

module.exports = router;
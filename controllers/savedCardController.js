const SavedCardModel = require('../models/savedCardModel');

function ownCardsOrForbid(req, res) {
    const currentUserId = req.user?.userId;
    if (!currentUserId || req.params.uid !== currentUserId) {
        res.status(403).json({ error: 'You can only access your own saved cards' });
        return false;
    }
    return true;
}

const getSavedCards = async (req, res) => {
    if (!ownCardsOrForbid(req, res)) return;
    try {
        const cards = await SavedCardModel.getSavedCards(req.params.uid);
        res.status(200).json(cards);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch saved cards', details: error.message });
    }
};

const saveCard = async (req, res) => {
    if (!ownCardsOrForbid(req, res)) return;
    try {
        const { brand, last4, expMonth, expYear } = req.body;

        if (!/^\d{4}$/.test(String(last4 || ''))) {
            return res.status(400).json({ error: 'Invalid last4' });
        }
        const month = Number(expMonth);
        const year = Number(expYear);
        if (!Number.isInteger(month) || month < 1 || month > 12) {
            return res.status(400).json({ error: 'Invalid expiry month' });
        }
        if (!Number.isInteger(year) || year < 2000 || year > 2100) {
            return res.status(400).json({ error: 'Invalid expiry year' });
        }

        const allowedBrands = ['visa', 'mastercard', 'amex', 'card'];
        const safeBrand = allowedBrands.includes(String(brand || '').toLowerCase())
            ? String(brand).toLowerCase()
            : 'card';

        const savedCardId = await SavedCardModel.saveCard(req.params.uid, {
            brand: safeBrand,
            last4,
            expMonth: month,
            expYear: year,
        });

        res.status(201).json({ success: true, savedCardId });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save card', details: error.message });
    }
};

const setActiveCard = async (req, res) => {
    if (!ownCardsOrForbid(req, res)) return;
    try {
        const affected = await SavedCardModel.setActiveCard(req.params.uid, req.params.savedCardId);
        if (!affected) {
            return res.status(404).json({ error: 'Saved card not found' });
        }
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to set active card', details: error.message });
    }
};

const deleteSavedCard = async (req, res) => {
    if (!ownCardsOrForbid(req, res)) return;
    try {
        const affected = await SavedCardModel.deleteSavedCard(req.params.uid, req.params.savedCardId);
        if (!affected) {
            return res.status(404).json({ error: 'Saved card not found' });
        }
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete saved card', details: error.message });
    }
};

module.exports = { getSavedCards, saveCard, setActiveCard, deleteSavedCard };
const FavouriteOrderModel = require('../models/favouriteOrderModel');

const getFavourite = async (req, res) => {
    try {
        const fav = await FavouriteOrderModel.getFavourite(req.params.uid);
        res.status(200).json(fav || { items: [], updatedAt: null });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching favourite order', error: error.message });
    }
};

const saveFavourite = async (req, res) => {
    try {
        await FavouriteOrderModel.saveFavourite(req.params.uid, req.body.items);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Error saving favourite order', error: error.message });
    }
};

const deleteFavourite = async (req, res) => {
    try {
        await FavouriteOrderModel.deleteFavourite(req.params.uid);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting favourite order', error: error.message });
    }
};

module.exports = { getFavourite, saveFavourite, deleteFavourite };
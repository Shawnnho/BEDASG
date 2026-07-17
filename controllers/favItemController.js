const favItemModel = require('../models/favItemModel');

// SQL Server error numbers worth handling explicitly
const SQL_UNIQUE_VIOLATION = 2627;
const SQL_FK_VIOLATION = 547;

/**
 * GET /favourites/get?userId=""
 * Returns all favourite menu items for the given user
 */
async function getFavouriteItems(req, res) {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ message: 'userId is required' });
        }

        const favourites = await favItemModel.getFavouriteMenuItems(userId);
        return res.status(200).json(favourites);
    } catch (err) {
        console.error('Error fetching favourite menu items:', err);
        return res.status(500).json({ message: 'Failed to fetch favourite menu items' });
    }
}

/**
 * POST /favourites/add?userId=""&menuId=""
 * Creates a new favourite menu item
 */
async function createFavouriteItem(req, res) {
    try {
        const { userId, menuId } = req.query;

        if (!userId) {
            return res.status(400).json({ message: 'userId is required' });
        }
        if (!menuId) {
            return res.status(400).json({ message: 'menuId is required' });
        }

        const favourite = await favItemModel.createFavouriteMenuItem(userId, menuId);
        return res.status(201).json(favourite);
    } catch (err) {
        if (err.number === SQL_UNIQUE_VIOLATION) {
            return res.status(409).json({ message: 'This item is already a favourite' });
        }
        if (err.number === SQL_FK_VIOLATION) {
            return res.status(400).json({ message: 'Invalid userId or menuId' });
        }
        console.error('Error creating favourite menu item:', err);
        return res.status(500).json({ message: 'Failed to create favourite menu item' });
    }
}

/**
 * DELETE /favourites/delete?userId=""&menuId=""
 * Deletes an existing favourite menu item
 */
async function deleteFavouriteItem(req, res) {
    try {
        const { userId, menuId } = req.query;

        if (!userId) {
            return res.status(400).json({ message: 'userId is required' });
        }
        if (!menuId) {
            return res.status(400).json({ message: 'menuId is required' });
        }

        const rowsDeleted = await favItemModel.deleteFavouriteMenuItem(userId, menuId);
        if (rowsDeleted === 0) {
            return res.status(404).json({ message: 'Favourite menu item not found' });
        }

        return res.status(200).json({ message: 'Favourite menu item deleted' });
    } catch (err) {
        console.error('Error deleting favourite menu item:', err);
        return res.status(500).json({ message: 'Failed to delete favourite menu item' });
    }
}

/**
 * GET /favourites/counts?menuIds=1,2,3
 * Returns like counts for a batch of menu items, e.g.
 * [{ MenuId: "1", LikeCount: 4 }, { MenuId: "2", LikeCount: 0 }, ...]
 * Note: items with zero likes won't appear in the SQL result, so the
 * frontend should default missing ids to 0.
 */
async function getFavouriteCounts(req, res) {
    try {
        const { menuIds } = req.query;

        if (!menuIds) {
            return res.status(400).json({ message: 'menuIds query param is required (comma-separated)' });
        }

        const menuIdArray = menuIds
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean);

        if (menuIdArray.length === 0) {
            return res.status(400).json({ message: 'menuIds must contain at least one id' });
        }

        const counts = await favItemModel.getFavouriteCounts(menuIdArray);
        return res.status(200).json(counts);
    } catch (err) {
        console.error('Error fetching favourite counts:', err);
        return res.status(500).json({ message: 'Failed to fetch favourite counts' });
    }
}

module.exports = {
    getFavouriteItems,
    createFavouriteItem,
    deleteFavouriteItem,
    getFavouriteCounts
};
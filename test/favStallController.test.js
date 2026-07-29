const favStallController = require("../controllers/favStallController");
const favStallModel = require("../models/favStallModel");

jest.mock("../models/favStallModel");

describe("favStallController.getFavStalls", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should fetch all favourite stalls", async () => {
        const mockFavStalls = [
            { userId: 1, stallId: 1 },
            { userId: 2, stallId: 2 },
        ];

        favStallModel.getFavStalls.mockResolvedValue(mockFavStalls);

        const req = {user: { userId: 1}};

        const res = {
            json: jest.fn(),
        };

        await favStallController.getFavStalls(req, res);

        expect(favStallModel.getFavStalls).toHaveBeenCalledTimes(1);
        expect(res.json).toHaveBeenCalledWith(mockFavStalls);
    });
});
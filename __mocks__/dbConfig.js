
const mockQuery = jest.fn().mockResolvedValue({ recordset: [] });

const mockRequestObj = {
  input: jest.fn().mockReturnThis(),
  query: mockQuery,
};

module.exports = {
  sql: {
    NVarChar: jest.fn(),
    Int: jest.fn(),
    Decimal: jest.fn(() => jest.fn()),
    Bit: jest.fn(),
    DateTime: jest.fn(),
    DateTime2: jest.fn(),
    Date: jest.fn(),
    MAX: "MAX",
  },
  poolPromise: Promise.resolve({
    request: () => mockRequestObj,
    transaction: () => ({
      begin: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      request: () => mockRequestObj,
    }),
  }),
  __mockQuery: mockQuery,
};
const { sql, poolPromise } = require("../dbConfig");

async function getAllMessages() {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .query("SELECT * FROM ContactMessages ORDER BY createdAt DESC");
  return result.recordset;
}

async function getMessageById(id) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query("SELECT * FROM ContactMessages WHERE messageId = @id");
  return result.recordset[0];
}

async function createMessage(data) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("name", sql.NVarChar(100), data.name)
    .input("email", sql.NVarChar(200), data.email)
    .input("role", sql.NVarChar(50), data.role)
    .input("category", sql.NVarChar(50), data.category)
    .input("message", sql.NVarChar(sql.MAX), data.message)
    .query(`INSERT INTO ContactMessages (name, email, role, category, message)
            OUTPUT INSERTED.*
            VALUES (@name, @email, @role, @category, @message)`);
  return result.recordset[0];
}

async function updateStatus(id, status) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .input("status", sql.NVarChar(20), status).query(`UPDATE ContactMessages
            SET status = @status
            OUTPUT INSERTED.*
            WHERE messageId = @id`);
  return result.recordset[0];
}

async function deleteMessage(id) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query(
      "DELETE FROM ContactMessages OUTPUT DELETED.messageId WHERE messageId = @id",
    );
  return result.recordset[0];
}

module.exports = {
  getAllMessages,
  getMessageById,
  createMessage,
  updateStatus,
  deleteMessage,
};

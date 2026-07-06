const { sql, poolPromise } = require("../dbConfig");

async function getAllFaqs() {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .query("SELECT * FROM Faqs WHERE isActive = 1 ORDER BY sortOrder, faqId");
  return result.recordset;
}

async function getFaqById(id) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query("SELECT * FROM Faqs WHERE faqId = @id");
  return result.recordset[0];
}

async function createFaq(data) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("category", sql.NVarChar(50), data.category)
    .input("question", sql.NVarChar(300), data.question)
    .input("answer", sql.NVarChar(sql.MAX), data.answer)
    .input("keywords", sql.NVarChar(400), data.keywords || null)
    .input("sortOrder", sql.Int, data.sortOrder || 0)
    .query(`INSERT INTO Faqs (category, question, answer, keywords, sortOrder)
            OUTPUT INSERTED.*
            VALUES (@category, @question, @answer, @keywords, @sortOrder)`);
  return result.recordset[0];
}

async function updateFaq(id, data) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .input("category", sql.NVarChar(50), data.category)
    .input("question", sql.NVarChar(300), data.question)
    .input("answer", sql.NVarChar(sql.MAX), data.answer)
    .input("keywords", sql.NVarChar(400), data.keywords || null)
    .input("sortOrder", sql.Int, data.sortOrder || 0).query(`UPDATE Faqs
            SET category=@category, question=@question, answer=@answer,
                keywords=@keywords, sortOrder=@sortOrder
            OUTPUT INSERTED.*
            WHERE faqId=@id`);
  return result.recordset[0];
}

async function deleteFaq(id) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query("DELETE FROM Faqs OUTPUT DELETED.faqId WHERE faqId=@id");
  return result.recordset[0];
}

module.exports = { getAllFaqs, getFaqById, createFaq, updateFaq, deleteFaq };

const sql = require("mssql");
const config = require("./dbConfig");

async function testConnection() {
  try {
    console.log("Connecting to SQL Server...");
    const pool = await sql.connect(config);

    const result = await pool.request().query("SELECT GETDATE() AS now");
    console.log("✅ Connected successfully!");
    console.log("Server time:", result.recordset[0].now);

    await pool.close();
  } catch (err) {
    console.error("❌ Connection failed:");
    console.error(err.message);
  }
}

testConnection();

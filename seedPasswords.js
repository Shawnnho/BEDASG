// seedPasswords.js — run once to give legacy Firebase users a password.
const bcrypt = require("bcrypt");
const { sql, poolPromise } = require("./dbConfig");

async function run() {
  const DEFAULT_PW = "test1234"; // share with your team
  const hash = await bcrypt.hash(DEFAULT_PW, 10);

  const pool = await poolPromise;
  const result = await pool.request().input("hash", sql.NVarChar, hash).query(`
      INSERT INTO dbo.UserCredentials (UserId, PasswordHash, CreatedAt)
      SELECT u.UserId, @hash, SYSUTCDATETIME()
      FROM dbo.Users u
      LEFT JOIN dbo.UserCredentials c ON c.UserId = u.UserId
      WHERE c.UserId IS NULL
    `);

  console.log(
    `Seeded ${result.rowsAffected[0]} users with password: ${DEFAULT_PW}`,
  );
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
/*
  No file storage at all — the base64 image string is validated here
  and then stored directly in the database (ImageUrl column).

  WHY: each teammate runs their own separate local SQL Server, so files
  saved to local disk are only ever visible to whoever uploaded them.
  Once you're on a shared database (see the Azure SQL setup), storing
  the image bytes IN the row means the photo is shared the moment the
  row syncs — no file-serving infrastructure needed at all.

  REQUIRED ONE-TIME DB CHANGE — run this in SSMS against your (new,
  shared) database before this works. A default-length NVARCHAR column
  silently truncates or errors on a ~6-9MB base64 string:

    ALTER TABLE dbo.Complaints ALTER COLUMN ImageUrl NVARCHAR(MAX);
    ALTER TABLE dbo.Complaints ALTER COLUMN ImagePath NVARCHAR(MAX);
    ALTER TABLE dbo.StallReviews ALTER COLUMN ImageUrl NVARCHAR(MAX);
*/

const MAX_BYTES = 10 * 1024 * 1024; // 10MB — matches the "max 10MB" hint text on review.html

const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]);

// dataUrl looks like: "data:image/png;base64,iVBORw0KGgoAAAANS..."
// Validates format/type/size and returns the SAME string unchanged —
// it gets stored directly in the database as-is (the <img src="..."> tag
// on the front end renders a data URI exactly like a normal URL, no
// change needed there). Returns null if no image was attached.
function validateBase64Image(dataUrl) {
  if (!dataUrl) return null;

  const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Invalid image data.");
  }

  const mime = match[1];
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error("Unsupported image type. Use JPG, PNG, GIF, or WebP.");
  }

  const base64Data = match[2];
  const approxBytes = base64Data.length * 0.75; // base64 -> raw byte estimate
  if (approxBytes > MAX_BYTES) {
    throw new Error("Image too large (max 10MB).");
  }

  return dataUrl;
}

module.exports = { validateBase64Image };
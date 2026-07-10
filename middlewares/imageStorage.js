const fs = require("fs");
const path = require("path");

/*
  No multer, no Firebase Storage — the client sends the photo as a
  base64 data URL inside the regular JSON body (e.g. from FileReader's
  readAsDataURL()), and this decodes + writes it to disk directly.

  Saves to: <project root>/public/images/uploads/{subfolder}/{uid}/{filename}
  Public URL: /images/uploads/{subfolder}/{uid}/{filename}
  Served automatically by your existing:
    app.use(express.static(path.join(__dirname, "public")));
  — no separate static mount needed.
*/

const PROJECT_ROOT = path.join(__dirname, "..");
const MAX_BYTES = 5 * 1024 * 1024; // 5MB, same cap as before

const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

// dataUrl looks like: "data:image/png;base64,iVBORw0KGgoAAAANS..."
// Returns the public URL, or null if dataUrl is falsy (no photo attached).
// Throws with a user-facing message on bad format / wrong type / too large.
function saveBase64Image({ dataUrl, subfolder, uid }) {
  if (!dataUrl) return null;

  const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Invalid image data.");
  }

  const mime = match[1];
  const base64Data = match[2];

  const ext = EXT_BY_MIME[mime];
  if (!ext) {
    throw new Error("Unsupported image type. Use JPG, PNG, GIF, or WebP.");
  }

  const buffer = Buffer.from(base64Data, "base64");
  if (buffer.length > MAX_BYTES) {
    throw new Error("Image too large (max 5MB).");
  }

  const safeUid = uid || "anonymous";
  const dir = path.join(PROJECT_ROOT, "public", "images", "uploads", subfolder, safeUid);
  fs.mkdirSync(dir, { recursive: true });

  const filename = `${subfolder}_${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);

  return `/images/uploads/${subfolder}/${safeUid}/${filename}`;
}

module.exports = { saveBase64Image };
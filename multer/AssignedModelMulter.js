const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Define the upload directory
const uploadDir = 'unassignedModels/';

// Check if the uploads folder exists, create it if it doesn't
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`Created directory: ${uploadDir}`);
} else {
  console.log(`Directory already exists: ${uploadDir}`);
}

const AssignedModels = multer({
  dest: uploadDir,
  fileFilter: (req, file, cb) => {
    const filetypes = /\.(glb)$/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      return cb(null, true);
    }
    cb(new Error('Only .glb files are allowed'));
  }
});

module.exports = AssignedModels;
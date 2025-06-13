const multer = require('multer');
const path = require('path');
const fs = require('fs');

const modelsDir = path.join(process.cwd(), 'models');
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, modelsDir);
  },
  filename: (req, file, cb) => {
    const documentNumber = req.body.documentNumber || 'unknown';
    const ext = path.extname(file.originalname);
    console.log(file.originalname);
    
    const safeDocNum = documentNumber.replace(/[^a-zA-Z0-9_-]/g, '_'); // sanitize
    cb(null, `${file.originalname}`);
  }
});

const convertedFilesUpload = multer({ storage });

module.exports = convertedFilesUpload;
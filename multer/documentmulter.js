const multer = require('multer');
const path = require('path');
const fs = require('fs');

const documentsDir = path.join(process.cwd(), 'documents');
if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, documentsDir);
  },
  filename: (req, file, cb) => {
    const documentNumber = req.body.documentNumber || 'unknown';
    const ext = path.extname(file.originalname);
    console.log(file.originalname);
    
    const safeDocNum = documentNumber.replace(/[^a-zA-Z0-9_-]/g, '_'); // sanitize
    cb(null, `${file.originalname}`);
  }
});

const documentupload = multer({ storage });


module.exports = documentupload;

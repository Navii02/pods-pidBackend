const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const projectId = req.body.projectId || 'unknown';
    const modelsDir = path.join(process.cwd(), 'models', projectId);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
    }
    
    cb(null, modelsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${file.originalname}`);
  }
});

const convertedFilesUpload = multer({ storage });

module.exports = convertedFilesUpload;
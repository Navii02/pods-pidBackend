const path = require('path');
const fs = require('fs').promises; 
const { execFile } = require('child_process');
const { pool } = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const AssignedModels = require("../multer/AssignedModelMulter");

const generateCustomID = (prefix) => {
  const uuid = uuidv4();
  const uniqueID = prefix + uuid.replace(/-/g, "").slice(0, 6);
  return uniqueID;
};

const converterMap = {
  '.fbx': 'FbxExporter/FBX2glTF-windows-x64.exe',
  '.rvm': 'rvmparser/rvmparser.exe',
  '.ifc': 'IfcConvert/IfcConvert.exe',
  '.dae': 'COLLADA2GLTF/COLLADA2GLTF-bin.exe',
  '.iges': 'mayo/mayo.exe',
  '.igs': 'mayo/mayo.exe',
  // No entries needed for .glb, .gltf, .babylon as they don't need conversion
};

const supportedFormats = [
  ...Object.keys(converterMap),
  '.glb',
  '.gltf',
  '.babylon'
];

const buildExecParams = (ext, inputPath, outputPath) => {
  switch (ext) {
    case '.fbx':
    case '.dae':
      return ['--input', inputPath, '--output', outputPath];
    case '.rvm':
      return [`--output-gltf=${outputPath}`, '--tolerance=0.01', inputPath];
    case '.iges':
    case '.igs':
      return ['--export', outputPath, inputPath];
    case '.ifc':
      return [inputPath, outputPath];
    default:
      throw new Error(`No params defined for ${ext}`);
  }
};

const convertFile = async (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  // Check if format is supported
  if (!supportedFormats.includes(ext)) {
    throw new Error(`Unsupported file format: ${ext}`);
  }

  // For formats that don't need conversion
  if (['.glb', '.gltf', '.babylon'].includes(ext)) {
    const outputPath = path.resolve('models', file.originalname);
    await fs.copyFile(file.path, outputPath);
    return {
      name: file.originalname,
      path: outputPath,
      originalPath: file.path,
      converted: false // Flag to indicate no conversion was needed
    };
  }

  // For formats that need conversion
  const converterExe = converterMap[ext];
  if (!converterExe) throw new Error(`No converter for: ${ext}`);

  const inputPath = file.path;
  const fileStem = path.basename(file.originalname, ext);
  const outputPath = path.resolve('models', fileStem + '.glb');
  const converterPath = path.resolve('converters', converterExe);

  try {
    await fs.access(converterPath); // Validate converter path exists
  } catch {
    throw new Error(`Converter not found: ${converterPath}`);
  }

  const execParams = buildExecParams(ext, inputPath, outputPath);

  return new Promise((resolve, reject) => {
    execFile(converterPath, execParams, (err, stdout, stderr) => {
      if (err) {
        console.error(`Error converting ${file.originalname}:`, stderr);
        return reject(new Error(stderr));
      }
      resolve({
        name: path.basename(outputPath),
        path: outputPath,
        originalPath: inputPath,
        converted: true // Flag to indicate conversion was performed
      });
    });
  });
};

const uploadbulkModal = async (req, res) => {
  try {
    const files = req.files;
    if (!files?.length) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // First validate all files have supported formats
    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!supportedFormats.includes(ext)) {
        throw new Error(`Unsupported file format: ${ext}`);
      }
    }

    const convertedFiles = await Promise.all(
      files.map(async (file) => {
        try {
          const result = await convertFile(file);
          console.log(result.converted ? 'Converted:' : 'Copied:', result.name);
          return { 
            name: result.name, 
            path: result.path,
            originalName: file.originalname
          };
        } catch (err) {
          console.error(`Failed to process ${file.originalname}:`, err.message);
          return {
            name: file.originalname,
            error: err.message,
            originalPath: file.path
          };
        }
      })
    );

    // Separate successful and failed conversions
    const successful = convertedFiles.filter(f => !f.error);
    const failed = convertedFiles.filter(f => f.error);

    res.status(200).json({ 
      convertedFiles: successful,
      failedFiles: failed,
      message: `Processed ${successful.length} files successfully, ${failed.length} failed`
    });
  } catch (err) {
    console.error('Bulk upload failed:', err);
    res.status(500).json({ 
      error: err.message || 'Conversion error',
      details: err.stack
    });
  }
};


const saveBulkModal = async (req, res) => {
  const files = req.body; // Expecting [{ projectId, file }]
  const uploadDir = path.join(__dirname, "..", "unassignedModels");
  let connection;

  try {
    // Create unassignedModels folder if it doesn't exist
    try {
      await fs.mkdir(uploadDir, { recursive: true });
    } catch (err) {
      console.error("Failed to create unassignedModels folder:", err);
      return res.status(500).json({ 
        status: 500,
        message: "Failed to ensure upload folder",
        error: err.message 
      });
    }

    connection = await pool.getConnection();
    const results = [];

    for (const item of files) {
      const { projectId, name } = item;
      const id = generateCustomID('TAG');
      const sourcePath = path.join(__dirname, "..", "models", name);
      const destPath = path.join(uploadDir, name);

      try {
        // Move file from models to unassignedModels
        await fs.rename(sourcePath, destPath);

        // Insert record into MySQL table
        const [result] = await connection.execute(
          `INSERT INTO UnassignedModels (number, projectId, fileName)
           VALUES (?, ?, ?)`,
          [id, projectId, name]
        );

        results.push({ 
          name, 
          status: "moved and saved",
          insertedId: result.insertId 
        });
      } catch (err) {
        console.error(`Error processing file ${name}:`, err);
        results.push({ 
          name, 
          status: "error", 
          error: err.message 
        });
      }
    }

    res.status(200).json({ 
      status: 200,
      message: "Files processed", 
      results 
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ 
      status: 500,
      message: "Server error",
      error: err.message 
    });
  } finally {
    if (connection) connection.release();
  }
};


const saveChangedUnassigned = async (req, res) => {
  let connection;
  try {
    const { fileNamePath, projectId } = req.body;

    if (!fileNamePath || !Array.isArray(fileNamePath) || fileNamePath.length === 0) {
      return res.status(400).json({ error: "No valid files data provided" });
    }

    if (!projectId) {
      return res.status(400).json({ error: "Project ID is required" });
    }

    const uploadDir = path.join(__dirname, "..", "unassignedModels");
    
    // Create directory if it doesn't exist
    try {
      await fs.access(uploadDir);
    } catch (err) {
      if (err.code === 'ENOENT') {
        await fs.mkdir(uploadDir, { recursive: true });
      } else {
        throw err;
      }
    }

    connection = await pool.getConnection();
    const results = [];

    for (const fileData of fileNamePath) {
      try {
        const id = generateCustomID("TAG");
        const destPath = path.join(uploadDir, fileData.name);
        
        // Handle different data formats
        let buffer;
        if (fileData.data instanceof ArrayBuffer) {
          buffer = Buffer.from(fileData.data);
        } else if (fileData.data?.data) {
          // Handle case where data is nested in a data property
          buffer = Buffer.from(Object.values(fileData.data.data));
        } else if (Array.isArray(fileData.data)) {
          buffer = Buffer.from(fileData.data);
        } else {
          throw new Error("Invalid file data format");
        }

        await fs.writeFile(destPath, buffer);

        const [result] = await connection.execute(
          `INSERT INTO UnassignedModels (number, projectId, fileName)
           VALUES (?, ?, ?)`,
          [id, projectId, fileData.name]
        );

        results.push({
          name: fileData.name,
          path: destPath,
          status: "saved",
          insertedId: result.insertId,
        });
      } catch (fileError) {
        console.error(`Error processing file ${fileData?.name}:`, fileError);
        results.push({
          name: fileData?.name || 'unknown',
          status: "failed",
          error: fileError.message
        });
      }
    }

    res.status(200).json({
      status: 200,
      message: "File processing completed",
      files: results,
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({
      status: 500,
      message: "Server error",
      error: err.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { uploadbulkModal,saveBulkModal,saveChangedUnassigned };
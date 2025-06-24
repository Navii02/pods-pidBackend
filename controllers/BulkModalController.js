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
    const modelsDir = path.join(__dirname, "..", "models"); // Path to models directory
    
    // Create directories if they don't exist
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
        const modelFilePath = path.join(modelsDir, fileData.name); // Path to file in models folder
        
        // Handle different data formats
        let buffer;
        if (fileData.data instanceof ArrayBuffer) {
          buffer = Buffer.from(fileData.data);
        } else if (fileData.data?.data) {
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

        // Delete the file from models folder if it exists
        try {
          await fs.access(modelFilePath);
          await fs.unlink(modelFilePath);
          console.log(`Deleted file from models folder: ${modelFilePath}`);
          results.push({
            name: fileData.name,
            path: destPath,
            status: "saved",
            insertedId: result.insertId,
            modelFileDeleted: true
          });
        } catch (deleteError) {
          if (deleteError.code === 'ENOENT') {
            console.log(`File not found in models folder: ${modelFilePath}`);
            results.push({
              name: fileData.name,
              path: destPath,
              status: "saved",
              insertedId: result.insertId,
              modelFileDeleted: false
            });
          } else {
            throw deleteError;
          }
        }
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

const GetUnassignedmodels = async (req, res) => {
  let connection;
  try {

    const  projectId  = req.params.id;

    // Validate projectId
    if (!projectId) {
      return res.status(400).json({ 
        success: false,
        message: "Project ID is required" 
      });
    }

      connection = await pool.getConnection();

  
    const [results] = await connection.query(`
      SELECT 
        number, 
        fileName, 
        created_at 
      FROM 
        UnassignedModels 
      WHERE 
        projectId = ?
    `, [projectId]);

    // Return the results
    return res.status(200).json({
      success: true,
      data: results,
      message: "Unassigned models retrieved successfully"
    });

  } catch (error) {
    console.error("Error fetching unassigned models:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  } finally {
    // Release the connection back to the pool if it exists
    if (connection) {
      try {
        await connection.release();
      } catch (releaseError) {
        console.error("Error releasing connection:", releaseError);
      }
    }
  }
};

const AssignModeltags = async (req, res) => {
  let connection;
  const tags = req.body;

  if (!Array.isArray(tags) || tags.length === 0) {
    return res.status(400).json({ error: "Request body must be a non-empty array of tags" });
  }

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Create tags folder if it doesn't exist
    const tagsDir = path.join(__dirname, "..", "tags");
    try {
      await fs.mkdir(tagsDir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }

    for (const tag of tags) {
      const { tagId, tagName, tagType, fileName, projectId } = tag;

      if (!tagId || !tagName || !tagType || !projectId) {
        throw new Error("Missing required fields in one of the tags");
      }

      const typeTrimmed = tagType.trim();

      // Move file from unassignedModels to tags folder
      if (fileName) {
        const sourcePath = path.join(__dirname, "..", "unassignedModels", fileName);
        const destPath = path.join(tagsDir, fileName);
        
        try {
          await fs.rename(sourcePath, destPath);
          console.log(`Moved file from ${sourcePath} to ${destPath}`);
        } catch (err) {
          console.error(`Error moving file ${fileName}:`, err);
          // Don't fail the whole operation if file move fails
        }
      }

      // Insert into Tags
      await connection.query(
        `INSERT INTO Tags (tagId, number, name, parenttag, type, filename, projectId)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          tagId,
          tagName,
          tagName,
          null,
          typeTrimmed,
          fileName || null,
          projectId,
        ]
      );

      // Insert into TagInfo
      await connection.query(
        `INSERT INTO TagInfo (projectId, tagId, tag, type)
         VALUES (?, ?, ?, ?)`,
        [projectId, tagId, tagName, typeTrimmed]
      );

      // Insert into correct type-specific table
      const typeLower = typeTrimmed.toLowerCase();
      if (typeLower === "line") {
        await connection.query(
          `INSERT INTO LineList (projectId, tagId, tag)
           VALUES (?, ?, ?)`,
          [projectId, tagId, tagName]
        );
      } else if (typeLower === "equipment") {
        await connection.query(
          `INSERT INTO EquipmentList (projectId, tagId, tag)
           VALUES (?, ?, ?)`,
          [projectId, tagId, tagName]
        );
      } else if (typeLower === "valve") {
        await connection.query(
          `INSERT INTO ValveList (projectId, tagId, tag)
           VALUES (?, ?, ?)`,
          [projectId, tagId, tagName]
        );
      }

      // Delete from UnassignedModels
      await connection.query(
        `DELETE FROM UnassignedModels WHERE number = ? AND projectId = ?`,
        [tagId, projectId]
      );
    }

    await connection.commit();
    res.status(200).json({ message: "Tags added and files moved successfully" });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error assigning tags:", error.message);
    res.status(500).json({ error: "Internal server error", details: error.message });
  } finally {
    if (connection) connection.release();
  }
};


const DeleteAllUnassigned = async (req, res) => {
  const projectId = req.params.id;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      "DELETE FROM UnassignedModels WHERE projectId = ?",
      [projectId]
    );
    res.status(200).json({ message: "All unassigned models deleted for the project" });
  } catch (error) {
    console.error("Error deleting all unassigned models:", error);
    res.status(500).json("Internal server error");
  } finally {
    connection.release();
  }
};
const DeleteUnassigned = async (req, res) => {
  const number = req.params.id;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      "DELETE FROM UnassignedModels WHERE number = ? ",
      [number]
    );
    res.status(200).json({ message: "Unassigned model deleted successfully" });
  } catch (error) {
    console.error("Error deleting unassigned model:", error);
    res.status(500).json("Internal server error");
  } finally {
    connection.release();
  }
};


module.exports = { uploadbulkModal,saveBulkModal,saveChangedUnassigned,GetUnassignedmodels,AssignModeltags,DeleteUnassigned,DeleteAllUnassigned};
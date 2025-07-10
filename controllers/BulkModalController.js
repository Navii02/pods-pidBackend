const path = require('path');
const fs = require('fs').promises; 
const { execFile } = require('child_process');
const { pool } = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const AssignedModels = require("../multer/AssignedModelMulter");
const convertedFilesUpload = require('../multer/Modalmulter');

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

const convertFile = async (file, projectId) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  // Check if format is supported
  if (!supportedFormats.includes(ext)) {
    throw new Error(`Unsupported file format: ${ext}`);
  }

  // Create project-specific folder if it doesn't exist
  const projectDir = path.resolve('models', projectId);
  await fs.mkdir(projectDir, { recursive: true });

  // For formats that don't need conversion
  if (['.glb', '.gltf', '.babylon'].includes(ext)) {
    const outputPath = path.resolve(projectDir, file.originalname);
    await fs.copyFile(file.path, outputPath);
    return {
      name: file.originalname,
      path: outputPath,
      originalPath: file.path,
      converted: false
    };
  }

  // For formats that need conversion
  const converterExe = converterMap[ext];
  if (!converterExe) throw new Error(`No converter for: ${ext}`);

  const inputPath = file.path;
  const fileStem = path.basename(file.originalname, ext);
  const outputPath = path.resolve(projectDir, fileStem + '.glb');
  const converterPath = path.resolve('converters', converterExe);

  try {
    await fs.access(converterPath);
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
        originalPath: inputPath, // Keep original path reference
        converted: true
      });
    });
  });
};



const uploadbulkModal = async (req, res) => {
  // First handle the file upload using multer middleware
  const uploadMiddleware = convertedFilesUpload.array('files');
  
  uploadMiddleware(req, res, async (err) => {
    try {
      if (err) {
        throw err; // Handle multer errors
      }

      const files = req.files;
      const projectId = req.body.projectId 
      
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
            const result = await convertFile(file, projectId);
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
  });
};


const saveBulkModal = async (req, res) => {
  const files = req.body; // Expecting [{ projectId, name }]
  let connection;

  try {
    connection = await pool.getConnection();
    const results = [];

    for (const item of files) {
      const { projectId, name } = item;
      const id = generateCustomID('TAG');
      
      // Create project-specific paths
      const sourcePath = path.join(__dirname, "..", "models", projectId, name);
      const uploadDir = path.join(__dirname, "..", "unassignedModels", projectId);
      const destPath = path.join(uploadDir, name);

      try {
        // Create project-specific unassignedModels folder if it doesn't exist
        await fs.mkdir(uploadDir, { recursive: true });

        // Move file from models/projectId to unassignedModels/projectId
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
          insertedId: result.insertId,
          projectId: projectId
        });
      } catch (err) {
        console.error(`Error processing file ${name}:`, err);
        
        // Include more detailed error information
        const errorDetails = {
          message: err.message,
          code: err.code,
          path: err.path || (err.code === 'ENOENT' ? sourcePath : undefined)
        };
        
        results.push({ 
          name, 
          projectId,
          status: "error", 
          error: `Failed to process file: ${err.message}`,
          details: errorDetails
        });
      }
    }

    res.status(200).json({ 
      status: 200,
      message: "Files processed",
      projectId: files[0]?.projectId, // Include projectId in response
      results 
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ 
      status: 500,
      message: "Server error during bulk save",
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
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

    // Create project-specific directories
    const uploadDir = path.join(__dirname, "..", "unassignedModels", projectId);
    const modelsDir = path.join(__dirname, "..", "models", projectId);
    
    try {
      // Create both directories if they don't exist
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.mkdir(modelsDir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') { // Ignore if directories already exist
        throw err;
      }
    }

    connection = await pool.getConnection();
    const results = [];

    for (const fileData of fileNamePath) {
      try {
        const id = generateCustomID("TAG");
        const destPath = path.join(uploadDir, fileData.name);
        const modelFilePath = path.join(modelsDir, fileData.name);
        
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

        // Write file to unassignedModels/projectId folder
        await fs.writeFile(destPath, buffer);

        // Insert into database
        const [result] = await connection.execute(
          `INSERT INTO UnassignedModels (number, projectId, fileName)
           VALUES (?, ?, ?)`,
          [id, projectId, fileData.name]
        );

        // Try to delete from models/projectId folder if it exists
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

    const projectId = tags[0].projectId;
    const tagsDir = path.join(__dirname, "..", "tags", projectId);
    const unassignedDir = path.join(__dirname, "..", "unassignedModels", projectId);

    // Ensure directories exist
    await fs.mkdir(tagsDir, { recursive: true }).catch(() => {});
    await fs.mkdir(unassignedDir, { recursive: true }).catch(() => {});

    const results = [];

    for (const tag of tags) {
      const { tagId, tagName, tagType, fileName, projectId } = tag;
      results.push({ tagId, tagName, status: "processing" });

      if (!tagId || !tagName || !tagType || !projectId) {
        results[results.length - 1] = {
          ...results[results.length - 1],
          status: "failed",
          error: "Missing required fields"
        };
        continue;
      }

      const typeTrimmed = tagType.trim();
      const typeLower = typeTrimmed.toLowerCase();

      try {
        // Check if tag number already exists (regardless of tagId)
        const [existingTagWithNumber] = await connection.query(
          "SELECT tagId FROM Tags WHERE number = ? AND projectId = ?",
          [tagName, projectId]
        );

        // Handle file operations if fileName is provided
        let fileOperation = { moved: false, warning: null };
        if (fileName) {
          const sourcePath = path.join(unassignedDir, fileName);
          const destPath = path.join(tagsDir, fileName);

          try {
            await fs.access(sourcePath);
            await fs.rename(sourcePath, destPath);
            fileOperation.moved = true;
          } catch (err) {
            if (err.code === 'ENOENT') {
              fileOperation.warning = `Source file not found: ${sourcePath}`;
              console.warn(fileOperation.warning);
            } else {
              throw err;
            }
          }
        }

        if (existingTagWithNumber.length > 0) {
          // UPDATE existing tag (the one that already has this number)
          const existingTagId = existingTagWithNumber[0].tagId;
          
          await connection.query(
            `UPDATE Tags SET
              filename = COALESCE(?, filename),
              type = ?
             WHERE tagId = ?`,
            [fileName, typeTrimmed, existingTagId]
          );

          await connection.query(
            `UPDATE TagInfo SET
              type = ?
             WHERE tagId = ?`,
            [typeTrimmed, existingTagId]
          );

          // Update type-specific table if type changed
          const [currentTag] = await connection.query(
            "SELECT type FROM Tags WHERE tagId = ?",
            [existingTagId]
          );
          
          const currentType = currentTag[0].type.toLowerCase();
          if (currentType !== typeLower) {
            // Remove from old type table
            if (['line', 'equipment', 'valve'].includes(currentType)) {
              await connection.query(
                `DELETE FROM ${currentType.charAt(0).toUpperCase() + currentType.slice(1)}List 
                 WHERE tagId = ?`,
                [existingTagId]
              );
            }

            // Add to new type table
            if (['line', 'equipment', 'valve'].includes(typeLower)) {
              await connection.query(
                `INSERT INTO ${typeLower.charAt(0).toUpperCase() + typeLower.slice(1)}List
                 (projectId, tagId, tag)
                 VALUES (?, ?, ?)`,
                [projectId, existingTagId, tagName]
              );
            }
          }

          // DELETE from UnassignedModels whether we're updating or creating
          await connection.query(
            `DELETE FROM UnassignedModels 
             WHERE number = ? AND projectId = ?`,
            [tagId, projectId]
          );

          results[results.length - 1] = {
            ...results[results.length - 1],
            status: "updated",
            existingTagId, // Include the ID of the tag that was actually updated
            fileOperation,
            message: "Existing tag with same number was updated with new file",
            unassignedRemoved: true
          };

        } else {
          // INSERT new tag (no existing tag with this number)
          await connection.query(
            `INSERT INTO Tags 
             (tagId, number, name, parenttag, type, filename, projectId)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [tagId, tagName, tagName, null, typeTrimmed, fileName || null, projectId]
          );

          await connection.query(
            `INSERT INTO TagInfo 
             (projectId, tagId, tag, type)
             VALUES (?, ?, ?, ?)`,
            [projectId, tagId, tagName, typeTrimmed]
          );

          if (['line', 'equipment', 'valve'].includes(typeLower)) {
            await connection.query(
              `INSERT INTO ${typeLower.charAt(0).toUpperCase() + typeLower.slice(1)}List
               (projectId, tagId, tag)
               VALUES (?, ?, ?)`,
              [projectId, tagId, tagName]
            );
          }

          // DELETE from UnassignedModels whether we're updating or creating
          await connection.query(
            `DELETE FROM UnassignedModels 
             WHERE number = ? AND projectId = ?`,
            [tagId, projectId]
          );

          results[results.length - 1] = {
            ...results[results.length - 1],
            status: "created",
            fileOperation,
            message: "New tag created",
            unassignedRemoved: true
          };
        }

      } catch (error) {
        results[results.length - 1] = {
          ...results[results.length - 1],
          status: "failed",
          error: error.message,
          code: error.code
        };
        console.error(`Error processing tag ${tagId}:`, error);
      }
    }

    const hasFailures = results.some(r => r.status === "failed");
    if (hasFailures) {
      await connection.rollback();
      return res.status(207).json({
        message: "Some tags failed to process",
        results,
        stats: {
          created: results.filter(r => r.status === "created").length,
          updated: results.filter(r => r.status === "updated").length,
          failed: results.filter(r => r.status === "failed").length
        }
      });
    }

    await connection.commit();
    res.status(200).json({
      message: "All tags processed successfully",
      results,
      stats: {
        created: results.filter(r => r.status === "created").length,
        updated: results.filter(r => r.status === "updated").length
      }
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error in AssignModeltags:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
      code: error.code,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  } finally {
    if (connection) connection.release();
  }
};

const DeleteAllUnassigned = async (req, res) => {
  const projectId = req.params.id;
  let connection;
  
  try {
    connection = await pool.getConnection();
    
    // First get all filenames associated with the project's unassigned models
    const [results] = await connection.query(
      "SELECT fileName FROM UnassignedModels WHERE projectId = ?",
      [projectId]
    );

    // Delete from database
    await connection.query(
      "DELETE FROM UnassignedModels WHERE projectId = ?",
      [projectId]
    );

    // Delete all associated files from project-specific directory
    const deletePromises = results.map(async (item) => {
      if (item.fileName) {
        const filePath = path.join(__dirname, "..", "unassignedModels", projectId, item.fileName);
        try {
          await fs.unlink(filePath);
          console.log(`Deleted file: ${filePath}`);
        } catch (err) {
          if (err.code !== 'ENOENT') { // Ignore if file doesn't exist
            throw err;
          }
        }
      }
    });

    await Promise.all(deletePromises);

    // Optionally: Remove the project directory if empty
    try {
      const projectDir = path.join(__dirname, "..", "unassignedModels", projectId);
      const files = await fs.readdir(projectDir);
      if (files.length === 0) {
        await fs.rmdir(projectDir);
      }
    } catch (err) {
      // Ignore if directory doesn't exist or isn't empty
    }

    res.status(200).json({ message: "All unassigned models deleted for the project" });
  } catch (error) {
    console.error("Error deleting all unassigned models:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  } finally {
    if (connection) connection.release();
  }
};
const DeleteUnassigned = async (req, res) => {
  const number = req.params.id;
  let connection;
  
  try {
    connection = await pool.getConnection();
    
    // First get the filename and projectId associated with the unassigned model
    const [result] = await connection.query(
      "SELECT fileName, projectId FROM UnassignedModels WHERE number = ?",
      [number]
    );

    if (result.length === 0) {
      return res.status(404).json({ message: "Unassigned model not found" });
    }

    const { fileName, projectId } = result[0];

    // Delete from database
    await connection.query(
      "DELETE FROM UnassignedModels WHERE number = ?",
      [number]
    );

    // Delete the associated file from project-specific directory
    if (fileName && projectId) {
      const filePath = path.join(__dirname, "..", "unassignedModels", projectId, fileName);
      try {
        await fs.unlink(filePath);
        console.log(`Deleted file: ${filePath}`);
      } catch (err) {
        if (err.code !== 'ENOENT') { // Ignore if file doesn't exist
          throw err;
        }
      }
    }

    res.status(200).json({ message: "Unassigned model deleted successfully" });
  } catch (error) {
    console.error("Error deleting unassigned model:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  } finally {
    if (connection) connection.release();
  }
};


module.exports = { uploadbulkModal,saveBulkModal,saveChangedUnassigned,GetUnassignedmodels,AssignModeltags,DeleteUnassigned,DeleteAllUnassigned};
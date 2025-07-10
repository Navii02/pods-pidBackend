const { pool } = require("../config/db");
const zlib = require("zlib");
const chunkStorage = new Map();     
const fs = require('fs');
const fsp = fs.promises;
const path = require("path");
const multer = require("multer");
const upload = multer(); // in-memory storage
const { pipeline } = require('stream').promises;
const os = require('os');

const SaveOriginalMesh = async (req, res) => {
  const { meshes } = req.body;

  if (!Array.isArray(meshes) || meshes.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No meshes provided",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    const values = meshes.map((m) => [
      m.MeshId,
      JSON.stringify(m.data),
      m.projectId,
    ]);

    await connection.query(
      "INSERT INTO OriginalMeshes (MeshId, data, projectId) VALUES ?",
      [values]
    );

    res.status(200).json({
      success: true,
      message: `Saved ${meshes.length} original meshes`,
    });
  } catch (error) {
    console.error("Error saving original meshes:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to save original meshes",
    });
  } finally {
    if (connection) connection.release();
  }
};




const saveOctree = async (req, res) => {
  // Wrap multer in a Promise so we can await it
  await new Promise((resolve, reject) => {
    upload.single("file")(req, res, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  const { octreeId, projectId } = req.body;
  const fileBuffer = req.file?.buffer;

  if (!octreeId || !projectId || !fileBuffer) {
    return res.status(400).json({ success: false, message: "Missing required fields or file." });
  }

  const folderPath = path.join(__dirname, "../octrees");
  const filename = `${projectId}.octree.json`;
  const filepath = path.join(folderPath, filename);

  let connection;

  try {
    await fs.mkdir(folderPath, { recursive: true });
    await fs.writeFile(filepath, fileBuffer);

    connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO Octree (OctreeId, data, projectId) VALUES (?, ?, ?)`,
      [octreeId, filepath, projectId]
    );

    res.status(200).json({ success: true, message: "Octree saved successfully." });
  } catch (error) {
    console.error("Error saving octree:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (connection) connection.release();
  }
};





const handleChunkUpload = async (req, res) => {
  try {
    const { projectId, octreeId, chunkIndex } = req.body;
    console.log(req.body);

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const chunkData = req.file.buffer.toString('utf8');

    const tempDir = path.join(__dirname, '..', 'temp_uploads', projectId);
    await fsp.mkdir(tempDir, { recursive: true });

    const chunkKey = `${octreeId}_${chunkIndex}`;
    chunkStorage.set(chunkKey, chunkData); // optional
    await fsp.writeFile(path.join(tempDir, chunkKey), chunkData);

    res.json({ success: true, receivedChunk: chunkIndex });
  } catch (error) {
    console.error('Chunk upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};


const finalizeOctree = async (req, res) => {
  try {
    const { projectId, octreeId, totalChunks } = req.body;
    const tempDir = path.join(__dirname, '..', 'temp_uploads', projectId); // same as upload
    const outputDir = path.join(__dirname, '..', 'octrees', projectId);

    await fsp.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `${projectId}.octree.json`);
    const writeStream = fs.createWriteStream(outputPath);
    writeStream.setMaxListeners(20); 

    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(tempDir, `${octreeId}_${i}`);
      const readStream = fs.createReadStream(chunkPath);
      await pipeline(readStream, writeStream, { end: false });
    }

    writeStream.end();
    await new Promise(resolve => writeStream.on('finish', resolve));

    const connection = await pool.getConnection();
    try {
      await connection.query(
        `INSERT INTO Octree (OctreeId, projectId, data) VALUES (?, ?, ?)`,
        [octreeId, projectId, outputPath]
      );
      res.json({ success: true, octreeId });
    } finally {
      connection.release();
    }

    await fsp.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.error('Finalization error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const saveMergedMesh = async (req, res) => {
  try {
    const { MergedMeshId, projectId } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, error: "No JSON file uploaded" });
    }

    const jsonString = req.file.buffer.toString("utf8");
    const meshData = JSON.parse(jsonString); // Validate JSON

    const connection = await pool.getConnection();
    try {
      await connection.query(
        `INSERT INTO MergedMeshes (MergedMeshId, data, projectId) VALUES (?, ?, ?)`,
        [MergedMeshId, JSON.stringify(meshData), projectId]
      );

      res.json({ success: true, message: "Merged mesh saved as JSON" });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error saving merged mesh:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};



const DeleteGlobalModal = async (req, res) => {
  const { projectId } = req.params;

  if (!projectId) {
    return res
      .status(400)
      .json({ success: false, message: "Missing projectId" });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // 🔥 Delete the octree file
    const octreeFileName = `${projectId}.json`;
    const octreeFilePath = path.join(__dirname, "../octrees", octreeFileName);

    try {
      await fs.unlink(octreeFilePath);
      console.log(`Deleted octree file: ${octreeFilePath}`);
    } catch (fileErr) {
      console.warn(`Octree file not found or already deleted: ${octreeFilePath}`);
    }

    // ❌ Delete from DB tables
    await connection.query(`DELETE FROM OriginalMeshes WHERE projectId = ?`, [
      projectId,
    ]);

    await connection.query(`DELETE FROM Octree WHERE projectId = ?`, [
      projectId,
    ]);

    await connection.query(`DELETE FROM MergedMeshes WHERE projectId = ?`, [
      projectId,
    ]);

    res.status(200).json({
      success: true,
      message: `All mesh data and octree file for project ${projectId} have been deleted.`,
    });
  } catch (error) {
    console.error("Error deleting mesh data:", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting project mesh data",
    });
  } finally {
    if (connection) connection.release();
  }
};

const getGlobalModalData = async (req, res) => {
  const { projectId } = req.params;
  let connection;

  try {
    connection = await pool.getConnection();

    // Fetch octree metadata (should contain file path or ID)
    const [octreeRows] = await connection.query(
      `SELECT * FROM Octree WHERE projectId = ?`,
      [projectId]
    );

    let octree = null;

    if (octreeRows.length > 0) {
      const octreeMeta = octreeRows[0];
      const octreeFileName = `${projectId}.octree.json`;
      const octreeFilePath = path.join(__dirname, `../octrees/${projectId}`, octreeFileName);

      try {
        const fileContent = await fs.readFile(octreeFilePath, "utf-8");
        const parsedData = JSON.parse(fileContent);
        octree = { ...octreeMeta, data: parsedData };
      } catch (err) {
        console.warn("Octree file read error:", err.message);
        octree = { ...octreeMeta, data: null };
      }
    }

    const [originalMeshes] = await connection.query(
      `SELECT * FROM OriginalMeshes WHERE projectId = ?`,
      [projectId]
    );

    const [mergedMeshes] = await connection.query(
      `SELECT * FROM MergedMeshes WHERE projectId = ?`,
      [projectId]
    );

    res.status(200).json({
      success: true,
      message: `Found ${octreeRows.length} octree records.`,
      octree: octree,
      originalMeshes: originalMeshes || [],
      mergedMeshes: mergedMeshes || [],
    });
  } catch (error) {
    console.error("Error fetching global modal data:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  SaveOriginalMesh,
  saveOctree,
  saveMergedMesh,
  DeleteGlobalModal,
  getGlobalModalData,
  finalizeOctree,
  handleChunkUpload
};

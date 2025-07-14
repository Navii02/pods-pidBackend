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

const { parser } = require("stream-json");
const { streamValues } = require("stream-json/streamers/StreamValues");
const { chain } = require("stream-chain");

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

    const values = [];

    for (const m of meshes) {
      const meshDir = path.join(__dirname, "..", "originalMeshes", m.projectId);
      await fsp.mkdir(meshDir, { recursive: true });

      const compressed = zlib.gzipSync(JSON.stringify(m.data));
      const filePath = path.join(meshDir, `${m.MeshId}.json.gz`);
      await fsp.writeFile(filePath, compressed);

      values.push([m.MeshId, filePath, m.projectId]);
    }

    await connection.query(
      "INSERT INTO OriginalMeshes (MeshId, data, projectId) VALUES ?",
      [values]
    );

    res.status(200).json({
      success: true,
      message: `Saved ${meshes.length} original meshes (compressed)`,
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






const handleChunkUpload = async (req, res) => {
  try {
    const { projectId, octreeId, chunkIndex } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const chunkData = req.file.buffer;
    const compressedChunk = zlib.gzipSync(chunkData);

    const tempDir = path.join(__dirname, '..', 'temp_uploads', projectId);
    await fsp.mkdir(tempDir, { recursive: true });

    const chunkKey = `${octreeId}_${chunkIndex}.gz`;
    await fsp.writeFile(path.join(tempDir, chunkKey), compressedChunk);

    res.json({ success: true, receivedChunk: chunkIndex });
  } catch (error) {
    console.error('Chunk upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};


const finalizeOctree = async (req, res) => {
  try {
    const { projectId, octreeId, totalChunks } = req.body;
    const tempDir = path.join(__dirname, '..', 'temp_uploads', projectId);
    const outputDir = path.join(__dirname, '..', 'octrees', projectId);

    await fsp.mkdir(outputDir, { recursive: true });

    const buffers = [];

    // Step 1: Decompress each .gz chunk and collect raw buffers
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(tempDir, `${octreeId}_${i}.gz`);
      const compressedChunk = await fsp.readFile(chunkPath);
      const rawBuffer = zlib.gunzipSync(compressedChunk); // Decompress chunk
      buffers.push(rawBuffer);
    }

    // Step 2: Concatenate raw buffers
    const fullBuffer = Buffer.concat(buffers);

    // Step 3: Recompress the full buffer into one .gz file
    const compressedOutput = zlib.gzipSync(fullBuffer);
    const outputPath = path.join(outputDir, `${projectId}.octree.json.gz`);
    await fsp.writeFile(outputPath, compressedOutput);

    // Step 4: Save reference to database
    const connection = await pool.getConnection();
    try {
      await connection.query(
        `INSERT INTO Octree (OctreeId, projectId, data) VALUES (?, ?, ?)`,
        [octreeId, projectId, outputPath]
      );
    } finally {
      connection.release();
    }

    // Cleanup
    await fsp.rm(tempDir, { recursive: true, force: true });

    res.json({ success: true, octreeId });
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
    const meshData = JSON.parse(jsonString);
    const compressed = zlib.gzipSync(JSON.stringify(meshData));

    const meshDir = path.join(__dirname, '..', 'mergedMeshes', projectId);
    await fsp.mkdir(meshDir, { recursive: true });

    const filePath = path.join(meshDir, `${MergedMeshId}.json.gz`);
    await fsp.writeFile(filePath, compressed);

    const connection = await pool.getConnection();
    try {
      await connection.query(
        `INSERT INTO MergedMeshes (MergedMeshId, data, projectId) VALUES (?, ?, ?)`,
        [MergedMeshId, filePath, projectId]
      );

      res.json({ success: true, message: "Merged mesh saved (compressed)" });
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
    return res.status(400).json({ success: false, message: "Missing projectId" });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // === Delete Octree File ===
    const octreePath = path.join(__dirname, "../octrees", projectId, `${projectId}.octree.json.gz`);
    try {
      await fsp.unlink(octreePath);
      console.log("✅ Deleted octree file:", octreePath);
    } catch (err) {
      console.warn("⚠️ Octree file not found:", octreePath);
    }

    // === Delete Octree Directory (cleanup if empty) ===
    const octreeDir = path.join(__dirname, "../octrees", projectId);
    try {
      await fsp.rm(octreeDir, { recursive: true, force: true });
      console.log("✅ Deleted octree dir:", octreeDir);
    } catch (err) {
      console.warn("⚠️ Failed to delete octree dir:", err.message);
    }

    // === Delete Original Mesh Files ===
    const originalDir = path.join(__dirname, "../originalMeshes", projectId);
    try {
      await fsp.rm(originalDir, { recursive: true, force: true });
      console.log("✅ Deleted original meshes dir:", originalDir);
    } catch (err) {
      console.warn("⚠️ Failed to delete original meshes dir:", err.message);
    }

    // === Delete Merged Mesh Files ===
    const mergedDir = path.join(__dirname, "../mergedMeshes", projectId);
    try {
      await fsp.rm(mergedDir, { recursive: true, force: true });
      console.log("✅ Deleted merged meshes dir:", mergedDir);
    } catch (err) {
      console.warn("⚠️ Failed to delete merged meshes dir:", err.message);
    }

    // === Delete from DB ===
    await connection.query(`DELETE FROM OriginalMeshes WHERE projectId = ?`, [projectId]);
    await connection.query(`DELETE FROM Octree WHERE projectId = ?`, [projectId]);
    await connection.query(`DELETE FROM MergedMeshes WHERE projectId = ?`, [projectId]);

    res.status(200).json({
      success: true,
      message: `✅ Global model for project deleted successfully.`,
    });
  } catch (error) {
    console.error("❌ Error deleting global model:", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting global model",
    });
  } finally {
    if (connection) connection.release();
  }
};






const getGlobalModalData = async (req, res) => {
  const { projectId } = req.params;
  console.log("meshdata", projectId);

  let connection;
  try {
    connection = await pool.getConnection();

    const [octreeRows] = await connection.query(
      `SELECT * FROM Octree WHERE projectId = ?`,
      [projectId]
    );

    const [originalMeshRows] = await connection.query(
      `SELECT MeshId, data FROM OriginalMeshes WHERE projectId = ?`,
      [projectId]
    );

    const [mergedMeshRows] = await connection.query(
      `SELECT MergedMeshId, data FROM MergedMeshes WHERE projectId = ?`,
      [projectId]
    );

    let octree = null;
    if (octreeRows.length > 0) {
      const octreeMeta = octreeRows[0];
      const fileName = path.basename(octreeMeta.data); // ensure filename only
      octree = {
        OctreeId: octreeMeta.OctreeId,
        fileUrl: `/octrees/${projectId}/${fileName}`, // frontend can fetch this URL
      };
    }

    const originalMeshes = originalMeshRows.map((row) => ({
      MeshId: row.MeshId,
      fileUrl: `/originalMeshes/${projectId}/${path.basename(row.data)}`,
    }));

    const mergedMeshes = mergedMeshRows.map((row) => ({
      MergedMeshId: row.MergedMeshId,
      fileUrl: `/mergedMeshes/${projectId}/${path.basename(row.data)}`,
    }));

    console.log(mergedMeshes.length);
    
    res.status(200).json({
      success: true,
      octree,
      originalMeshes,
      mergedMeshes,
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

  saveMergedMesh,
  DeleteGlobalModal,
  getGlobalModalData,
  finalizeOctree,
  handleChunkUpload
};

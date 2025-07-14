const { pool } = require("../config/db");

const fs = require('fs/promises');
const path = require('path');


const SaveOriginalMesh = async (req, res) => {
  const { MeshId, data, projectId } = req.body;
//console.log(data);

  if (!MeshId || !data || !projectId) {
    return res.status(400).json({
      success: false,
      message: 'MeshId, data, and projectId are required.',
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();

    // Optional: Validate meshId uniqueness per project
    const [existing] = await connection.query(
      'SELECT id FROM OriginalMeshes WHERE MeshId = ? AND projectId = ?',
      [MeshId, projectId]
    );

    
      // Insert new
      await connection.query(
        'INSERT INTO OriginalMeshes (MeshId, data, projectId) VALUES (?, ?, ?)',
        [MeshId, JSON.stringify(data), projectId]
      );
   

    res.status(200).json({ success: true, message: 'Original mesh saved' });
  } catch (err) {
    console.error('Error saving original mesh:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to save original mesh',
      error: err.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const saveOctree = async (req, res) => {
  const { OctreeId, data, projectId } = req.body;
  console.log(req.body);
  const filename = `${projectId}.json`;
  const filepath = path.join(__dirname, 'octrees', filename);

  let connection;
  try {
    await fs.writeFile(filepath, JSON.stringify(data)); // Save to file

    connection = await pool.getConnection();
    await connection.query(
  `INSERT INTO Octree (OctreeId, data, projectId) VALUES (?, ?, ?)`,
  [OctreeId, JSON.stringify(data), projectId]
);

    res.status(200).json({ success: true, message: "Octree saved successfully." });
  } catch (error) {
    console.error("Error saving octree:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};


const saveMergedMesh = async (req, res) => {
  const { MergedMeshId, data, projectId } = req.body;
  
  let connection;
  try {
    connection = await pool.getConnection();

    // Insert merged mesh data
    await connection.query(
      `INSERT INTO MergedMeshes (MergedMeshId, data, projectId) VALUES (?, ?, ?)`,
      [MergedMeshId, JSON.stringify(data), projectId]
    );

    res.status(200).json({ success: true, message: "Merged mesh saved successfully." });
  } catch (error) {
    console.error("Error saving merged mesh:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    if (connection) connection.release();
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

    // Delete from OriginalMeshes
    await connection.query(
      `DELETE FROM OriginalMeshes WHERE projectId = ?`,
      [projectId]
    );

    // Delete from Octree
    await connection.query(
      `DELETE FROM Octree WHERE projectId = ?`,
      [projectId]
    );

    // Delete from MergedMeshes
    await connection.query(
      `DELETE FROM MergedMeshes WHERE projectId = ?`,
      [projectId]
    );

    res.status(200).json({
      success: true,
      message: `All mesh data for project ${projectId} has been deleted.`
    });
  } catch (error) {
    console.error("Error deleting mesh data:", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting project mesh data"
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

    // Fetch data
    const [octreeRows] = await connection.query(
      `SELECT * FROM Octree WHERE projectId = ?`,
      [projectId]
    );

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
      octree: octreeRows[0] || null,
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



 module.exports ={SaveOriginalMesh,saveOctree,saveMergedMesh,DeleteGlobalModal,getGlobalModalData}
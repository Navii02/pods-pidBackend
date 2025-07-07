const { pool } = require("../config/db");


const SaveOriginalMesh = async (req, res) => {
  const { MeshId, data, projectId } = req.body;

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

  let connection;
  try {
    connection = await pool.getConnection();

    // Insert the Octree data
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


 module.exports ={SaveOriginalMesh,saveOctree,saveMergedMesh}
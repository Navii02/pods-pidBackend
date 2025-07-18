const { pool } = require("../config/db");



const AssignUserFeatures = async (req, res) => {
  let connection;
  const { projectId, userIds, assignments } = req.body;
  console.log(req.body);

  try {
    // Validate required fields
    if (!projectId || !userIds || !Array.isArray(userIds) || !Array.isArray(assignments)) {
      return res.status(400).json({ 
        error: "projectId, userIds array, and assignments array are required" 
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Process each user and their assignments
    for (const userId of userIds) {
      for (const assignment of assignments) {
        const { feature, role } = assignment;

        // Validate assignment fields
        if (!feature || !role) {
          await connection.rollback();
          return res.status(400).json({ 
            error: "Each assignment must have feature and role" 
          });
        }

        try {
          // First check if an existing record exists with the same projectId, userId, and feature
          const [existing] = await connection.query(`
            SELECT role FROM user_features 
            WHERE projectId = ? AND userId = ? AND feature = ?
          `, [projectId, userId, feature]);

          if (existing.length > 0) {
            // Update only if the combination exists
            await connection.query(`
              UPDATE user_features 
              SET role = ?
              WHERE projectId = ? AND userId = ? AND feature = ?
            `, [role, projectId, userId, feature]);
          } else {
            // Insert new record if the combination doesn't exist
            await connection.query(`
              INSERT INTO user_features (projectId, userId, feature, role)
              VALUES (?, ?, ?, ?)
            `, [projectId, userId, feature, role]);
          }
          
        } catch (error) {
          console.error(`Error assigning feature ${feature} to user ${userId}:`, error);
          throw error;
        }
      }
    }

    await connection.commit();
    res.status(200).json({ 
      message: "User feature assignments updated successfully",
      assignedUsers: userIds,
      totalAssignments: userIds.length * assignments.length
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error assigning user features:", error.message);
    res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
    });
  } finally {
    if (connection) connection.release();
  }
};
const getAllFeatures = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [features] = await connection.query("SELECT * FROM projectFeatures");
    
    // Return the features array directly
    res.status(200).json(features);
    
  } catch (error) {
    console.error("Error fetching features:", error);
    res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
    });
  } finally {
    if (connection) connection.release();
  }
};

const getUserFeaturesWithProjectNames = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Query to join user_features with projects table
    const [userFeatures] = await connection.query(`
      SELECT 
        uf.id,
        uf.userId,
        uf.feature,
        uf.role,
        p.projectName,
        p.projectId
      FROM 
        user_features uf
      LEFT JOIN 
        projects p ON uf.projectId = p.projectId
      ORDER BY 
        uf.userId, p.projectName
    `);
    
    // Return the combined data
    res.status(200).json(userFeatures);
    
  } catch (error) {
    console.error("Error fetching user features with project names:", error);
    res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
    });
  } finally {
    if (connection) connection.release();
  }
};

 module.exports = {AssignUserFeatures,getAllFeatures,getUserFeaturesWithProjectNames}
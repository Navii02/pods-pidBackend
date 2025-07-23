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


const Adduser = async (req, res) => {
  const { userId, email, username, token, isActive, role } = req.body;
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Check if user already exists
    const [existingUser] = await connection.query(
      `SELECT userId FROM Users WHERE userId = ? OR email = ?`,
      [userId, email]
    );

    if (existingUser.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        data: {
          error: "User already exists",
          userId,
          email,
        },
      });
    }

    // Insert new user
    const [result] = await connection.query(
      `INSERT INTO Users 
       (userId, username, email, token, role, isActive) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        username,
        email,
        token,
        role || 'user', // default role
        isActive !== undefined ? isActive : true, // default active
      ]
    );

    await connection.commit();
    return res.status(200).json({
      data: {
        message: "User created successfully",
        userId,
        insertId: result.insertId,
      },
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Database error:", error);
    return res.status(500).json({
      data: {
        error: "Failed to create user",
        details: error.message,
      },
    });
  } finally {
    if (connection) connection.release();
  }
};

const GetAllUsers = async (req, res) => {
  let connection;

  try {
    connection = await pool.getConnection();

    const [rows] = await connection.query(
      `SELECT userId, username, email, token, role, isActive FROM Users`
    );

    return res.status(200).json({
      data: {
        users: rows,
      },
    });

  } catch (error) {
    console.error("Database error:", error);
    return res.status(500).json({
      data: {
        error: "Failed to fetch users",
        details: error.message,
      },
    });
  } finally {
    if (connection) connection.release();
  }
};
const asignprojectAdmin = async (req, res) => {
  const { assignments } = req.body; // Array of { userId, projectId, role }
  console.log(assignments);
  
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Input validation
    if (!Array.isArray(assignments) || assignments.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        data: {
          error: "Invalid input: expected array of assignments",
        },
      });
    }

    const results = [];
    const errors = [];

    for (const assignment of assignments) {
      const { userId, projectId, role } = assignment;

      // Basic validation
      if (!userId || !projectId || !role) {
        errors.push({
          error: "Missing required fields",
          assignment,
        });
        continue;
      }

      try {
        // Insert new record (no duplicate check)
        const [result] = await connection.query(
          `INSERT INTO user_features 
           (userId, projectId, feature, role) 
           VALUES (?, ?, ?, ?)`,
          [userId, projectId, 'project_access', role]
        );

        results.push({
          status: "created",
          userId,
          projectId,
          role,
          insertId: result.insertId,
        });

      } catch (err) {
        errors.push({
          error: "Database operation failed",
          details: err.message,
          assignment,
        });
      }
    }

    if (results.length === 0) {
      await connection.rollback();
      console.log("Assignment errors:", errors);

      return res.status(400).json({
        data: {
          error: "No assignments were processed",
          errors,
        },
      });
    }

    await connection.commit();

    return res.status(200).json({
      data: {
        message: "Assignments processed",
        successCount: results.length,
        errorCount: errors.length,
        results,
        ...(errors.length > 0 ? { errors } : {}),
      },
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Database error:", error);
    return res.status(500).json({
      data: {
        error: "Failed to process assignments",
        details: error.message,
      },
    });
  } finally {
    if (connection) connection.release();
  }
};
const GetAllUserFeatures = async (req, res) => {
  let connection;

  try {
    connection = await pool.getConnection();

    const [rows] = await connection.query(`
      SELECT 
        uf.userId,
        u.username,
        u.email,
        uf.feature,
        uf.role,
        uf.projectId,
        p.projectName,
        p.projectNumber
      FROM user_features uf
      JOIN Users u ON uf.userId = u.userId
      LEFT JOIN projects p ON uf.projectId = p.projectId
    `);
    console.log("Assigned features",rows);
    

    return res.status(200).json(rows);

  } catch (error) {
    console.error("Database error:", error);
    return res.status(500).json({
      data: {
        error: "Failed to fetch user features",
        details: error.message,
      },
    });
  } finally {
    if (connection) connection.release();
  }
};

const getUsers = async (req, res) => {
  let connection;
  const { userId } = req.body;
  console.log(userId);
  

  try {
    connection = await pool.getConnection();

    // 1. First check if user exists
    const [userRows] = await connection.query(
      `SELECT 
        userId, 
        username, 
        email, 
        role, 
        isActive ,
        token
       FROM Users 
       WHERE userId = ?`,
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const user = userRows[0];
//console.log(user);

    // 2. Get all features for the user
    const [featureRows] = await connection.query(
      `SELECT 
        uf.feature,
        uf.role,
        uf.projectId,
        p.projectName,
        p.projectNumber
       FROM user_features uf
       LEFT JOIN projects p ON uf.projectId = p.projectId
       WHERE uf.userId = ?`,
      [userId]
    );
    //console.log(featureRows);
    

    // 3. Organize features by project
    const projects = {};
    featureRows.forEach(feature => {
      const projectKey = feature.projectId || 'global'; // Handle features not tied to a project
      
      if (!projects[projectKey]) {
        projects[projectKey] = {
          projectId: feature.projectId,
          projectName: feature.projectName,
          projectNumber: feature.projectNumber,
          features: {}
        };
      }
      
      projects[projectKey].features[feature.feature] = feature.role;
    });

    return res.status(200).json({
      user: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        token:user.token
      },
      projects: projects
    });

  } catch (error) {
    console.error("Database error:", error);
    return res.status(500).json({
      error: "Failed to fetch user data",
      details: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};



 module.exports = {AssignUserFeatures,getAllFeatures,getUserFeaturesWithProjectNames,Adduser,GetAllUsers,asignprojectAdmin,GetAllUserFeatures,getUsers}
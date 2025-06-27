const { pool } = require("../config/db");
const path = require("path");
const fs = require("fs").promises;

const GetModal = async (req, res) => {
  let { projectId, areaIds, discIds, systemIds, tagIds } = req.params;

  console.log("Received parameters:", { projectId, areaIds, discIds, systemIds, tagIds });

  if (!projectId) {
    return res.status(400).json({
      success: false,
      message: "Project ID is required",
    });
  }

  // Convert comma-separated strings to arrays
  areaIds = areaIds ? areaIds.split(",") : [];
  discIds = discIds ? discIds.split(",") : [];
  systemIds = systemIds ? systemIds.split(",") : [];
  tagIds = tagIds ? tagIds.split(",") : [];

  let connection;

  try {
    connection = await pool.getConnection();

    let query = `
      SELECT 
        tr.area, 
        tr.disc, 
        tr.sys, 
        tr.tag,
         t.tagId,
        t.filename,
        t.projectId
      FROM Tree tr
      JOIN Tags t ON tr.tag = t.number
      WHERE tr.project_id = ?
    `;
    const queryParams = [projectId];

    if (tagIds.length > 0) {
      query += " AND tr.tag IN (?)";
      queryParams.push(tagIds);
    } else {
      if (areaIds.length > 0) {
        query += " AND tr.area IN (?)";
        queryParams.push(areaIds);
      }
      if (discIds.length > 0) {
        query += " AND tr.disc IN (?)";
        queryParams.push(discIds);
      }
      if (systemIds.length > 0) {
        query += " AND tr.sys IN (?)";
        queryParams.push(systemIds);
      }
    }

    const [rows] = await connection.query(query, queryParams);

    if (!rows || rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No matching records found",
      });
    }

    const results = await Promise.all(
      rows.map(async (row) => {
        const tagsFolderPath = path.join(__dirname, "..", "tags");
        const filePath = path.join(tagsFolderPath, row.filename);

        let fileDetails;
        try {
          await fs.access(filePath);
          const stats = await fs.stat(filePath);
          fileDetails = {
            filepath: row.filename,
            filename: row.filename,
            basename: path.basename(filePath),
            created: stats.birthtime,
            modified: stats.mtime,
            accessed: stats.atime,
            size: stats.size,
            exists: true,
          };
        } catch (err) {
          fileDetails = {
            message: "File not found in storage",
            filename: row.filename,
            path: filePath,
            exists: false,
          };
        }

        return {
          area: row.area,
          disc: row.disc,
          sys: row.sys,
          tag: row.tag,
          tagId:row.tagId,
          projectId: row.projectId,
          file: fileDetails,
          filename: row.filename,
        };
      })
    );

    res.status(200).json({
      success: true,
      message: "Data retrieved successfully",
      data: results,
    });
  } catch (error) {
    console.error("Error in GetModal:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};
const getGroundSettings = async (req, res) => {
  let connection;
  try {
    const { projectId } = req.params;
    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }
    connection = await pool.getConnection();
    const [rows] = await connection.query("SELECT * FROM GroundSettings WHERE projectId = ?", [projectId]);
    console.log(rows);
    res.status(200).json( rows[0] );
  } catch (error) {
    console.error("Error fetching GroundSettings:", error);
    res.status(500).json("Internal server error");
  } finally {
    if (connection) connection.release();
  }
};

const getWaterSettings = async (req, res) => {
  let connection;
  try {
    const { projectId } = req.params;
    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }
    connection = await pool.getConnection();
    const [rows] = await connection.query("SELECT * FROM WaterSettings WHERE projectId = ?", [projectId]);
    console.log(rows);
    res.status(200).json(rows[0] );
  } catch (error) {
    console.error("Error fetching WaterSettings:", error);
    res.status(500).json("Internal server error");
  } finally {
    if (connection) connection.release();
  }
};

const getBasesettings = async (req, res) => {
  let connection;
  try {
    const { projectId } = req.params;
    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }
    connection = await pool.getConnection();
    const [rows] = await connection.query("SELECT * FROM SettingsTable WHERE projectId = ?", [projectId]);
    console.log(rows);
    res.status(200).json(rows[0] );
  } catch (error) {
    console.error("Error fetching SettingsTable:", error);
    res.status(500).json("Internal server error");
  } finally {
    if (connection) connection.release();
  }
};


const updateGroundSettings = async (req, res) => {
  let connection;
  try {
    
    const { projectId,level, color, opacity } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }
    if (level === undefined || color === undefined || opacity === undefined) {
      return res.status(400).json({ error: "level, color, and opacity are required" });
    }

    connection = await pool.getConnection();
    const [result] = await connection.query(
      "UPDATE GroundSettings SET level = ?, color = ?, opacity = ? WHERE projectId = ?",
      [level, color, opacity, projectId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "No GroundSettings found for the provided projectId" });
    }

    console.log(`Updated GroundSettings for projectId: ${projectId}`);
    res.status(200).json({ message: "GroundSettings updated successfully" });
  } catch (error) {
    console.error("Error updating GroundSettings:", error);
    res.status(500).json("Internal server error");
  } finally {
    if (connection) connection.release();
  }
};

const updateWaterSettings = async (req, res) => {
  let connection;
  try {
    const { projectId,level, opacity, color, colorBlendFactor, bumpHeight, waveLength, windForce } = req.body;
    console.log(req.body);
    

    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }
    if (
      level === undefined ||
      opacity === undefined ||
      color === undefined ||
      colorBlendFactor === undefined ||
      bumpHeight === undefined ||
      waveLength === undefined ||
      windForce === undefined
    ) {
      return res.status(400).json({ error: "All WaterSettings fields are required" });
    }

    connection = await pool.getConnection();
    const [result] = await connection.query(
      "UPDATE WaterSettings SET level = ?, opacity = ?, color = ?, colorBlendFactor = ?, bumpHeight = ?, waveLength = ?, windForce = ? WHERE projectId = ?",
      [level, opacity, color, colorBlendFactor, bumpHeight, waveLength, windForce, projectId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "No WaterSettings found for the provided projectId" });
    }

    console.log(`Updated WaterSettings for projectId: ${projectId}`);
    res.status(200).json({ message: "WaterSettings updated successfully" });
  } catch (error) {
    console.error("Error updating WaterSettings:", error);
    res.status(500).json("Internal server error");
  } finally {
    if (connection) connection.release();
  }
};

const updateBaseSettings = async (req, res) => {
  let connection;
  try {
    const {  projectId,settings } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }
    if (settings === undefined) {
      return res.status(400).json({ error: "settings is required" });
    }

    connection = await pool.getConnection();
    const [result] = await connection.query(
      "UPDATE SettingsTable SET settings = ? WHERE projectId = ?",
      [settings, projectId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "No SettingsTable entry found for the provided projectId" });
    }

    console.log(`Updated SettingsTable for projectId: ${projectId}`);
    res.status(200).json({ message: "SettingsTable updated successfully" });
  } catch (error) {
    console.error("Error updating SettingsTable:", error);
    res.status(500).json("Internal server error");
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { GetModal,getGroundSettings,getBasesettings,getWaterSettings,updateBaseSettings,updateWaterSettings,updateGroundSettings };

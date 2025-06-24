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

module.exports = { GetModal };

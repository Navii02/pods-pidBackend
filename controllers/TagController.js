const { pool } = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const fs = require("fs").promises;
const path = require("path");

const generateCustomID = (prefix) => {
  const uuid = uuidv4();
  const uniqueID = prefix + uuid.replace(/-/g, "").slice(0, 11);
  return uniqueID;
};

const SaveUpdatedTagFile = async (req, res) => {
  try {
    const { fileNamePath } = req.body;

    if (!fileNamePath || !Array.isArray(fileNamePath) || fileNamePath.length === 0) {
      return res.status(400).json({ error: "No valid files data provided" });
    }

    const uploadDir = path.join(__dirname, "..", "unassignedModels");
    
    // Make sure target directory exists
    try {
      await fs.access(uploadDir);
    } catch (err) {
      if (err.code === 'ENOENT') {
        await fs.mkdir(uploadDir, { recursive: true });
      } else {
        throw err;
      }
    }

    const results = [];

    for (const fileData of fileNamePath) {
      try {
        const destPath = path.join(uploadDir, fileData.name);

        // Check if file exists
        try {
          await fs.access(destPath); // File exists — we will overwrite
        } catch {
          results.push({
            name: fileData.name,
            status: "skipped",
            reason: "File does not exist"
          });
          continue;
        }

        // Handle buffer data
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

        // Overwrite the existing file
        await fs.writeFile(destPath, buffer);

        results.push({
          name: fileData.name,
          path: destPath,
          status: "updated"
        });

      } catch (fileError) {
        console.error(`Error updating file ${fileData?.name}:`, fileError);
        results.push({
          name: fileData?.name || 'unknown',
          status: "failed",
          error: fileError.message
        });
      }
    }

    res.status(200).json({
      status: 200,
      message: "File update process completed",
      files: results,
    });

  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({
      status: 500,
      message: "Server error",
      error: err.message,
    });
  }
};


// const AddTag = async (req, res) => {
//   let connection;
//   const { tagNumber, parentTag, name, type, model, project_id } = req.body;
//   console.log(req.body);
  

//   try {
//     // Validate required fields
//     if (!tagNumber || !name || !type) {
//       return res
//         .status(400)
//         .json({ error: "tagNumber, name, and type are required" });
//     }

//     const tagId = generateCustomID("TAG-");
//     connection = await pool.getConnection();
//     await connection.beginTransaction();

//     // 🟨 If model is provided, try to move it to /tags if not already there
//     if (model) {
//     const modelsDir = path.join(__dirname, "..", "models", project_id);
//       const tagsDir = path.join(__dirname, "..", "tags", project_id);
//       const sourceFile = path.join(modelsDir, model);
//       const destFile = path.join(tagsDir, model);

   

//       try {
//         // Check if target already exists
//      // Create tags directory if it doesn't exist
//         await fs.mkdir(tagsDir, { recursive: true });
        
//         // Check if source file exists
//         await fs.access(sourceFile);
        
//         // Move the specific file
//         await fs.rename(sourceFile, destFile);
//       } catch (err) {
//         if (err.code === 'ENOENT') {
//           console.log(`File not found: ${sourceFile}`);
//           // Continue without failing if file doesn't exist
//         } else {
//           throw err; // Re-throw unexpected errors
//         }
//       }
//     }

//     // ⬇ Insert into Tags table
//     await connection.query(
//       `INSERT INTO Tags (tagId, number, name, parenttag, type, filename, projectId)
//        VALUES (?, ?, ?, ?, ?, ?, ?)`,
//       [tagId, tagNumber, name, parentTag || null, type, model || null, project_id]
//     );

//     await connection.query(
//       `INSERT INTO TagInfo (projectId, tagId, tag, type)
//        VALUES (?, ?, ?, ?)`,
//       [project_id, tagId, name, type]
//     );

//     // ⬇ Insert based on type
//     if (type.toLowerCase() === "line") {
//       await connection.query(
//         `INSERT INTO LineList (projectId, tagId, tag) VALUES (?, ?, ?)`,
//         [project_id, tagId, name]
//       );
//     } else if (type.toLowerCase() === "equipment") {
//       await connection.query(
//         `INSERT INTO EquipmentList (projectId, tagId, tag) VALUES (?, ?, ?)`,
//         [project_id, tagId, name]
//       );
//     } else if (type.toLowerCase() === "valve") {
//       await connection.query(
//         `INSERT INTO ValveList (projectId, tagId, tag) VALUES (?, ?, ?)`,
//         [project_id, tagId, name]
//       );
//     }

//     await connection.commit();
//     res.status(201).json({ message: "Tag added successfully", tagId });

//   } catch (error) {
//     if (connection) await connection.rollback();
//     console.error("Error adding tag:", error.message);
//     res.status(500).json({ error: "Internal server error" });
//   } finally {
//     if (connection) connection.release();
//   }
// };

const AddTag = async (req, res) => {
  let connection;
    const { 
    tagNumber, 
    name, 
    type, 
    parentTag, 
    model,
    area, 
    areaName, 
    discipline, 
    disciplineName, 
    system, 
    systemName, 
    project_id 
  } = req.body;
  console.log(req.body);
  

  try {
    // Validate required fields
    if (!tagNumber || !name || !type) {
      return res
        .status(400)
        .json({ error: "tagNumber, name, and type are required" });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 🟨 If model is provided, try to move it to /tags if not already there
    if (model) {
    const modelsDir = path.join(__dirname, "..", "models", project_id);
      const tagsDir = path.join(__dirname, "..", "tags", project_id);
      const sourceFile = path.join(modelsDir, model);
      const destFile = path.join(tagsDir, model);

   

      try {
        // Check if target already exists
     // Create tags directory if it doesn't exist
        await fs.mkdir(tagsDir, { recursive: true });
        
        // Check if source file exists
        await fs.access(sourceFile);
        
        // Move the specific file
        await fs.rename(sourceFile, destFile);
      } catch (err) {
        if (err.code === 'ENOENT') {
          console.log(`File not found: ${sourceFile}`);
          // Continue without failing if file doesn't exist
        } else {
          throw err; // Re-throw unexpected errors
        }
      }
    }


    let areaId = null;
    let discId = null;
    let sysId = null;

    // 1. Handle Area creation/verification
    if (area && areaName) {
      // Check if area exists in Areatable
      const [existingArea] = await connection.query(
        `SELECT areaId FROM Areatable WHERE area = ? AND project_id = ?`,
        [area, project_id]
      );

      if (existingArea.length > 0) {
        areaId = existingArea[0].areaId;
      } else {
        // Create new area
        areaId = generateCustomID("A-");
        await connection.query(
          `INSERT INTO Areatable (areaId, area, name, project_id) VALUES (?, ?, ?, ?)`,
          [areaId, area, areaName, project_id]
        );
      }

      // Ensure area exists in Tree table
      const [existingAreaTree] = await connection.query(
        `SELECT id FROM Tree WHERE area = ? AND project_id = ? AND disc IS NULL AND sys IS NULL AND tag IS NULL`,
        [area, project_id]
      );

      if (existingAreaTree.length === 0) {
        await connection.query(
          `INSERT INTO Tree (area, name, project_id) VALUES (?, ?, ?)`,
          [area, areaName, project_id]
        );
      }
    }

    // 2. Handle Discipline creation/verification
    if (discipline && disciplineName && area) {
      // Check if discipline exists in Disctable
      const [existingDisc] = await connection.query(
        `SELECT discId FROM Disctable WHERE disc = ? AND project_id = ?`,
        [discipline, project_id]
      );

      if (existingDisc.length > 0) {
        discId = existingDisc[0].discId;
      } else {
        // Create new discipline
        discId = generateCustomID("D-");
        await connection.query(
          `INSERT INTO Disctable (discId, disc, name, project_id) VALUES (?, ?, ?, ?)`,
          [discId, discipline, disciplineName, project_id]
        );
      }

      // Ensure discipline exists in Tree table
      const [existingDiscTree] = await connection.query(
        `SELECT id FROM Tree WHERE area = ? AND disc = ? AND project_id = ? AND sys IS NULL AND tag IS NULL`,
        [area, discipline, project_id]
      );

      if (existingDiscTree.length === 0) {
        await connection.query(
          `INSERT INTO Tree (area, disc, name, project_id) VALUES (?, ?, ?, ?)`,
          [area, discipline, disciplineName, project_id]
        );
      }
    }

    // 3. Handle System creation/verification
    if (system && systemName && area && discipline) {
      // Check if system exists in Systable
      const [existingSys] = await connection.query(
        `SELECT sysId FROM Systable WHERE sys = ? AND project_id = ?`,
        [system, project_id]
      );

      if (existingSys.length > 0) {
        sysId = existingSys[0].sysId;
      } else {
        // Create new system
        sysId = generateCustomID("S-");
        await connection.query(
          `INSERT INTO Systable (sysId, sys, name, project_id) VALUES (?, ?, ?, ?)`,
          [sysId, system, systemName, project_id]
        );
      }

      // Ensure system exists in Tree table
      const [existingSysTree] = await connection.query(
        `SELECT id FROM Tree WHERE area = ? AND disc = ? AND sys = ? AND project_id = ? AND tag IS NULL`,
        [area, discipline, system, project_id]
      );

      if (existingSysTree.length === 0) {
        await connection.query(
          `INSERT INTO Tree (area, disc, sys, name, project_id) VALUES (?, ?, ?, ?, ?)`,
          [area, discipline, system, systemName, project_id]
        );
      }
    }


     // 🚨 Check if tag number already exists in the project
    const [existingTag] = await connection.query(
      `SELECT tagId, number FROM Tags WHERE number = ? AND projectId = ?`,
      [tagNumber, project_id]
    );

    if (existingTag.length > 0) {
      await connection.rollback();
      return res.status(409).json({ 
        error: "Tag number already exists in this project",
        details: `Tag number '${tagNumber}' is already registered in project '${project_id}'`,
        existingTagId: existingTag[0].tagId
      });
    }

    const tagId = generateCustomID("TAG-");

    // ⬇ Insert into Tags table
    await connection.query(
      `INSERT INTO Tags (tagId, number, name, parenttag, type, filename, projectId)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tagId, tagNumber, name, parentTag || null, type, model || null, project_id]
    );

    await connection.query(
      `INSERT INTO TagInfo (projectId, tagId, tag, type)
       VALUES (?, ?, ?, ?)`,
      [project_id, tagId, name, type]
    );
 if (area && discipline && system) {
      await connection.query(
        `INSERT INTO Tree (area, disc, sys, tag, name, project_id) VALUES (?, ?, ?, ?, ?, ?)`,
        [area, discipline, system, tagNumber, name, project_id]
      );
    }
    // ⬇ Insert based on type
    if (type.toLowerCase() === "line") {
      await connection.query(
        `INSERT INTO LineList (projectId, tagId, tag) VALUES (?, ?, ?)`,
        [project_id, tagId, name]
      );
    } else if (type.toLowerCase() === "equipment") {
      await connection.query(
        `INSERT INTO EquipmentList (projectId, tagId, tag) VALUES (?, ?, ?)`,
        [project_id, tagId, name]
      );
    } else if (type.toLowerCase() === "valve") {
      await connection.query(
        `INSERT INTO ValveList (projectId, tagId, tag) VALUES (?, ?, ?)`,
        [project_id, tagId, name]
      );
    }

    await connection.commit();
    res.status(201).json({ message: "Tag added successfully", tagId });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error adding tag:", error.message);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};



const getTags = async (req, res) => {
  const projectId = req.params.id;
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Join Tags with Tree table to get area, disc, sys
    const [Tags] = await connection.query(
      `SELECT 
        t.*,
        tr.area,
        tr.disc as discipline,
        tr.sys as \`system\`
      FROM Tags t 
      LEFT JOIN Tree tr ON t.number = tr.tag AND t.projectId = tr.project_id 
      WHERE t.projectId = ?
      ORDER BY t.number`,
      [projectId]
    );
    
    res.status(200).json(Tags);
  } catch (error) {
    console.error("Error fetching tags with tree data:", error);
    res.status(500).json("Internal server error");
  } finally {
    if (connection) connection.release();
  }
};

const deleteTag = async (req, res) => {
  const { id } = req.params;
  const tagId = id;
  let connection;

  try {
    connection = await pool.getConnection();

    const [existingTag] = await connection.query(
      "SELECT * FROM Tags WHERE tagId = ?",
      [tagId]
    );

    if (existingTag.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tag not found",
      });
    }

    const { filename, type, projectId } = existingTag[0];

    // Delete from database
    await connection.query("DELETE FROM Tags WHERE tagId = ?", [tagId]);

    // Delete from type-specific table
    const typeLower = type?.toLowerCase();
    if (typeLower === 'line') {
      await connection.query("DELETE FROM LineList WHERE tagId = ?", [tagId]);
    } else if (typeLower === 'equipment') {
      await connection.query("DELETE FROM EquipmentList WHERE tagId = ?", [tagId]);
    } else if (typeLower === 'valve') {
      await connection.query("DELETE FROM ValveList WHERE tagId = ?", [tagId]);
    }

    // Delete associated file from project-specific directory
    if (filename && projectId) {
      const filePath = path.join(__dirname, "..", "tags", projectId, filename);
      try {
        await fs.unlink(filePath);
        console.log(`Deleted tag file: ${filePath}`);
      } catch (err) {
        if (err.code !== 'ENOENT') { // Ignore if file doesn't exist
          throw err;
        }
      }
    }

    res.status(200).json({
      success: true,
      message: "Tag deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting tag:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete tag",
      details: error.message
    });
  } finally {
    if (connection) connection.release();
  }
};

const getTagByProjectAndFilename = async (req, res) => {
  const { projectId, filename } = req.params;
  let connection;

  try {
    connection = await pool.getConnection();

    // Get tag details from database
    const [result] = await connection.query(
      "SELECT * FROM Tags WHERE projectId = ? AND filename = ?",
      [projectId, filename]
    );

    if (result.length > 0) {
      const tagDetails = result[0];

      // Get file metadata from unassignedModels folder
      let fileMetadata = null;
      try {
        const filePath = path.join(__dirname, "../unassignedModels", filename);
        console.log("🔍 Looking for file at path:", filePath);

        const stats = await fs.stat(filePath);

        fileMetadata = {
          exists: true,
          fileName: filename,
          fileSize: stats.size,
          fileSizeFormatted: formatFileSize(stats.size),
          createdDate: stats.birthtime,
          modifiedDate: stats.mtime,
          accessedDate: stats.atime,
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          filePath: filePath,
        };

        console.log("File metadata retrieved:", fileMetadata);
      } catch (fileError) {
        console.error("Error accessing file:", fileError.message);
        fileMetadata = {
          exists: false,
          fileName: filename,
          error: fileError.message,
          filePath: path.join(__dirname, "../unassignedModels", filename),
        };
      }

      // Combine tag details with file metadata
      const response = {
        ...tagDetails,
        fileMetadata: fileMetadata,
      };

      res.status(200).json(response);
    } else {
      res.status(404).json({
        message: "Tag not found for the given projectId and filename",
        requestedFile: filename,
        projectId: projectId,
      });
    }
  } catch (error) {
    console.error("❌ Error fetching tag:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Helper function to format file size in  readable format
const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};


const updateTag = async (req, res) => {
  const { id, projectId } = req.params;
  const tagId = id;
  const project_Id = projectId;
  console.log(req.body);

  const { number, name, type, parentTag, filename } = req.body;
  let connection;

  try {
    if (!number || !name || !type) {
      return res.status(400).json({
        success: false,
        message: "Number, name, and type are required fields",
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction(); // Start transaction

    // Get the current tag values before updating
    const [existingTag] = await connection.query(
      "SELECT * FROM Tags WHERE tagId = ? AND projectId = ?",
      [tagId, project_Id]
    );

    if (existingTag.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Tag not found",
      });
    }

    const oldType = existingTag[0].type;
    const newType = type.toLowerCase();
    const oldTypeLower = oldType?.toLowerCase();

    // Update the Tags table
    await connection.query(
      `UPDATE Tags 
       SET number = ?, name = ?, type = ?, parentTag = ?, filename = ?
       WHERE tagId = ? AND projectId = ?`,
      [number, name, type, parentTag, filename || null, tagId, project_Id]
    );

    // Update the TagInfo table
    await connection.query(
      `UPDATE TagInfo 
       SET tag = ?, type = ?
       WHERE tagId = ? AND projectId = ?`,
      [name, type, tagId, project_Id]
    );

    // Update the Tree table - both tag (number) and name
    await connection.query(
      `UPDATE Tree 
       SET tag = ?, name = ?
       WHERE tag = ? AND project_id = ?`,
      [number, name, existingTag[0].number, project_Id]
    );

    // Handle type changes - move between type-specific tables
    if (oldTypeLower !== newType) {
      console.log(`Type changed from ${oldTypeLower} to ${newType}`);
      
      // Remove from old type-specific table
      if (oldTypeLower === 'line') {
        await connection.query("DELETE FROM LineList WHERE tagId = ? AND projectId = ?", [tagId, project_Id]);
      } else if (oldTypeLower === 'equipment') {
        await connection.query("DELETE FROM EquipmentList WHERE tagId = ? AND projectId = ?", [tagId, project_Id]);
      } else if (oldTypeLower === 'valve') {
        await connection.query("DELETE FROM ValveList WHERE tagId = ? AND projectId = ?", [tagId, project_Id]);
      }

      // Add to new type-specific table
      if (newType === 'line') {
        await connection.query(
          `INSERT INTO LineList (projectId, tagId, tag) 
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE tag = VALUES(tag)`,
          [project_Id, tagId, name]
        );
      } else if (newType === 'equipment') {
        await connection.query(
          `INSERT INTO EquipmentList (projectId, tagId, tag) 
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE tag = VALUES(tag)`,
          [project_Id, tagId, name]
        );
      } else if (newType === 'valve') {
        await connection.query(
          `INSERT INTO ValveList (projectId, tagId, tag) 
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE tag = VALUES(tag)`,
          [project_Id, tagId, name]
        );
      }
    } else {
      // If type didn't change, just update the tag name in the existing type-specific table
      if (newType === 'line') {
        await connection.query(
          `UPDATE LineList SET tag = ? WHERE tagId = ? AND projectId = ?`,
          [name, tagId, project_Id]
        );
      } else if (newType === 'equipment') {
        await connection.query(
          `UPDATE EquipmentList SET tag = ? WHERE tagId = ? AND projectId = ?`,
          [name, tagId, project_Id]
        );
      } else if (newType === 'valve') {
        await connection.query(
          `UPDATE ValveList SET tag = ? WHERE tagId = ? AND projectId = ?`,
          [name, tagId, project_Id]
        );
      }
    }

    await connection.commit(); // Commit the transaction

    const [updatedTag] = await connection.query(
      "SELECT * FROM Tags WHERE tagId = ? AND projectId = ?",
      [tagId, project_Id]
    );

    res.status(200).json({
      success: true,
      message: "Tag updated successfully",
      data: updatedTag[0],
      typeChanged: oldTypeLower !== newType,
      oldType: oldTypeLower,
      newType: newType
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error updating tag:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update tag",
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
};

const AssignTag = async (req, res) => {
  console.log(req.body);

  const { tagId, uniqueIds, fileId } = req.body;

  // Validate input
  if (
    !tagId ||
    !uniqueIds ||
    !Array.isArray(uniqueIds) ||
    uniqueIds.length === 0 ||
    !fileId
  ) {
    return res.status(400).json({
      success: false,
      message: "tagId, fileId, and a non-empty array of uniqueIds are required",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Check for existing assignments
    const [existing] = await connection.query(
      `SELECT unique_id FROM spidTags
       WHERE file_id = ? AND tag_id = ? AND unique_id IN (?)`,
      [fileId, tagId, uniqueIds]
    );

    const existingUniqueIds = existing.map((row) => row.unique_id);
    const newUniqueIds = uniqueIds.filter(
      (id) => !existingUniqueIds.includes(id)
    );

    // Insert new assignments
    if (newUniqueIds.length > 0) {
      const values = newUniqueIds.map((uniqueId) => [
        tagId,
        uniqueId,
        fileId,
        new Date(),
      ]);
      await connection.query(
        `INSERT INTO spidTags (tag_id, unique_id, file_id, assigned_at)
         VALUES ?`,
        [values]
      );
    }

    await connection.commit();

    // Prepare response
    const response = {
      success: true,
      message:
        newUniqueIds.length === uniqueIds.length
          ? "All tags assigned successfully"
          : newUniqueIds.length > 0
          ? `${newUniqueIds.length} of ${uniqueIds.length} tags assigned successfully; ${existingUniqueIds.length} already assigned`
          : `No new tags assigned; all ${existingUniqueIds.length} items already have this tag`,
      assignedIds: newUniqueIds,
      skippedIds: existingUniqueIds,
    };

    res.status(200).json(response);
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error assigning tags:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign tags",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};
let connection;
const getAssignedTags = async (req, res) => {
  connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    const { id } = req.params;
    const fileId = id;
    console.log("Fetching tags for fileId:", fileId);

    const [tags] = await connection.query(
      `SELECT st.unique_id, st.tag_id, t.name
       FROM spidTags st
       INNER JOIN tags t ON st.tag_id = t.tagId
       WHERE st.file_id = ?`,
      [fileId]
    );

    await connection.commit();

    // Group by tag_id and include tagName
    const tagMap = [];
    const tagGroups = {};

    tags.forEach(({ unique_id, tag_id, name }) => {
      if (!tagGroups[tag_id]) {
        tagGroups[tag_id] = {
          tag_id,
          tagName: name,
          uniqueIds: [],
        };
        tagMap.push(tagGroups[tag_id]);
      }
      tagGroups[tag_id].uniqueIds.push({ unique_id });
    });

    console.log("Tags fetched:", tagMap);
    res.status(200).json(tagMap);
  } catch (error) {
    await connection.rollback();
    console.error("Error fetching tags:", error);
    res.status(500).json({ error: "Failed to fetch tags" });
  } finally {
    if (connection) connection.release();
  }
};

const getDocumentsByTag = async (req, res) => {
  const tagId = req.params.tagId;
  let connection;
  try {
    connection = await pool.getConnection();

    const [rows] = await connection.query(
      `
      SELECT DISTINCT d.documentId, d.title, d.number
      FROM SpidTags st
      JOIN Documents d ON st.file_id = d.documentId
      WHERE st.tag_id = ?
    `,
      [tagId]
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching documents by tag:", error);
    return { status: 500, error: "Failed to fetch documents" };
  }
};
//LineList

const GetLineList = async (req, res) => {
  const projectId = req.params.id;
  let connection;
  try {
    connection = await pool.getConnection();
    const [LineList] = await connection.query(
      "SELECT * from LineList WHERE projectId = ?",
      [projectId]
    );
    res.status(200).json(LineList);
  } catch (error) {
    res.status(500).json("Internal server error");
  } finally {
    connection.release();
  }
};
const GetLineListUsingTagId = async (req, res) => {
  const { id, tagId } = req.params;
  let connection;

  try {
    connection = await pool.getConnection();

    const [result] = await connection.query(
      "SELECT * FROM LineList WHERE projectId = ? AND tagId = ?",
      [id, tagId]
    );
    console.log(result);
    if (result.length > 0) {
      res.status(200).json(result[0]);
    } else {
      res
        .status(404)
        .json({
          message: "line list not found for the given projectId and tagid",
        });
    }
  } catch (error) {
    console.error("Error fetching line list:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};
const EditLineList = async (req, res) => {
  let connection;
  try {
    const {
      projectId,
      tagId,
      tag,
      fluidCode,
      lineId,
      medium,
      lineSizeIn,
      lineSizeNb,
      pipingSpec,
      insType,
      insThickness,
      heatTrace,
      lineFrom,
      lineTo,
      pnid,
      pipingIso,
      pipingStressIso,
      maxOpPress,
      maxOpTemp,
      dsgnPress,
      minDsgnTemp,
      maxDsgnTemp,
      testPress,
      testMedium,
      testMediumPhase,
      massFlow,
      volFlow,
      density,
      velocity,
      paintSystem,
      ndtGroup,
      chemCleaning,
      pwht,
    } = req.body;

    // Validate required fields
    if (!projectId || !tag) {
      return res
        .status(400)
        .json({ error: "projectId and tag are required fields" });
    }

    // Get connection from pool
    connection = await pool.getConnection();

    // Prepare the update query
    const updateQuery = `
      UPDATE LineList 
      SET 
        tagId = ?,
        fluidCode = ?,
        lineId = ?,
        medium = ?,
        lineSizeIn = ?,
        lineSizeNb = ?,
        pipingSpec = ?,
        insType = ?,
        insThickness = ?,
        heatTrace = ?,
        lineFrom = ?,
        lineTo = ?,
        pnid = ?,
        pipingIso = ?,
        pipingStressIso = ?,
        maxOpPress = ?,
        maxOpTemp = ?,
        dsgnPress = ?,
        minDsgnTemp = ?,
        maxDsgnTemp = ?,
        testPress = ?,
        testMedium = ?,
        testMediumPhase = ?,
        massFlow = ?,
        volFlow = ?,
        density = ?,
        velocity = ?,
        paintSystem = ?,
        ndtGroup = ?,
        chemCleaning = ?,
        pwht = ?
      WHERE tag = ? AND projectId = ?;
    `;

    // Execute the update query
    const [result] = await connection.query(updateQuery, [
      tagId || null,
      fluidCode || null,
      lineId || null,
      medium || null,
      lineSizeIn || null,
      lineSizeNb || null,
      pipingSpec || null,
      insType || null,
      insThickness || null,
      heatTrace || null,
      lineFrom || null,
      lineTo || null,
      pnid || null,
      pipingIso || null,
      pipingStressIso || null,
      maxOpPress || null,
      maxOpTemp || null,
      dsgnPress || null,
      minDsgnTemp || null,
      maxDsgnTemp || null,
      testPress || null,
      testMedium || null,
      testMediumPhase || null,
      massFlow || null,
      volFlow || null,
      density || null,
      velocity || null,
      paintSystem || null,
      ndtGroup || null,
      chemCleaning || null,
      pwht || null,
      tag,
      projectId,
    ]);

    // Check if any rows were affected
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: "No record found with the given tag and projectId" });
    }

    res.status(200).json({
      success: true,
      message: "Line list updated successfully",
      affectedRows: result.affectedRows,
    });
  } catch (error) {
    console.error("Error updating LineList:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};
//equipmentList

const GetequipmentList = async (req, res) => {
  const projectId = req.params.id;
  let connection;
  try {
    connection = await pool.getConnection();
    const [EquipmentList] = await connection.query(
      "SELECT * from EquipmentList WHERE projectId = ?",
      [projectId]
    );

    res.status(200).json(EquipmentList);
  } catch (error) {
    res.status(500).json("Internal server error");
  } finally {
    connection.release();
  }
};
const GetEquipmentListUsingTagId = async (req, res) => {
  const { id, tagId } = req.params;
  let connection;

  try {
    connection = await pool.getConnection();

    const [result] = await connection.query(
      "SELECT * FROM EquipmentList WHERE projectId = ? AND tagId = ?",
      [id, tagId]
    );
    console.log(result);
    if (result.length > 0) {
      res.status(200).json(result[0]);
    } else {
      res
        .status(404)
        .json({
          message: "EquipmentList  not found for the given projectId and tagid",
        });
    }
  } catch (error) {
    console.error("Error fetching EquipmentList:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};
const EditEquipmentList = async (req, res) => {
  let connection;
  try {
    const {
      projectId,
      tagId,
      tag,
      descr,
      qty,
      capacity,
      type,
      materials,
      capacityDuty,
      dims,
      dsgnPress,
      opPress,
      dsgnTemp,
      opTemp,
      dryWeight,
      opWeight,
      pnid,
      supplier,
      remarks,
      initStatus,
      revision,
      revisionDate,
    } = req.body;

    // Validate required fields
    if (!projectId || !tag) {
      return res
        .status(400)
        .json({ error: "projectId and tag are required fields" });
    }

    // Get connection from pool
    connection = await pool.getConnection();

    // Prepare the update query
    const updateQuery = `
      UPDATE EquipmentList 
      SET 
        tagId = ?,
        descr = ?,
        qty = ?,
        capacity = ?,
        type = ?,
        materials = ?,
        capacityDuty = ?,
        dims = ?,
        dsgnPress = ?,
        opPress = ?,
        dsgnTemp = ?,
        opTemp = ?,
        dryWeight = ?,
        opWeight = ?,
        pnid = ?,
        supplier = ?,
        remarks = ?,
        initStatus = ?,
        revision = ?,
        revisionDate = ?
      WHERE tag = ? AND projectId = ?;
    `;

    // Execute the update query
    const [result] = await connection.query(updateQuery, [
      tagId || null,
      descr || null,
      qty || null,
      capacity || null,
      type || null,
      materials || null,
      capacityDuty || null,
      dims || null,
      dsgnPress || null,
      opPress || null,
      dsgnTemp || null,
      opTemp || null,
      dryWeight || null,
      opWeight || null,
      pnid || null,
      supplier || null,
      remarks || null,
      initStatus || null,
      revision || null,
      revisionDate || null,
      tag,
      projectId,
    ]);

    // Check if any rows were affected
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: "No equipment found with the given tag and projectId" });
    }

    res.status(200).json({
      success: true,
      message: "Equipment updated successfully",
      affectedRows: result.affectedRows,
    });
  } catch (error) {
    console.error("Error updating EquipmentList:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

//valvelist

const GetValveList = async (req, res) => {
  const projectId = req.params.id;
  let connection;
  try {
    connection = await pool.getConnection();
    const [ValveList] = await connection.query(
      "SELECT * from valveList WHERE projectId = ?",
      [projectId]
    );

    res.status(200).json(ValveList);
  } catch (error) {
    res.status(500).json("Internal server error");
  } finally {
    connection.release();
  }
};
const GetValveListUsingTagId = async (req, res) => {
  const { id, tagId } = req.params;
  let connection;

  try {
    connection = await pool.getConnection();

    const [result] = await connection.query(
      "SELECT * FROM valveList WHERE projectId = ? AND tagId = ?",
      [id, tagId]
    );
    if (result.length > 0) {
      res.status(200).json(result[0]);
    } else {
      res
        .status(404)
        .json({
          message: "valveList not found for the given projectId and tagid",
        });
    }
  } catch (error) {
    console.error("Error fetching valveList:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};
const EditValveList = async (req, res) => {
  let connection;
  try {
    const {
      projectId,
      tagId,
      tag,
      area,
      discipline,
      Systm,
      function_code,
      sequence_number,
      line_id,
      line_number,
      pid,
      isometric,
      data_sheet,
      drawings,
      design_pressure,
      design_temperature,
      size,
      paint_system,
      purchase_order,
      supplier,
      information_status,
      equipment_status,
      comment,
    } = req.body;

    // Validate required fields
    if (!projectId || !tag) {
      return res
        .status(400)
        .json({ error: "projectId and tag are required fields" });
    }

    // Get connection from pool
    connection = await pool.getConnection();

    // Prepare the update query
    const updateQuery = `
      UPDATE valveList 
      SET 
        area = ?,
        discipline = ?,
        Systm = ?,
        function_code = ?,
        sequence_number = ?,
        tagId = ?,
        line_id = ?,
        line_number = ?,
        pid = ?,
        isometric = ?,
        data_sheet = ?,
        drawings = ?,
        design_pressure = ?,
        design_temperature = ?,
        size = ?,
        paint_system = ?,
        purchase_order = ?,
        supplier = ?,
        information_status = ?,
        equipment_status = ?,
        comment = ?
      WHERE tag = ? AND projectId = ?;
    `;

    // Execute the update query
    const [result] = await connection.query(updateQuery, [
      area || null,
      discipline || null,
      Systm || null,
      function_code || null,
      sequence_number || null,
      tagId || null,
      line_id || null,
      line_number || null,
      pid || null,
      isometric || null,
      data_sheet || null,
      drawings || null,
      design_pressure || null,
      design_temperature || null,
      size || null,
      paint_system || null,
      purchase_order || null,
      supplier || null,
      information_status || null,
      equipment_status || null,
      comment || null,
      tag,
      projectId,
    ]);

    // Check if any rows were affected
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: "No valve found with the given tag and projectId" });
    }

    res.status(200).json({
      success: true,
      message: "Valve updated successfully",
      affectedRows: result.affectedRows,
      updatedValve: {
        tag,
        projectId,
        ...req.body,
      },
    });
  } catch (error) {
    console.error("Error updating ValveList:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  } finally {
    if (connection) {
      try {
        await connection.release();
      } catch (releaseError) {
        console.error("Error releasing connection:", releaseError);
      }
    }
  }
};
const ClearEditableValveFields = async (req, res) => {
  let connection;
  try {
    const { projectId, tag } = req.body;
    console.log(req.body);
    

    // Validate required fields
    if (!projectId || !tag) {
      return res.status(400).json({
        error: "projectId and tag are required fields",
      });
    }

    // Get DB connection
    connection = await pool.getConnection();

    // Build update query to clear only editable fields
    const clearQuery = `
      UPDATE valveList 
      SET 
        area = NULL,
        discipline = NULL,
        Systm = NULL,
        function_code = NULL,
        sequence_number = NULL,
        line_id = NULL,
        line_number = NULL,
        pid = NULL,
        isometric = NULL,
        data_sheet = NULL,
        drawings = NULL,
        design_pressure = NULL,
        design_temperature = NULL,
        size = NULL,
        paint_system = NULL,
        purchase_order = NULL,
        supplier = NULL,
        information_status = NULL,
        equipment_status = NULL,
        comment = NULL
      WHERE tagId = ? AND projectId = ?;
    `;

    const [result] = await connection.query(clearQuery, [tag, projectId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: "No valve found with the given tag and projectId",
      });
    }

    res.status(200).json({
      success: true,
      message: "Editable fields cleared successfully",
      affectedRows: result.affectedRows,
      clearedTag: tag,
      projectId,
    });
  } catch (error) {
    console.error("Error clearing editable fields:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  } finally {
    if (connection) {
      try {
        await connection.release();
      } catch (releaseError) {
        console.error("Error releasing connection:", releaseError);
      }
    }
  }
};
const ClearEditableLineFields = async (req, res) => {
  let connection;
  try {
    const { projectId, tagId } = req.body;
    console.log(req.body);
    
    // Validate required fields
    if (!projectId || !tagId) {
      return res.status(400).json({
        error: "projectId and tag are required fields",
      });
    }

    // Get DB connection
    connection = await pool.getConnection();

    // Build update query to clear only editable fields
    const clearQuery = `
      UPDATE LineList 
      SET 
        fluidCode = NULL,
        lineId = NULL,
        medium = NULL,
        lineSizeIn = NULL,
        lineSizeNb = NULL,
        pipingSpec = NULL,
        insType = NULL,
        insThickness = NULL,
        heatTrace = NULL,
        lineFrom = NULL,
        lineTo = NULL,
        pnid = NULL,
        pipingIso = NULL,
        pipingStressIso = NULL,
        maxOpPress = NULL,
        maxOpTemp = NULL,
        dsgnPress = NULL,
        minDsgnTemp = NULL,
        maxDsgnTemp = NULL,
        testPress = NULL,
        testMedium = NULL,
        testMediumPhase = NULL,
        massFlow = NULL,
        volFlow = NULL,
        density = NULL,
        velocity = NULL,
        paintSystem = NULL,
        ndtGroup = NULL,
        chemCleaning = NULL,
        pwht = NULL
      WHERE tagId = ? AND projectId = ?;
    `;

    const [result] = await connection.query(clearQuery, [tagId, projectId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: "No line found with the given tag and projectId",
      });
    }

    res.status(200).json({
      success: true,
      message: "Editable fields cleared successfully",
      affectedRows: result.affectedRows,
      clearedTag: tagId,
      projectId,
    });
  } catch (error) {
    console.error("Error clearing editable fields:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  } finally {
    if (connection) {
      try {
        await connection.release();
      } catch (releaseError) {
        console.error("Error releasing connection:", releaseError);
      }
    }
  }
};
const ClearEditableEquipmentFields = async (req, res) => {
  let connection;
  try {
    const { projectId, tagId } = req.body;
    console.log(req.body);
    
    // Validate required fields
    if (!projectId || !tagId) {
      return res.status(400).json({
        error: "projectId and tag are required fields",
      });
    }

    // Get DB connection
    connection = await pool.getConnection();

    // Build update query to clear only editable fields
    const clearQuery = `
      UPDATE EquipmentList 
      SET 
        descr = NULL,
        qty = NULL,
        capacity = NULL,
        type = NULL,
        materials = NULL,
        capacityDuty = NULL,
        dims = NULL,
        dsgnPress = NULL,
        opPress = NULL,
        dsgnTemp = NULL,
        opTemp = NULL,
        dryWeight = NULL,
        opWeight = NULL,
        pnid = NULL,
        supplier = NULL,
        remarks = NULL,
        initStatus = NULL,
        revision = NULL,
        revisionDate = NULL
      WHERE tagId = ? AND projectId = ?;
    `;

    const [result] = await connection.query(clearQuery, [tagId, projectId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: "No equipment found with the given tag and projectId",
      });
    }

    res.status(200).json({
      success: true,
      message: "Editable fields cleared successfully",
      affectedRows: result.affectedRows,
      clearedTag: tagId,
      projectId,
    });
  } catch (error) {
    console.error("Error clearing editable fields:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  } finally {
    if (connection) {
      try {
        await connection.release();
      } catch (releaseError) {
        console.error("Error releasing connection:", releaseError);
      }
    }
  }
};
// General TagInfo
// get all general taginfo using tagId
const GetGeneralTagInfoUsingTagId = async (req, res) => {
  const { id, tagId } = req.params;
  let connection;

  try {
    connection = await pool.getConnection();

    const [result] = await connection.query(
      "SELECT * FROM TagInfo WHERE projectId = ? AND tagId = ?",
      [tagId, id]
    );
    if (result.length > 0) {
      console.log(result[0]);
      res.status(200).json(result[0]);
    } else {
      res
        .status(404)
        .json({
          message: "TagInfo not found for the given projectId and tagid",
        });
    }
  } catch (error) {
    console.error("Error fetching TagInfo:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};
// get all general taginfo fields
const GetGeneralTagInfoField = async (req, res) => {
  const { id } = req.params;
  console.log(id);
  
  let connection;

  try {
    connection = await pool.getConnection();

    const [result] = await connection.query(
      "SELECT * FROM UserTagInfoFieldUnits WHERE projectId = ?",
      [id]
    );
    if (result.length > 0) {
      res.status(200).json(result);
    } else {
      res
        .status(404)
        .json({
          message:
            "UserTagInfoFieldUnits not found for the given projectId and tagid",
        });
    }
  } catch (error) {
    console.error("Error fetching UserTagInfoFieldUnits:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};
// get all general taginfo
const GetAllGeneralTagInfo = async (req, res) => {
  const { id } = req.params;
  let connection;

  try {
    connection = await pool.getConnection();

    const [result] = await connection.query(
      "SELECT * FROM TagInfo WHERE projectId = ?",
      [id]
    );
    if (result.length > 0) {
      res.status(200).json(result);
    }
  } catch (error) {
    console.error("Error fetching TagInfo:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};
// update general taginfo fields
const UpdateGEneralTagInfField = async (req, res) => {
  const { id, projectId, field, unit, statuscheck } = req.body;
  let connection;
  console.log(req.body);
  // Validate input
  if (!id || !projectId || !field) {
    return res.status(400).json({
      success: false,
      message: "Field ID, Project ID, and field name are required",
    });
  }

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Fetch the existing record before update
    const [existingField] = await connection.query(
      `SELECT * FROM UserTagInfoFieldUnits WHERE id = ? AND projectId = ?`,
      [id, projectId]
    );
    console.log(existingField);

    if (existingField.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Field not found",
      });
    }

    // Perform the update
    await connection.query(
      `UPDATE UserTagInfoFieldUnits 
       SET field = ?, unit = ?, statuscheck = ?
       WHERE id = ? AND projectId = ?`,
      [field, unit, statuscheck, id, projectId]
    );

    await connection.commit();

    const [updatedField] = await connection.query(
      `SELECT * FROM UserTagInfoFieldUnits WHERE id = ? AND projectId = ?`,
      [id, projectId]
    );

    return res.status(200).json({
      success: true,
      message: "Field updated successfully",
      data: updatedField[0],
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error updating generalTaginfo field:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update field",
      details: error.message,
    });
  } finally {
    if (connection) {
      try {
        await connection.release();
      } catch (releaseError) {
        console.error("Error releasing connection:", releaseError);
      }
    }
  }
};
// Update general tagInfo  edit-general-taginfo-list
const EditGeneralTagInfo = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const {
      projectId,
      tagId,
      tag,
      type,
      // TagInfo fields 1 to 50
      taginfo1,
      taginfo2,
      taginfo3,
      taginfo4,
      taginfo5,
      taginfo6,
      taginfo7,
      taginfo8,
      taginfo9,
      taginfo10,
      taginfo11,
      taginfo12,
      taginfo13,
      taginfo14,
      taginfo15,
      taginfo16,
      taginfo17,
      taginfo18,
      taginfo19,
      taginfo20,
      taginfo21,
      taginfo22,
      taginfo23,
      taginfo24,
      taginfo25,
      taginfo26,
      taginfo27,
      taginfo28,
      taginfo29,
      taginfo30,
      taginfo31,
      taginfo32,
      taginfo33,
      taginfo34,
      taginfo35,
      taginfo36,
      taginfo37,
      taginfo38,
      taginfo39,
      taginfo40,
      taginfo41,
      taginfo42,
      taginfo43,
      taginfo44,
      taginfo45,
      taginfo46,
      taginfo47,
      taginfo48,
      taginfo49,
      taginfo50,
    } = req.body;

    // Basic validation
    if (!projectId || !tagId) {
      return res
        .status(400)
        .json({ error: "projectId and tagId are required" });
    }

    connection = await pool.getConnection();

    const updateQuery = `
      UPDATE TagInfo SET 
        tag = ?, type = ?,
        taginfo1 = ?, taginfo2 = ?, taginfo3 = ?, taginfo4 = ?, taginfo5 = ?,
        taginfo6 = ?, taginfo7 = ?, taginfo8 = ?, taginfo9 = ?, taginfo10 = ?,
        taginfo11 = ?, taginfo12 = ?, taginfo13 = ?, taginfo14 = ?, taginfo15 = ?,
        taginfo16 = ?, taginfo17 = ?, taginfo18 = ?, taginfo19 = ?, taginfo20 = ?,
        taginfo21 = ?, taginfo22 = ?, taginfo23 = ?, taginfo24 = ?, taginfo25 = ?,
        taginfo26 = ?, taginfo27 = ?, taginfo28 = ?, taginfo29 = ?, taginfo30 = ?,
        taginfo31 = ?, taginfo32 = ?, taginfo33 = ?, taginfo34 = ?, taginfo35 = ?,
        taginfo36 = ?, taginfo37 = ?, taginfo38 = ?, taginfo39 = ?, taginfo40 = ?,
        taginfo41 = ?, taginfo42 = ?, taginfo43 = ?, taginfo44 = ?, taginfo45 = ?,
        taginfo46 = ?, taginfo47 = ?, taginfo48 = ?, taginfo49 = ?, taginfo50 = ?
      WHERE tagId = ? AND projectId = ?
    `;

    const values = [
      tag || null,
      type || null,
      taginfo1 || null,
      taginfo2 || null,
      taginfo3 || null,
      taginfo4 || null,
      taginfo5 || null,
      taginfo6 || null,
      taginfo7 || null,
      taginfo8 || null,
      taginfo9 || null,
      taginfo10 || null,
      taginfo11 || null,
      taginfo12 || null,
      taginfo13 || null,
      taginfo14 || null,
      taginfo15 || null,
      taginfo16 || null,
      taginfo17 || null,
      taginfo18 || null,
      taginfo19 || null,
      taginfo20 || null,
      taginfo21 || null,
      taginfo22 || null,
      taginfo23 || null,
      taginfo24 || null,
      taginfo25 || null,
      taginfo26 || null,
      taginfo27 || null,
      taginfo28 || null,
      taginfo29 || null,
      taginfo30 || null,
      taginfo31 || null,
      taginfo32 || null,
      taginfo33 || null,
      taginfo34 || null,
      taginfo35 || null,
      taginfo36 || null,
      taginfo37 || null,
      taginfo38 || null,
      taginfo39 || null,
      taginfo40 || null,
      taginfo41 || null,
      taginfo42 || null,
      taginfo43 || null,
      taginfo44 || null,
      taginfo45 || null,
      taginfo46 || null,
      taginfo47 || null,
      taginfo48 || null,
      taginfo49 || null,
      taginfo50 || null,
      tagId,
      projectId,
    ];

    const [result] = await connection.query(updateQuery, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: "No record found with the given tagId and projectId",
      });
    }

    res.status(200).json({
      success: true,
      message: "TagInfo updated successfully",
      affectedRows: result.affectedRows,
    });
  } catch (error) {
    console.error("Error updating TagInfo:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

// delete generaltaginfo
const ClearTagInfoFields = async (req, res) => {
  const { tagId, projectId } = req.body;
  let connection;
  console.log(req.body);
  if (!tagId || !projectId) {
    return res.status(400).json({ error: "tagId and projectId are required" });
  }

  try {
    connection = await pool.getConnection();

    // Prepare the SET clause with taginfo1 to taginfo50 = NULL
    const fieldsToClear = Array.from(
      { length: 50 },
      (_, i) => `taginfo${i + 1} = NULL`
    ).join(", ");

    const query = `
      UPDATE TagInfo
      SET ${fieldsToClear}
      WHERE tagId = ? AND projectId = ?
    `;

    const [result] = await connection.query(query, [tagId, projectId]);
    console.log(result);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "No matching record found" });
    }

    res.status(200).json({
      success: true,
      message: "TagInfo fields cleared successfully",
      affectedRows: result,
    });
  } catch (error) {
    console.error("Error clearing TagInfo fields:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

// Backend function to handle import with upsert logic
const saveimportedLineList = async (req, res) => {
  let connection;
  try {
    const importData = req.body; // Array of line objects
    
    if (!Array.isArray(importData) || importData.length === 0) {
      return res.status(400).json({ error: "Import data must be a non-empty array" });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const results = {
      updated: 0,
      created: 0,
      errors: []
    };

    for (const lineData of importData) {
      try {
        const { tag, projectId } = lineData;
        
        if (!tag || !projectId) {
          results.errors.push(`Missing tag or projectId for record: ${JSON.stringify(lineData)}`);
          continue;
        }

        // Check if tag exists in LineList for this project
        const [existingLine] = await connection.query(
          `SELECT tagId FROM LineList WHERE tag = ? AND projectId = ?`,
          [tag, projectId]
        );

        if (existingLine.length > 0) {
          // UPDATE existing record
          await updateExistingLine(connection, lineData, existingLine[0].tagId);
          results.updated++;
        } else {
          // CREATE new tag and line record
          await createNewLineTag(connection, lineData);
          results.created++;
        }
      } catch (itemError) {
        results.errors.push(`Error processing ${lineData.tag}: ${itemError.message}`);
      }
    }

    await connection.commit();
    
    res.status(200).json({
      success: true,
      message: "Import completed",
      results
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error importing LineList:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message
    });
  } finally {
    if (connection) connection.release();
  }
};

// Helper function to update existing line
const updateExistingLine = async (connection, lineData, tagId) => {
  const updateQuery = `
    UPDATE LineList SET 
      fluidCode = ?,
      lineId = ?,
      medium = ?,
      lineSizeIn = ?,
      lineSizeNb = ?,
      pipingSpec = ?,
      insType = ?,
      insThickness = ?,
      heatTrace = ?,
      lineFrom = ?,
      lineTo = ?,
      maxOpPress = ?,
      maxOpTemp = ?,
      dsgnPress = ?,
      minDsgnTemp = ?,
      maxDsgnTemp = ?,
      testPress = ?,
      testMedium = ?,
      testMediumPhase = ?,
      massFlow = ?,
      volFlow = ?,
      density = ?,
      velocity = ?,
      paintSystem = ?,
      ndtGroup = ?,
      chemCleaning = ?,
      pwht = ?
    WHERE tagId = ? AND projectId = ?
  `;

  await connection.query(updateQuery, [
    lineData.fluidCode || null,
    lineData.lineId || null,
    lineData.medium || null,
    lineData.lineSizeIn || null,
    lineData.lineSizeNb || null,
    lineData.pipingSpec || null,
    lineData.insType || null,
    lineData.insThickness || null,
    lineData.heatTrace || null,
    lineData.lineFrom || null,
    lineData.lineTo || null,
    lineData.maxOpPress || null,
    lineData.maxOpTemp || null,
    lineData.dsgnPress || null,
    lineData.minDsgnTemp || null,
    lineData.maxDsgnTemp || null,
    lineData.testPress || null,
    lineData.testMedium || null,
    lineData.testMediumPhase || null,
    lineData.massFlow || null,
    lineData.volFlow || null,
    lineData.density || null,
    lineData.velocity || null,
    lineData.paintSystem || null,
    lineData.ndtGroup || null,
    lineData.chemCleaning || null,
    lineData.pwht || null,
    tagId,
    lineData.projectId
  ]);
};

// Helper function to create new tag and line
const createNewLineTag = async (connection, lineData) => {
  const tagId = generateCustomID("TAG-");
  
  // Insert into Tags table
  await connection.query(
    `INSERT INTO Tags (tagId, number, name, parenttag, type, filename, projectId)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tagId, lineData.tag, lineData.tag, null, 'line', null, lineData.projectId]
  );

  // Insert into TagInfo table
  await connection.query(
    `INSERT INTO TagInfo (projectId, tagId, tag, type)
     VALUES (?, ?, ?, ?)`,
    [lineData.projectId, tagId, lineData.tag, 'line']
  );

  // Insert into LineList table with all data
  await connection.query(
    `INSERT INTO LineList (
      projectId, tagId, tag, fluidCode, lineId, medium, lineSizeIn, lineSizeNb,
      pipingSpec, insType, insThickness, heatTrace, lineFrom, lineTo,
      maxOpPress, maxOpTemp, dsgnPress, minDsgnTemp, maxDsgnTemp,
      testPress, testMedium, testMediumPhase, massFlow, volFlow,
      density, velocity, paintSystem, ndtGroup, chemCleaning, pwht
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      lineData.projectId,
      tagId,
      lineData.tag,
      lineData.fluidCode || null,
      lineData.lineId || null,
      lineData.medium || null,
      lineData.lineSizeIn || null,
      lineData.lineSizeNb || null,
      lineData.pipingSpec || null,
      lineData.insType || null,
      lineData.insThickness || null,
      lineData.heatTrace || null,
      lineData.lineFrom || null,
      lineData.lineTo || null,
      lineData.maxOpPress || null,
      lineData.maxOpTemp || null,
      lineData.dsgnPress || null,
      lineData.minDsgnTemp || null,
      lineData.maxDsgnTemp || null,
      lineData.testPress || null,
      lineData.testMedium || null,
      lineData.testMediumPhase || null,
      lineData.massFlow || null,
      lineData.volFlow || null,
      lineData.density || null,
      lineData.velocity || null,
      lineData.paintSystem || null,
      lineData.ndtGroup || null,
      lineData.chemCleaning || null,
      lineData.pwht || null
    ]
  );
};
const saveimportedEquipmentList = async (req, res) => {
  let connection;
  try {
    const importData = req.body; // Array of equipment objects
    
    if (!Array.isArray(importData) || importData.length === 0) {
      return res.status(400).json({ error: "Import data must be a non-empty array" });
    }

    // Get projectId from the first item or from request params
    const projectId = importData[0]?.projectId || req.params.projectId;
    if (!projectId) {
      return res.status(400).json({ error: "Project ID is required" });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const results = {
      updated: 0,
      created: 0,
      errors: []
    };

    for (const equipmentData of importData) {
      try {
        
       const { tag, projectId } = equipmentData;
        
        if (!tag || !projectId) {
          results.errors.push(`Missing tag or projectId for record: ${JSON.stringify(lineData)}`);
          continue;
        }


        // Check if equipment tag exists in EquipmentList for this project
        const [existingEquipment] = await connection.query(
          `SELECT tagId FROM EquipmentList WHERE tag = ? AND projectId = ?`,
          [tag, projectId]
        );

        if (existingEquipment.length > 0) {
          // UPDATE existing record
          await updateExistingEquipment(connection, equipmentData, existingEquipment[0].tagId, projectId);
          results.updated++;
        } else {
          console.log("enter")
          // CREATE new tag and equipment record
         const Dataresult= await createNewEquipmentTag(connection, equipmentData, projectId);
         console.log(Dataresult)
          results.created++;
        }
      } catch (itemError) {
        results.errors.push(`Error processing ${equipmentData.tag}: ${itemError.message}`);
      }
    }

    await connection.commit();
    
    res.status(200).json({
      success: true,
      message: "Equipment import completed",
      results
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error importing EquipmentList:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message
    });
  } finally {
    if (connection) connection.release();
  }
};

// Helper function to update existing equipment
const updateExistingEquipment = async (connection, equipmentData, tagId, projectId) => {
  const updateQuery = `
    UPDATE EquipmentList SET 
      descr = ?,
      qty = ?,
      capacity = ?,
      type = ?,
      materials = ?,
      capacityDuty = ?,
      dims = ?,
      dsgnPress = ?,
      opPress = ?,
      dsgnTemp = ?,
      opTemp = ?,
      dryWeight = ?,
      opWeight = ?,
      supplier = ?,
      remarks = ?,
      initStatus = ?,
      revision = ?,
      revisionDate = ?
    WHERE tagId = ? AND projectId = ?
  `;

  await connection.query(updateQuery, [
    equipmentData.descr || null,
    equipmentData.qty || null,
    equipmentData.capacity || null,
    equipmentData.type || null,
    equipmentData.materials || null,
    equipmentData.capacityDuty || null,
    equipmentData.dims || null,
    equipmentData.dsgnPress || null,
    equipmentData.opPress || null,
    equipmentData.dsgnTemp || null,
    equipmentData.opTemp || null,
    equipmentData.dryWeight || null,
    equipmentData.opWeight || null,
    equipmentData.supplier || null,
    equipmentData.remarks || null,
    equipmentData.initStatus || null,
    equipmentData.revision || null,
    equipmentData.revisionDate || null,
    tagId,
    projectId
  ]);
};

// Helper function to create new equipment tag
const createNewEquipmentTag = async (connection, equipmentData, projectId) => {
  const tagId = generateCustomID("TAG-");
  
  // Insert into Tags table
  await connection.query(
    `INSERT INTO Tags (tagId, number, name, parenttag, type, filename, projectId)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tagId, equipmentData.tag, equipmentData.tag, null, 'equipment', null, projectId]
  );

  // Insert into TagInfo table
  await connection.query(
    `INSERT INTO TagInfo (projectId, tagId, tag, type)
     VALUES (?, ?, ?, ?)`,
    [projectId, tagId, equipmentData.tag, 'equipment']
  );

  // Insert into EquipmentList table with all data
  await connection.query(
    `INSERT INTO EquipmentList (
      projectId, tagId, tag, descr, qty, capacity, type, materials, capacityDuty,
      dims, dsgnPress, opPress, dsgnTemp, opTemp, dryWeight, opWeight,
      supplier, remarks, initStatus, revision, revisionDate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      tagId,
      equipmentData.tag,
      equipmentData.descr || null,
      equipmentData.qty || null,
      equipmentData.capacity || null,
      equipmentData.type || null,
      equipmentData.materials || null,
      equipmentData.capacityDuty || null,
      equipmentData.dims || null,
      equipmentData.dsgnPress || null,
      equipmentData.opPress || null,
      equipmentData.dsgnTemp || null,
      equipmentData.opTemp || null,
      equipmentData.dryWeight || null,
      equipmentData.opWeight || null,
      equipmentData.supplier || null,
      equipmentData.remarks || null,
      equipmentData.initStatus || null,
      equipmentData.revision || null,
      equipmentData.revisionDate || null
    ]
  );
};

const saveimportedValveList = async (req, res) => {
  let connection;
  try {
    const importData = req.body; // Array of valve objects
    console.log("📥 Valve import data received:", importData.length, "items");
    
    if (!Array.isArray(importData) || importData.length === 0) {
      return res.status(400).json({ error: "Import data must be a non-empty array" });
    }

    // Get projectId from the first item or from request params
    const projectId = importData[0]?.projectId || req.params.projectId;
    console.log("🔍 Project ID:", projectId);
    
    if (!projectId) {
      return res.status(400).json({ error: "Project ID is required" });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const results = {
      updated: 0,
      created: 0,
      errors: []
    };

    for (const valveData of importData) {
      try {
        const { tag ,projectId} = valveData;
        console.log(`🏷️ Processing valve tag: ${tag}`);
        
        if (!tag || !projectId ) {
          const errorMsg = `Missing or empty tag for record: ${JSON.stringify(valveData)}`;
          console.log("❌", errorMsg);
          results.errors.push(errorMsg);
          continue;
        }

        // Check if valve tag exists in ValveList for this project
        const [existingValve] = await connection.query(
          `SELECT tagId FROM valveList WHERE tag = ? AND projectId = ?`,
          [tag, projectId]
        );

        if (existingValve.length > 0) {
          // UPDATE existing record
          await updateExistingValve(connection, valveData, existingValve[0].tagId, projectId);
          results.updated++;
        } else {
          // CREATE new tag and valve record
          await createNewValveTag(connection, valveData, projectId);
          results.created++;
        }
      } catch (itemError) {
        const errorMsg = `Error processing ${valveData.tag}: ${itemError.message}`;
        console.error("❌", errorMsg);
        console.error("Full error:", itemError);
        results.errors.push(errorMsg);
      }
    }

    await connection.commit();
    console.log("📊 Final valve import results:", results);
    
    res.status(200).json({
      success: true,
      message: "Valve import completed",
      results
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("❌ Error importing ValveList:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message
    });
  } finally {
    if (connection) connection.release();
  }
};

// Helper function to update existing valve
const updateExistingValve = async (connection, valveData, tagId, projectId) => {
  console.log(`🔧 Updating existing valve: ${valveData.tag} (tagId: ${tagId})`);
  
  const updateQuery = `
    UPDATE valveList SET 
      area = ?,
      discipline = ?,
      Systm = ?,
      function_code = ?,
      sequence_number = ?,
      line_id = ?,
      line_number = ?,
      pid = ?,
      isometric = ?,
      data_sheet = ?,
      drawings = ?,
      design_pressure = ?,
      design_temperature = ?,
      size = ?,
      paint_system = ?,
      purchase_order = ?,
      supplier = ?,
      information_status = ?,
      equipment_status = ?,
      comment = ?
    WHERE tagId = ? AND projectId = ?
  `;

  try {
    const [result] = await connection.query(updateQuery, [
      valveData.area || null,
      valveData.discipline || null,
      valveData.system || valveData.Systm || null, // Handle both field names
      valveData.function_code || null,
      valveData.sequence_number || null,
      valveData.line_id || null,
      valveData.line_number || null,
      valveData.pid || null,
      valveData.isometric || null,
      valveData.data_sheet || null,
      valveData.drawings || null,
      valveData.design_pressure || null,
      valveData.design_temperature || null,
      valveData.size || null,
      valveData.paint_system || null,
      valveData.purchase_order || null,
      valveData.supplier || null,
      valveData.information_status || null,
      valveData.equipment_status || null,
      valveData.comment || null,
      tagId,
      projectId
    ]);
    
    console.log(`✅ Valve update successful, affected rows: ${result.affectedRows}`);
    
    if (result.affectedRows === 0) {
      throw new Error(`No rows updated for valve ${valveData.tag}`);
    }
    
  } catch (updateError) {
    console.error("❌ Error during valve update:", updateError);
    throw updateError;
  }
};

// Helper function to create new valve tag
const createNewValveTag = async (connection, valveData, projectId) => {
  console.log("🔧 Creating new valve tag for:", valveData.tag);
  
  const tagId = generateCustomID("TAG-");
  console.log("🆔 Generated tagId:", tagId);
  
  try {
    // Insert into Tags table
    console.log("📝 Inserting into Tags table...");
    await connection.query(
      `INSERT INTO Tags (tagId, number, name, parenttag, type, filename, projectId)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tagId, valveData.tag, valveData.tag, null, 'valve', null, projectId]
    );
    console.log("✅ Tags table insert successful");

    // Insert into TagInfo table
    console.log("📝 Inserting into TagInfo table...");
    await connection.query(
      `INSERT INTO TagInfo (projectId, tagId, tag, type)
       VALUES (?, ?, ?, ?)`,
      [projectId, tagId, valveData.tag, 'valve']
    );
    console.log("✅ TagInfo table insert successful");

    // Insert into valveList table with all data
    console.log("📝 Inserting into valveList table...");
    await connection.query(
      `INSERT INTO valveList (
        projectId, tagId, tag, area, discipline, Systm, function_code, sequence_number,
        line_id, line_number, pid, isometric, data_sheet, drawings,
        design_pressure, design_temperature, size, paint_system, purchase_order,
        supplier, information_status, equipment_status, comment
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        tagId,
        valveData.tag,
        valveData.area || null,
        valveData.discipline || null,
        valveData.system || valveData.Systm || null, // Handle both field names
        valveData.function_code || null,
        valveData.sequence_number || null,
        valveData.line_id || null,
        valveData.line_number || null,
        valveData.pid || null,
        valveData.isometric || null,
        valveData.data_sheet || null,
        valveData.drawings || null,
        valveData.design_pressure || null,
        valveData.design_temperature || null,
        valveData.size || null,
        valveData.paint_system || null,
        valveData.purchase_order || null,
        valveData.supplier || null,
        valveData.information_status || null,
        valveData.equipment_status || null,
        valveData.comment || null
      ]
    );
    console.log("✅ ValveList table insert successful");
    
  } catch (insertError) {
    console.error("❌ Error during valve creation:", insertError);
    throw insertError;
  }
};

const GetAllModelsGot=async(req,res)=>{
  let connection;
  try {
    const { projectId } = req.params;
    const { areas, discs, systems, tags } = req.query;

    // Validate projectId
    if (!projectId) {
      return res.status(400).json({
        status: 400,
        message: 'Project ID is required'
      });
    }

    connection = await pool.getConnection();

    // Build dynamic WHERE clause based on filters
    let whereConditions = ['t.projectId = ?'];
    let queryParams = [projectId];

    // Add area filter
    if (areas) {
      const areaList = areas.split(',').map(area => area.trim());
      const areaPlaceholders = areaList.map(() => '?').join(',');
      whereConditions.push(`tr.area IN (${areaPlaceholders})`);
      queryParams.push(...areaList);
    }

    // Add disc filter
    if (discs) {
      const discList = discs.split(',').map(disc => disc.trim());
      const discPlaceholders = discList.map(() => '?').join(',');
      whereConditions.push(`tr.disc IN (${discPlaceholders})`);
      queryParams.push(...discList);
    }

    // Add system filter
    if (systems) {
      const systemList = systems.split(',').map(sys => sys.trim());
      const systemPlaceholders = systemList.map(() => '?').join(',');
      whereConditions.push(`tr.sys IN (${systemPlaceholders})`);
      queryParams.push(...systemList);
    }

    // Add tag filter
    if (tags) {
      const tagList = tags.split(',').map(tag => tag.trim());
      const tagPlaceholders = tagList.map(() => '?').join(',');
      whereConditions.push(`tr.tag IN (${tagPlaceholders})`);
      queryParams.push(...tagList);
    }

    // Construct the main query based on actual schema
    const query = `
      SELECT 
        t.tagId,
        t.number as tag,
        t.name as tagName,
        t.type,
        t.filename,
        t.projectId,
        tr.area,
        tr.disc,
        tr.sys,
        tr.name as treeName,
        -- Line list information
        ll.fluidCode,
        ll.medium,
        ll.lineSizeIn,
        ll.lineSizeNb,
        ll.pipingSpec,
        ll.insType,
        ll.insThickness,
        ll.heatTrace,
        ll.lineFrom,
        ll.lineTo,
        ll.pnid as linePnid,
        ll.maxOpPress,
        ll.maxOpTemp,
        ll.dsgnPress,
        ll.minDsgnTemp,
        ll.maxDsgnTemp,
        ll.testPress,
        ll.testMedium,
        ll.testMediumPhase,
        ll.massFlow,
        ll.volFlow,
        ll.density,
        ll.velocity,
        ll.paintSystem,
        ll.ndtGroup,
        ll.chemCleaning,
        ll.pwht,
        -- Equipment list information
        el.descr as equipmentDescription,
        el.qty as equipmentQuantity,
        el.capacity as equipmentCapacity,
        el.type as equipmentType,
        el.materials as equipmentMaterials,
        el.capacityDuty,
        el.dims as equipmentDimensions,
        el.dsgnPress as equipmentDsgnPress,
        el.opPress as equipmentOpPress,
        el.dsgnTemp as equipmentDsgnTemp,
        el.opTemp as equipmentOpTemp,
        el.dryWeight,
        el.opWeight,
        el.pnid as equipmentPnid,
        el.supplier,
        el.remarks,
        el.initStatus,
        el.revision,
        el.revisionDate,
        -- Tag info (first 16 fields commonly used)
        ti.taginfo1,
        ti.taginfo2,
        ti.taginfo3,
        ti.taginfo4,
        ti.taginfo5,
        ti.taginfo6,
        ti.taginfo7,
        ti.taginfo8,
        ti.taginfo9,
        ti.taginfo10,
        ti.taginfo11,
        ti.taginfo12,
        ti.taginfo13,
        ti.taginfo14,
        ti.taginfo15,
        ti.taginfo16
      FROM Tags t
      INNER JOIN Tree tr ON t.number = tr.tag AND t.projectId = tr.project_id
      LEFT JOIN LineList ll ON t.tagId = ll.tagId
      LEFT JOIN EquipmentList el ON t.tagId = el.tagId
      LEFT JOIN TagInfo ti ON t.tagId = ti.tagId
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY tr.area, tr.disc, tr.sys, tr.tag
    `;

    // Execute the query
    const [results] = await connection.execute(query, queryParams);

    // Transform the results to match expected frontend format
    const formattedResults = results.map(row => ({
      tagId: row.tagId,
      tag: row.tag,
      area: row.area,
      disc: row.disc,
      sys: row.sys,
      filename: row.filename,
      projectId: row.projectId,
      name: row.tagName,
      type: row.type,
      
      // File information (simulated based on filename)
      file: row.filename ? {
        filename: row.filename,
        originalName: row.filename,
        // You might want to add actual file table or compute these
        size: null,
        mimeType: row.filename.endsWith('.glb') ? 'model/gltf-binary' : null,
        uploadPath: `/uploads/tags/${row.projectId}/`,
        created: null,
        modified: null,
        accessed: null
      } : null,

   
    }));

    res.status(200).json({
      status: 200,
      message: 'Models retrieved successfully',
      data: formattedResults,
      count: formattedResults.length,
      filters: {
        projectId,
        areas: areas ? areas.split(',') : null,
        discs: discs ? discs.split(',') : null,
        systems: systems ? systems.split(',') : null,
        tags: tags ? tags.split(',') : null
      }
    });

  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({
      status: 500,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  } finally {
    if (connection) connection.release();
  }
}


module.exports = {
  AddTag,
  getTags,
  deleteTag,
  updateTag,
  AssignTag,
  getAssignedTags,
  getDocumentsByTag,
  GetLineList,
  GetequipmentList,
  GetValveList,
  EditLineList,
  EditEquipmentList,
  EditValveList,
  getTagByProjectAndFilename,
  GetLineListUsingTagId,
  GetEquipmentListUsingTagId,
  GetValveListUsingTagId,
  GetGeneralTagInfoUsingTagId,
  GetGeneralTagInfoField,
  GetAllGeneralTagInfo,
  UpdateGEneralTagInfField,
  EditGeneralTagInfo,
  ClearTagInfoFields,
  SaveUpdatedTagFile,
  ClearEditableValveFields,
  ClearEditableLineFields,
  ClearEditableEquipmentFields,
  saveimportedLineList,
  saveimportedEquipmentList,
  saveimportedValveList,
  GetAllModelsGot
};

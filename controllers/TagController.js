const { pool } = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const fs = require("fs").promises;
const path = require("path");

const generateCustomID = (prefix) => {
  const uuid = uuidv4();
  const uniqueID = prefix + uuid.replace(/-/g, "").slice(0, 6);
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


const AddTag = async (req, res) => {
  let connection;
  const { tagNumber, parentTag, name, type, model, project_id } = req.body;

  try {
    // Validate required fields
    if (!tagNumber || !name || !type) {
      return res
        .status(400)
        .json({ error: "tagNumber, name, and type are required" });
    }

    const tagId = generateCustomID("TAG-");
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 🟨 If model is provided, try to move it to /tags if not already there
    if (model) {
      const sourcePath = path.join(__dirname, "..", "models", model);
      const destPath = path.join(__dirname, "..", "tags", model);

      try {
        // Check if target already exists
        await fs.access(destPath);
        console.log(`File already exists in /tags: ${model}`);
      } catch (err) {
        if (err.code === 'ENOENT') {
          // File doesn't exist, move it
          await fs.rename(sourcePath, destPath);
          console.log(`Moved model file to /tags: ${model}`);
        } else {
          throw err; // Re-throw unexpected FS errors
        }
      }
    }

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
    const [Tags] = await connection.query(
      "SELECT * from Tags WHERE projectId = ?",
      [projectId]
    );
    res.status(200).json(Tags);
  } catch (error) {
    res.status(500).json("Internal server error");
  } finally {
    connection.release();
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
  const { id } = req.params;
  const tagId = id;
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
      "SELECT * FROM Tags WHERE tagId = ?",
      [tagId]
    );

    if (existingTag.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Tag not found",
      });
    }

    // Update the Tags table
    await connection.query(
      `UPDATE Tags 
       SET number = ?, name = ?, type = ?, parentTag = ?, filename = ?
       WHERE tagId = ?`,
      [number, name, type, parentTag, filename || null, tagId]
    );

    // Update the Tree table - both tag (number) and name
    await connection.query(
      `UPDATE Tree 
       SET tag = ?, name = ?
       WHERE tag = ?`,
      [number, name, existingTag[0].number] // Update rows that had the old number
    );

    await connection.commit(); // Commit the transaction

    const [updatedTag] = await connection.query(
      "SELECT * FROM Tags WHERE tagId = ?",
      [tagId]
    );

    res.status(200).json({
      success: true,
      message: "Tag updated successfully",
      data: updatedTag[0],
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating tag:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update tag",
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
  ClearEditableEquipmentFields
};

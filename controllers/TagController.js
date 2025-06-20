const { pool } = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const fs = require('fs').promises;
const path = require('path');

const generateCustomID = (prefix) => {
  const uuid = uuidv4();
  const uniqueID = prefix + uuid.replace(/-/g, "").slice(0, 6);
  return uniqueID;
};

const AddTag = async (req, res) => {
  let connection;
  console.log(req.body);

  try {
    const { tagNumber, parentTag, name, type, model, project_id } = req.body;

    // Validate required fields
    if (!tagNumber || !name || !type) {
      return res
        .status(400)
        .json({ error: "tagNumber, name, and type are required" });
    }

    // Generate unique tagId
    const tagId = generateCustomID("TAG-");

    connection = await pool.getConnection();

    // Start transaction
    await connection.beginTransaction();

    // Insert into Tags table
    await connection.query(
      `INSERT INTO Tags (tagId, number, name, parenttag, type, filename,projectId)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        tagId,
        tagNumber,
        name,
        parentTag || null,
        type,
        model || null,
        project_id,
      ]
    );

    // Insert into TagInfo table
    await connection.query(
      `INSERT INTO TagInfo (projectId,tagId, tag, type)
       VALUES (?, ?, ?, ?)`,
      [project_id, tagId, name, type]
    );

    // Conditional inserts based on type
    if (type.toLowerCase() === "line") {
      await connection.query(
        `INSERT INTO LineList (projectId,tagId, tag)
         VALUES (?,?, ?)`,
        [project_id, tagId, name]
      );
    } else if (type.toLowerCase() === "equipment") {
      await connection.query(
        `INSERT INTO EquipmentList (projectId,tagId, tag)
         VALUES (?,?, ?)`,
        [project_id, tagId, name]
      );
    } else if (type.toLowerCase() === "valve") {
      await connection.query(
        `INSERT INTO ValveList (projectId,tagId, tag )
         VALUES (?,?,?)`,
        [project_id, tagId, name]
      );
    }

    // Commit transaction
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
  // console.log(id);

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

    await connection.query("DELETE FROM Tags WHERE tagId = ?", [tagId]);

    res.status(200).json({
      success: true,
      message: "Tag deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting tag:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete tag",
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
        const filePath = path.join(__dirname, '../unassignedModels', filename);
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
          filePath: filePath
        };
        
        console.log("File metadata retrieved:", fileMetadata);
        
      } catch (fileError) {
        console.error("Error accessing file:", fileError.message);
        fileMetadata = {
          exists: false,
          fileName: filename,
          error: fileError.message,
          filePath: path.join(__dirname, '../unassignedModels', filename)
        };
      }

      // Combine tag details with file metadata
      const response = {
        ...tagDetails,
        fileMetadata: fileMetadata
      };

      res.status(200).json(response);
    } else {
      res.status(404).json({ 
        message: "Tag not found for the given projectId and filename",
        requestedFile: filename,
        projectId: projectId
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
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
      [number, name, existingTag[0].number]  // Update rows that had the old number
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
const GetLineListUsingTagId=async(req,res)=>{
    const {id,tagId} = req.params;
  let connection;

  try {
    connection = await pool.getConnection();

    const [result] = await connection.query(
      "SELECT * FROM LineList WHERE projectId = ? AND tagId = ?",
      [id, tagId]
    );
    console.log(result)
    if (result.length > 0) {
      res.status(200).json(result[0]); 
    } else {
      res.status(404).json({ message: "line list not found for the given projectId and tagid" });
    }
  } catch (error) {
    console.error("Error fetching line list:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
}
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
const GetEquipmentListUsingTagId=async(req,res)=>{
    const {id,tagId} = req.params;
  let connection;

  try {
    connection = await pool.getConnection();

    const [result] = await connection.query(
      "SELECT * FROM EquipmentList WHERE projectId = ? AND tagId = ?",
      [id, tagId]
    );
    console.log(result)
    if (result.length > 0) {
      res.status(200).json(result[0]); 
    } else {
      res.status(404).json({ message: "EquipmentList  not found for the given projectId and tagid" });
    }
  } catch (error) {
    console.error("Error fetching EquipmentList:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
}
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
const GetValveListUsingTagId=async(req,res)=>{
    const {id,tagId} = req.params;
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
      res.status(404).json({ message: "valveList not found for the given projectId and tagid" });
    }
  } catch (error) {
    console.error("Error fetching valveList:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
}
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

// General TagInfo
const GetGeneralTagInfUsingTagId=async(req,res)=>{
    const {id,tagId} = req.params;
  let connection;

  try {
    connection = await pool.getConnection();

    const [result] = await connection.query(
      "SELECT * FROM TagInfo WHERE projectId = ? AND tagId = ?",
      [tagId,id]
    );
    if (result.length > 0) {
      console.log(result[0])
      res.status(200).json(result[0]); 
    } else {
      res.status(404).json({ message: "TagInfo not found for the given projectId and tagid" });
    }
  } catch (error) {
    console.error("Error fetching TagInfo:", error);
    res.status(500).json({ message: "Internal server error" });
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
  GetGeneralTagInfUsingTagId
};

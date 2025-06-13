const { pool } = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const generateCustomID = (prefix) => {
  const uuid = uuidv4();
  const uniqueID = prefix + uuid.replace(/-/g, "").slice(0, 6);
  return uniqueID;
};

const AddTag = async (req, res) => {
  let connection;
  console.log(req.body);
  
  try {
    const { tagNumber, parentTag, name, type, model,project_id } = req.body;

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
      [tagId, tagNumber, name, parentTag || null, type, model || null,project_id]
    );

    // Insert into TagInfo table
    await connection.query(
      `INSERT INTO TagInfo (projectId,tagId, tag, type)
       VALUES (?, ?, ?, ?)`,
      [project_id,tagId, name, type]
    );

    // Conditional inserts based on type
    if (type.toLowerCase() === "line") {
      await connection.query(
        `INSERT INTO LineList (projectId,tagId, tag)
         VALUES (?,?, ?)`,
        [project_id,tagId, name]
      );
    } else if (type.toLowerCase() === "equipment") {
      await connection.query(
        `INSERT INTO EquipmentList (projectId,tagId, tag)
         VALUES (?,?, ?)`,
        [project_id,tagId, name]
      );
    } else if (type.toLowerCase() === "valve") {
      await connection.query(
        `INSERT INTO ValveList (projectId,tagId, tag )
         VALUES (?,?,?, ?)`,
        [project_id,tagId, name]
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
    const [Tags] = await connection.query("SELECT * from Tags WHERE projectId = ?" , [projectId]);
    res.status(200).json(Tags);
  } catch (error) {
    res.status(500).json("Internal server error");
  }finally {
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
  }finally {
    if (connection) connection.release();
  }
};



const updateTag = async (req, res) => {
  const { id } = req.params;
  const tagId = id
  console.log(req.body);
  
  const { number, name, type, parentTag,filename } = req.body;
  let connection;

  try {

    if (!number || !name || !type) {
      return res.status(400).json({
        success: false,
        message: 'Number, name, and type are required fields'
      });
    }

    connection = await pool.getConnection();

 
    const [existingTag] = await connection.query(
      'SELECT * FROM Tags WHERE tagId = ?',
      [tagId]
    );

    if (existingTag.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tag not found'
      });
    }



    await connection.query(
      `UPDATE Tags 
       SET number = ?, name = ?, type = ?, parentTag = ?, filename = ?
       WHERE tagId = ?`,
      [number, name, type, parentTag, filename || null, tagId]
    );


    const [updatedTag] = await connection.query(
      'SELECT * FROM Tags WHERE tagId = ?',
      [tagId]
    );

    res.status(200).json({
      success: true,
      message: 'Tag updated successfully',
      data: updatedTag[0]
    });

  } catch (error) {
    console.error('Error updating tag:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update tag',
   
    });
  }finally {
    if (connection) connection.release();
  }
};

const AssignTag = async (req, res) => {
  console.log(req.body);

  const { tagId, uniqueIds, fileId } = req.body;

  // Validate input
  if (!tagId || !uniqueIds || !Array.isArray(uniqueIds) || uniqueIds.length === 0 || !fileId) {
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
    const newUniqueIds = uniqueIds.filter((id) => !existingUniqueIds.includes(id));

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
 let connection
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
          tagName:name,
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
  }finally {
    if (connection) connection.release();
  }
};


const getDocumentsByTag = async (req,res) => {
  const tagId = req.params.tagId
  let connection
  try {
       connection = await pool.getConnection();

    const [rows] = await connection.query(`
      SELECT DISTINCT d.documentId, d.title, d.number
      FROM SpidTags st
      JOIN Documents d ON st.file_id = d.documentId
      WHERE st.tag_id = ?
    `, [tagId]);
    res.status(200).json(rows)
  } catch (error) {
    console.error('Error fetching documents by tag:', error);
    return { status: 500, error: 'Failed to fetch documents' };
  }
};


module.exports = { AddTag, getTags, deleteTag,updateTag,AssignTag,getAssignedTags,getDocumentsByTag };

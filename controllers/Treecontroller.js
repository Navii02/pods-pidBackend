const { pool } = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const generateCustomID = (prefix) => {
  const uuid = uuidv4();
  const uniqueID = prefix + uuid.replace(/-/g, "").slice(0, 6);
  return uniqueID;
};
const AddArea = async (req, res) => {
  // console.log(req.body);

  const area = req.body.code;
  const name = req.body.name;
  const project_id = req.body.projectId;
  let connection;
  try {
    connection = await pool.getConnection();

    const [existing] = await connection.query(
      `SELECT * FROM Areatable 
       WHERE project_id = ? AND (area = ? OR name = ?)`,
      [project_id, area, name]
    );

    if (existing.length > 0) {
      res.status(406).json({
        success: false,
        message: "Area with same name or code already exists in this project.",
      });
    }
    const areaId = generateCustomID("A-");
    await connection.query(
      `INSERT INTO Areatable (areaId, area, name, project_id)
       VALUES (?, ?, ?, ?)`,
      [areaId, area, name, project_id]
    );

    res
      .status(200)
      .json({ success: true, message: "Area successfully inserted." });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error adding Area:", error.message);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};
const AddDisipline = async (req, res) => {
  // console.log(req.body);

  const disc = req.body.code;
  const name = req.body.name;
  const project_id = req.body.projectId;
  let connection;
  try {
    connection = await pool.getConnection();

    const [existing] = await connection.query(
      `SELECT * FROM Disctable 
       WHERE project_id = ? AND (disc = ? OR name = ?)`,
      [project_id, disc, name]
    );

    if (existing.length > 0) {
      res.status(406).json({
        success: false,
        message:
          "Disipline with same name or code already exists in this project.",
      });
    }
    const discId = generateCustomID("D-");
    await connection.query(
      `INSERT INTO Disctable (discId, disc, name, project_id)
       VALUES (?, ?, ?, ?)`,
      [discId, disc, name, project_id]
    );

    res
      .status(200)
      .json({ success: true, message: "Disipline successfully inserted." });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error adding Disipline:", error.message);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};
const AddSystem = async (req, res) => {
  // console.log(req.body);

  const sys = req.body.code;
  const name = req.body.name;
  const project_id = req.body.projectId;
  let connection;
  try {
    connection = await pool.getConnection();

    const [existing] = await connection.query(
      `SELECT * FROM Systable 
       WHERE project_id = ? AND (sys = ? OR name = ?)`,
      [project_id, sys, name]
    );

    if (existing.length > 0) {
      res.status(406).json({
        success: false,
        message:
          "System with same name or code already exists in this project.",
      });
    }
    const sysId = generateCustomID("S-");
    await connection.query(
      `INSERT INTO Systable (sysId, sys, name, project_id)
       VALUES (?, ?, ?, ?)`,
      [sysId, sys, name, project_id]
    );

    res
      .status(200)
      .json({ success: true, message: "System successfully inserted." });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error adding System:", error.message);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};
const getArea = async (req, res) => {
  const project_id = req.params.id;
  console.log(`Fetching area for project_id: ${project_id}`);

  let connection;
  try {
    connection = await pool.getConnection();
    const [area] = await connection.query(
      `SELECT AreaId, area, name, project_id, created_at 
       FROM Areatable WHERE project_id = ?`,
      [project_id]
    );
    res.status(200).json({ success: true, area });
  } catch (error) {
    console.error("Error fetching area:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};

const getDisipline = async (req, res) => {
  const project_id = req.params.id;
  console.log(`Fetching discipline for project_id: ${project_id}`);

  let connection;
  try {
    connection = await pool.getConnection();
    const [disipline] = await connection.query(
      `SELECT discId, disc, name, project_id, created_at 
       FROM Disctable WHERE project_id = ?`,
      [project_id]
    );
    res.status(200).json({ success: true, disipline });
  } catch (error) {
    console.error("Error fetching discipline:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};

const getSystems = async (req, res) => {
  const project_id = req.params.id;
  console.log(`Fetching systems for project_id: ${project_id}`);

  let connection;
  try {
    connection = await pool.getConnection();
    const [system] = await connection.query(
      `SELECT sysId, sys, name, project_id, created_at 
       FROM Systable WHERE project_id = ?`,
      [project_id]
    );
    res.status(200).json({ success: true, system });
  } catch (error) {
    console.error("Error fetching systems:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};
// Update a single System
const updateSystem = async (req, res) => {
  const { sysId, sys, name, project_id } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Start transaction
    await connection.beginTransaction();

    // Get the old values before updating
    const [oldValues] = await connection.query(
      `SELECT sys, name FROM Systable WHERE sysId = ?`,
      [sysId]
    );

    if (oldValues.length === 0) {
      return res.status(404).json({ success: false, message: "System not found" });
    }

    const oldSys = oldValues[0].sys;
    const oldName = oldValues[0].name;

    // Update the Systable
    const [result] = await connection.query(
      `UPDATE Systable 
       SET sys = ?, name = ?, project_id = ? 
       WHERE sysId = ?`,
      [sys, name, project_id, sysId]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "System not found" });
    }

    // Update all references in Tree table
    await connection.query(
      `UPDATE Tree 
       SET sys = ?, name = ?
       WHERE sys = ? AND project_id = ? AND tag IS NULL`,
      [sys, name, oldSys, project_id]
    );

    // Update system references in Tree table where it's part of a path
    await connection.query(
      `UPDATE Tree 
       SET sys = ?
       WHERE sys = ? AND project_id = ?`,
      [sys, oldSys, project_id]
    );

    await connection.commit();
    res.status(200).json({ success: true, message: "System updated successfully" });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error updating system:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};
// Delete a single System
const deleteSystem = async (req, res) => {
  const sysId = req.params.id;
  let connection;
  try {
    connection = await pool.getConnection();
    const [result] = await connection.query(
      `DELETE FROM Systable WHERE sysId = ?`,
      [sysId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "System not found" });
    }
    res.status(200).json({ success: true, message: "System deleted successfully" });
  } catch (error) {
    console.error("Error deleting system:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Delete all Systems
const deleteAllSystems = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(`DELETE FROM Systable`);
    res.status(200).json({ success: true, message: "All systems deleted successfully" });
  } catch (error) {
    console.error("Error deleting all systems:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Update a single Discipline
const updateDiscipline = async (req, res) => {
  const { discId, disc, name, project_id } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Start transaction
    await connection.beginTransaction();

    // Get the old values before updating
    const [oldValues] = await connection.query(
      `SELECT disc, name FROM Disctable WHERE discId = ?`,
      [discId]
    );

    if (oldValues.length === 0) {
      return res.status(404).json({ success: false, message: "Discipline not found" });
    }

    const oldDisc = oldValues[0].disc;
    const oldName = oldValues[0].name;

    // Update the Disctable
    const [result] = await connection.query(
      `UPDATE Disctable 
       SET disc = ?, name = ?, project_id = ? 
       WHERE discId = ?`,
      [disc, name, project_id, discId]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Discipline not found" });
    }

    // Update all references in Tree table
    await connection.query(
      `UPDATE Tree 
       SET disc = ?, name = ?
       WHERE disc = ? AND project_id = ? AND sys IS NULL AND tag IS NULL`,
      [disc, name, oldDisc, project_id]
    );

    // Update discipline references in Tree table where it's part of a path
    await connection.query(
      `UPDATE Tree 
       SET disc = ?
       WHERE disc = ? AND project_id = ?`,
      [disc, oldDisc, project_id]
    );

    await connection.commit();
    res.status(200).json({ success: true, message: "Discipline updated successfully" });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error updating discipline:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Delete a single Discipline
const deleteDiscipline = async (req, res) => {
  const discId = req.params.id;
  let connection;
  try {
    connection = await pool.getConnection();
    const [result] = await connection.query(
      `DELETE FROM Disctable WHERE discId = ?`,
      [discId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Discipline not found" });
    }
    res.status(200).json({ success: true, message: "Discipline deleted successfully" });
  } catch (error) {
    console.error("Error deleting discipline:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Delete all Disciplines
const deleteAllDisciplines = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(`DELETE FROM Disctable`);
    res.status(200).json({ success: true, message: "All disciplines deleted successfully" });
  } catch (error) {
    console.error("Error deleting all disciplines:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Update a single Area
const updateArea = async (req, res) => {
  const { AreaId, area, name, project_id } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [oldValues] = await connection.query(
      `SELECT area, name FROM Areatable WHERE areaId = ?`,
      [AreaId]
    );

    if (oldValues.length === 0) {
      return res.status(404).json({ success: false, message: "Area not found" });
    }

    const oldArea = oldValues[0].area;

    await connection.query(
      `UPDATE Areatable SET area = ?, name = ?, project_id = ? WHERE areaId = ?`,
      [area, name, project_id, AreaId]
    );

    await connection.query(
      `UPDATE Tree 
       SET area = ?, name = ?
       WHERE area = ? AND project_id = ? AND disc IS NULL AND sys IS NULL AND tag IS NULL`,
      [area, name, oldArea, project_id]
    );

    await connection.query(
      `UPDATE Tree 
       SET area = ?
       WHERE area = ? AND project_id = ?`,
      [area, oldArea, project_id]
    );

    await connection.commit();
    res.status(200).json({ success: true, message: "Area updated successfully" });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error updating area:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};


// Delete a single Area
const deleteArea = async (req, res) => {
  const areaId = req.params.id;
  let connection;
  try {
    connection = await pool.getConnection();
    const [result] = await connection.query(
      `DELETE FROM Areatable WHERE areaId = ?`,
      [areaId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Area not found" });
    }
    res.status(200).json({ success: true, message: "Area deleted successfully" });
  } catch (error) {
    console.error("Error deleting area:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Delete all Areas
const deleteAllAreas = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(`DELETE FROM Areatable`);
    res.status(200).json({ success: true, message: "All areas deleted successfully" });
  } catch (error) {
    console.error("Error deleting all areas:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};








const AddProjectarea = async (req, res) => {
  const { id: project_id, code: area, name } = req.body;
 let connection
  try {
     connection = await pool.getConnection();
    // Check if same area and name already exists
    const [existing] = await connection.query(
      `SELECT * FROM Tree WHERE area = ? AND name = ? AND project_id = ?`,
      [area, name, project_id]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: 'Area with the same name already exists in this project.'
      });
    }

    // Insert new area
    await connection.query(
      `INSERT INTO Tree (area, name, project_id) VALUES (?, ?, ?)`,
      [area, name, project_id]
    );

    return res.status(200).json({ message: 'Area added successfully.' });

  } catch (error) {
    console.error('Error adding area:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    if (connection) connection.release();
  }
};

const AddProjecDisipline = async (req, res) => {
  const { id: project_id, area, name, code: disc } = req.body;
  let connection;

  try {
    connection = await pool.getConnection();

    const [existing] = await connection.query(
      `SELECT * FROM Tree WHERE disc = ? AND name = ? AND project_id = ? AND area = ?`,
      [disc, name, project_id, area]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: 'Discipline with the same name already exists in this area.'
      });
    }

    // Insert new discipline
    await connection.query(
      `INSERT INTO Tree (area, name, project_id, disc) VALUES (?, ?, ?, ?)`,
      [area, name, project_id, disc]
    );

    return res.status(200).json({ message: 'Discipline added successfully.' });

  } catch (error) {
    console.error('Error adding discipline:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    if (connection) connection.release();
  }
};


const AddProjectSystem = async (req, res) => {
  const { id: project_id, area, name, code: sys, disiplne: disc } = req.body;
  console.log(req.body);

  let connection;

  try {
    connection = await pool.getConnection();

    // Check if same system already exists under same area + discipline
    const [existing] = await connection.query(
      `SELECT * FROM Tree WHERE sys = ? AND name = ? AND project_id = ? AND area = ? AND disc = ?`,
      [sys, name, project_id, area, disc]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: 'System with the same name/code already exists in this discipline.'
      });
    }

    // Insert new system
    await connection.query(
      `INSERT INTO Tree (area, name, project_id, disc, sys) VALUES (?, ?, ?, ?, ?)`,
      [area, name, project_id, disc, sys]
    );

    return res.status(200).json({ message: 'System added successfully.' });

  } catch (error) {
    console.error('Error adding System:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    if (connection) connection.release();
  }
};

const AddProjectTags = async (req, res) => {
  const { project_id, area, name, code: tag, disc, sys } = req.body;
  console.log(req.body);

  let connection;

  try {
    connection = await pool.getConnection();

    // Check if same tag already exists under same area > discipline > system
    const [existing] = await connection.query(
      `SELECT * FROM Tree WHERE tag = ? AND name = ? AND project_id = ? AND area = ? AND disc = ? AND sys = ?`,
      [tag, name, project_id, area, disc, sys]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: 'Tag with the same name already exists in this system.'
      });
    }

    // Insert new tag
    await connection.query(
      `INSERT INTO Tree (area, name, project_id, disc, sys, tag) VALUES (?, ?, ?, ?, ?, ?)`,
      [area, name, project_id, disc, sys, tag]
    );

    return res.status(200).json({ message: 'Tag added successfully.' });

  } catch (error) {
    console.error('Error adding Tag:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    if (connection) connection.release();
  }
};

 const getTagsproject = async(req,res)=>{
  //console.log(req.params);
  
  const project_id = req.params.id;
  console.log(`Fetching systems for project_id: ${project_id}`);

  let connection;
  try {
    connection = await pool.getConnection();
    const [tags] = await connection.query(
      `SELECT *
       FROM Tags WHERE projectId = ?`,
      [project_id]
    );
    //console.log(tags);
    
    res.status(200).json({ success: true, tags });
  } catch (error) {
    console.error("Error fetching tags:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }

 }

const GetProjectArea =  async(req,res)=>{
  const project_id = req.params.id;

  let connection
  try {
     connection = await pool.getConnection();
    const [rows] = await connection.query(`
      SELECT id, area, name, project_id, created_at 
      FROM Tree 
      WHERE disc IS NULL AND sys IS NULL AND tag IS NULL AND project_id = ?
    `, [project_id]);

    res.status(200).json({
      status: 200,
      area: rows
    });
  } catch (error) {
    console.error('Error fetching project areas:', error);
    res.status(500).json({
      status: 500,
      message: 'Internal Server Error',
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
}

 const GetprojecDesipline = async(req,res)=>{
    const { area, project_id } = req.query;
    console.log(area,project_id);
    
  let connection
  try {
     connection = await pool.getConnection();
    const [rows] = await connection.query(`
      SELECT id, disc, name, project_id, created_at 
      FROM Tree 
      WHERE disc IS NOT NULL AND sys IS NULL AND tag IS NULL AND project_id = ? AND area = ? 
    `, [project_id,area]);

    res.status(200).json({
      status: 200,
      disciplines: rows
    });
  } catch (error) {
    console.error('Error fetching project disiplines:', error);
    res.status(500).json({
      status: 500,
      message: 'Internal Server Error',
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
 }
const GetProjectSystem = async(req,res)=>{
    const { area, project_id,disc } = req.query;
    console.log(req.query);
    
    console.log(area,project_id);
    
  let connection
  try {
     connection = await pool.getConnection();
    const [rows] = await connection.query(`
      SELECT id, disc, name,sys, project_id, created_at 
      FROM Tree 
      WHERE sys IS NOT NULL AND tag IS NULL AND project_id = ? AND area = ? AND disc = ?
    `, [project_id,area,disc]);

    res.status(200).json({
      status: 200,
      systems: rows
    });
  } catch (error) {
    console.error('Error fetching project systems:', error);
    res.status(500).json({
      status: 500,
      message: 'Internal Server Error',
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
 }
 const GetProjectTags = async(req,res)=>{
    const { area, project_id,disc,sys } = req.query;
    console.log(req.query);
    
    //console.log(area,project_id);
    
  let connection
  try {
     connection = await pool.getConnection();
    const [rows] = await connection.query(`
      SELECT *
      FROM Tree 
      WHERE tag IS NOT NULL AND project_id = ? AND area = ? AND disc = ? AND sys = ?
    `, [project_id,area,disc, sys]);

    res.status(200).json({
      status: 200,
      tags: rows
    });
  } catch (error) {
    console.error('Error fetching project tags:', error);
    res.status(500).json({
      status: 500,
      message: 'Internal Server Error',
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
 }

 
const DeleteEntity = async (req, res) => {
  const { type, project_id, code } = req.query;
  let connection;

  try {
    // Validate inputs
    if (!type || !project_id || !code) {
      return res.status(400).json({ message: "Missing required parameters: type, project_id, or code" });
    }

    connection = await pool.getConnection();

    let deleteQuery = '';
    if (type === "Area") {
      deleteQuery = `DELETE FROM Tree WHERE project_id = ? AND area = ?`;
    } else if (type === "Discipline") {
      deleteQuery = `DELETE FROM Tree WHERE project_id = ? AND area = ? AND disc = ?`;
    } else if (type === "System") {
      deleteQuery = `DELETE FROM Tree WHERE project_id = ? AND sys = ?`;
    } else if (type === "Tag") {
      deleteQuery = `DELETE FROM Tree WHERE project_id = ? AND area = ? AND disc = ? AND sys = ? AND tag = ?`;
    } else {
      return res.status(400).json({ message: "Invalid type" });
    }

    let result;
    if (type === "Area") {
      console.log(`Deleting Area: project_id=${project_id}, code=${code}`);
      result = await connection.query(deleteQuery, [project_id, code]);
    } else if (type === "Discipline") {
      const [areaCode, discCode] = code.split('__');
      if (!areaCode || !discCode) {
        return res.status(400).json({ message: "Invalid Discipline code format, expected area__disc" });
      }
      console.log(`Deleting Discipline: project_id=${project_id}, area=${areaCode}, disc=${discCode}`);
      result = await connection.query(deleteQuery, [project_id, areaCode, discCode]);
    } else if (type === "System") {
      console.log(`Deleting System: project_id=${project_id}, sys=${code}`);
      result = await connection.query(deleteQuery, [project_id, code]);
    } else if (type === "Tag") {
      // Expect code format: area_disc_sys__tag
      const parts = code.split('__');
      if (parts.length !== 2) {
        return res.status(400).json({ message: "Invalid Tag code format, expected area_disc_sys__tag" });
      }
      const [compositeKey, tagCode] = parts;
      const [areaCode, discCode, sysCode] = compositeKey.split('_');
      if (!areaCode || !discCode || !sysCode || !tagCode) {
        return res.status(400).json({ message: "Missing required fields in Tag code" });
      }
      console.log(`Deleting Tag: project_id=${project_id}, area=${areaCode}, disc=${discCode}, sys=${sysCode}, tag=${tagCode}`);
      result = await connection.query(deleteQuery, [project_id, areaCode, discCode, sysCode, tagCode]);
    }

    console.log(`Query result: affectedRows=${result.affectedRows}`);
    // Treat affectedRows = 0 as success if the row was already deleted
    res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    console.error(`Delete failed for ${type}, project_id: ${project_id}, code: ${code}`, error);
    res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    if (connection) {
      connection.release();
      console.log("Connection released");
    }
  }
};
module.exports = { AddArea, AddDisipline, AddSystem,getSystems,getArea,getDisipline, updateSystem, deleteSystem,deleteAllSystems, updateDiscipline,deleteDiscipline,deleteAllDisciplines,updateArea,deleteArea,deleteAllAreas,AddProjectarea,AddProjecDisipline,AddProjectSystem,AddProjectTags,GetProjectArea,GetprojecDesipline,GetProjectTags,GetProjectSystem,getTagsproject,DeleteEntity};

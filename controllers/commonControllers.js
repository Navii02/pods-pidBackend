const { pool } = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const generateCustomID = (prefix) => {
  const uuid = uuidv4();
  const uniqueID = prefix + uuid.replace(/-/g, "").slice(0, 6);
  return uniqueID;
};

const CreateProject = async (req, res) => {
  const { projectName, projectNumber, projectDescription, projectPath } =
    req.body;

  if (!projectName) {
    return res.status(400).json({
      success: false,
      message: "Project name is required and must be a non-empty string",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // Check for existing project
    const [existingProjects] = await connection.query(
      "SELECT * FROM projects WHERE projectName = ?",
      [projectName.trim()]
    );

    if (existingProjects.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Project with this name already exists",
      });
    }

    const projectId = generateCustomID("PRJ");

    // Insert the new project
    await connection.query(
      "INSERT INTO projects (projectId, projectName, projectNumber, projectDescription, projectPath) VALUES (?, ?, ?, ?, ?)",
      [
        projectId,
        projectName.trim(),
        projectNumber?.trim() || null,
        projectDescription?.trim() || null,
        projectPath?.trim() || null,
      ]
    );

    // Insert default statuses
    const defaultStatuses = [
      { statusname: "open", color: "#ff0000" },
      { statusname: "closed", color: "#00ff00" },
    ];

    // Insert unit and field for general taginfo
    const userDefinedFields = Array.from({ length: 50 }, (_, i) => ({
      taginfo: `Taginfo${i + 1}`,
      taginfounit: `Taginfounit${i + 1}`,
      tagcheck: "checked",
    }));

    for (const status of defaultStatuses) {
      const statusId = generateCustomID("CST");
      await connection.query(
        "INSERT INTO CommentStatus (number, projectId, statusname, color) VALUES (?, ?, ?, ?)",
        [statusId, projectId, status.statusname, status.color]
      );
    }

    for (let { taginfo, taginfounit, tagcheck } of userDefinedFields) {
      await connection.query(
        `INSERT IGNORE INTO UserTagInfoFieldUnits (projectId, field, unit, statuscheck) VALUES (?, ?, ?, ?)`,
        [projectId, taginfo, taginfounit, tagcheck]
      );
    }

    // Fetch and return the newly created project
    const [projectRows] = await connection.query(
      "SELECT * FROM projects WHERE projectId = ?",
      [projectId]
    );

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      project: projectRows[0],
    });
  } catch (error) {
    console.error("Error saving project:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const UpdateProject = async (req, res) => {
  const {
    projectId,
    projectName,
    projectNumber,
    projectDescription,
    projectPath,
  } = req.body;

  // Validate required fields
  if (!projectId || !projectName) {
    return res.status(400).json({
      success: false,
      message: "Project ID and project name are required",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // Check if the project exists
    const [existingProjects] = await connection.query(
      "SELECT * FROM projects WHERE projectId = ?",
      [projectId]
    );
    if (existingProjects.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Check if another project with the same name exists (excluding the current project)
    const [duplicateProjects] = await connection.query(
      "SELECT * FROM projects WHERE projectName = ? AND projectId != ?",
      [projectName.trim(), projectId]
    );
    if (duplicateProjects.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Another project with this name already exists",
      });
    }

    // Update the project
    const [result] = await connection.query(
      "UPDATE projects SET projectName = ?, projectNumber = ?, projectDescription = ?, projectPath = ? WHERE projectId = ?",
      [
        projectName.trim(),
        projectNumber ? projectNumber.trim() : null,
        projectDescription ? projectDescription.trim() : null,
        projectPath ? projectPath.trim() : null,
        projectId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Project not found or no changes made",
      });
    }

    res.status(200).json({
      success: true,
      message: "Project updated successfully",
      projectId,
      projectName: projectName.trim(),
      projectNumber: projectNumber ? projectNumber.trim() : null,
      projectDescription: projectDescription ? projectDescription.trim() : null,
      projectPath: projectPath ? projectPath.trim() : null,
    });
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const DeleteProject = async (req, res) => {
  const { projectId } = req.body;

  // Validate required fields
  if (!projectId) {
    return res.status(400).json({
      success: false,
      message: "Project ID is required",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // Check if the project exists
    const [existingProjects] = await connection.query(
      "SELECT * FROM projects WHERE projectId = ?",
      [projectId]
    );
    if (existingProjects.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Delete the project
    const [result] = await connection.query(
      "DELETE FROM projects WHERE projectId = ?",
      [projectId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const getprojects = async (req, res) => {
  try {
    let connection;
    connection = await pool.getConnection();
    const [row] = await connection.query("SELECT * FROM projects ");
    console.log(row);
    res.status(200).json({ row });
  } catch (error) {
    res.status(500).json("Internal server error");
  } finally {
    if (connection) connection.release();
  }
};

const savedocuments = async (req, res) => {
  console.log(req.body);

  const { documentNumber, title, description, type, projectId } = req.body;
  console.log(req.body);

  if (!req.file) {
    return res.status(400).json({ message: "File is required" });
  }
  const filename = req.file.filename;
  const documentId = generateCustomID("DOC");

  const insertQuery = `
    INSERT INTO Documents 
    (documentId, number, title, descr, type, filename, projectId) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  try {
    const [result] = await pool.execute(insertQuery, [
      documentId,
      documentNumber,
      title,
      description,
      type,
      filename,
      projectId,
    ]);

    res
      .status(201)
      .json({ message: "Document saved successfully", documentId });
  } catch (error) {
    console.error("DB insert error:", error);
    res.status(500).json({ message: "Database error", error: error.message });
  } finally {
    if (connection) connection.release();
  }
};

const getDocuments = async (req, res) => {
  const { projectId } = req.query;
  console.log(projectId);
  let connection;
  try {
    connection = await pool.getConnection();

    const [rows] = await connection.query(
      "SELECT * FROM Documents WHERE projectId = ?",
      [projectId]
    );
    //console.log(rows);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    connection.release();
  }
};

// save-saved-view
const saveSavedView = async (req, res) => {
  console.log(req.body);
 const { name, projectId, posX, posY, posZ, targX, targY, targZ } = req.body;
   let connection ;
  if (!name || !projectId) {
    return res.status(400).json({ message: 'Missing view name or projectId' });
  }

  try {
     connection = await pool.getConnection();

    // Check if the view already exists
    const [rows] = await connection.query(
      `SELECT * FROM Views WHERE name = ? AND projectId = ?`,
      [name, projectId]
    );

    if (rows.length > 0) {
      connection.release();
      return res.status(409).json({ message: 'View with this name already exists' });
    }

    // Insert the new view
    await connection.query(
      `INSERT INTO Views (name, projectId, posX, posY, posZ, targX, targY, targZ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, projectId, posX, posY, posZ, targX, targY, targZ]
    );

    connection.release();
    res.status(200).json({ message: 'View saved successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }

  
};

// All saved view
const AllSavedViews = async(req,res)=>{
const projectId  = req.params.projectId;

  let connection;
  try {
    connection = await pool.getConnection();

    const [rows] = await connection.query(
      "SELECT * FROM Views WHERE projectId = ?",
      [projectId]
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching Views:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    connection.release();
  }
}
//delete-saved-view
const deleteSavedView = async (req, res) => {
  const { projectId,viewid } = req.params;
  // console.log(id);

  let connection;

  try {
    connection = await pool.getConnection();

    const [existingView] = await connection.query(
      "SELECT * FROM Views WHERE name = ? AND projectId = ?",
      [viewid,projectId]
    );

    if (existingView.length === 0) {
      return res.status(404).json({
        success: false,
        message: "View not found",
      });
    }

    await connection.query("DELETE FROM Views WHERE name = ? AND projectId = ?", [viewid,projectId]);

    res.status(200).json({
      success: true,
      message: "Views deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting view:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete view",
    });
  } finally {
    if (connection) connection.release();
  }
};

// update-saved-view
const updateSavedView = async (req, res) => {
  const { projectId,oldName,newName } = req.body;
  console.log(req.body);

  let connection;

  try {
    if (!newName ) {
      return res.status(400).json({
        success: false,
        message: "Name is required fields",
      });
    }

    connection = await pool.getConnection();
    // Get the current tag values before updating
    const [existingView] = await connection.query(
      "SELECT * FROM Views WHERE name = ? AND projectId = ?",
      [oldName,projectId]
    );

    if (existingView.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "View not found",
      });
    }

    // Update the Tags table
    await connection.query(
      `UPDATE Views 
       SET  name = ?
       WHERE name = ? AND projectId = ?`,
      [newName,oldName,projectId]
    );

    res.status(200).json({
      success: true,
      message: "Views updated successfully",
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
module.exports = {
  CreateProject,
  getprojects,
  savedocuments,
  getDocuments,
  DeleteProject,
  UpdateProject,
  saveSavedView,
  AllSavedViews,
  deleteSavedView,
  updateSavedView
};

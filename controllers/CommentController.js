const { pool } = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const generateCustomID = (prefix) => {
  const uuid = uuidv4();
  const uniqueID = prefix + uuid.replace(/-/g, "").slice(0, 6);
  return uniqueID;
};


const getComments = async (req, res) => {
  const projectId = req.params.id;
  console.log(projectId);
  
  let connection;

  if (!projectId) {
    return res.status(400).json({
      success: false,
      message: "projectId is required",
    });
  }

  try {
    connection = await pool.getConnection();

    const [rows] = await connection.query(
      "SELECT number, statusname, color FROM CommentStatus WHERE projectId = ?",
      [projectId]
    );

    res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching comment statuses:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const addComment = async (req, res) => {
      console.log(req.body);
  const { statusname, color, projectId } = req.body;


  let connection;

  // Validate required fields
  if (!statusname || !color || !projectId) {
    return res.status(400).json({
      success: false,
      message: "statusname, color, and projectId are required",
    });
  }

  try {
    connection = await pool.getConnection();
          const number = generateCustomID("CST");

    // Insert new status into CommentStatus table
    const [result] = await connection.query(
      "INSERT INTO CommentStatus (number,statusname, color, projectId) VALUES (?, ?, ?,?)",
      [number,statusname, color, projectId]
    );

    // Fetch the inserted record to return it
    const [newStatus] = await connection.query(
      "SELECT number, statusname, color FROM CommentStatus WHERE number = ?",
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      data: newStatus[0],
      message: "Status added successfully",
    });
  } catch (error) {
    console.error("Error adding comment status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const deleteComment = async (req, res) => {
  const statusId = req.params.id;
  console.log(statusId);

  let connection;

  if (!statusId) {
    return res.status(400).json({
      success: false,
      message: "statusId is required",
    });
  }

  try {
    connection = await pool.getConnection();

    // Check if the status exists
    const [existingStatus] = await connection.query(
      "SELECT number FROM CommentStatus WHERE number = ?",
      [statusId]
    );

    if (existingStatus.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Status not found",
      });
    }

    // Delete the status
    await connection.query(
      "DELETE FROM CommentStatus WHERE number = ?",
      [statusId]
    );

    res.status(200).json({
      success: true,
      message: "Status deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting comment status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { getComments, addComment, deleteComment };
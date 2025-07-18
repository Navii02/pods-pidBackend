const { pool } = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const generateCustomID = (prefix) => {
  const uuid = uuidv4();
  const uniqueID = prefix + uuid.replace(/-/g, "").slice(0,11);
  return uniqueID;
};


const getCommentStatus = async (req, res) => {
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
  const { number, statusname, color, projectId } = req.body;
  console.log(req.body);

  let connection;

  if (!statusname || !color || !projectId) {
    return res.status(400).json({
      success: false,
      message: "statusname, color, and projectId are required",
    });
  }

  try {
    connection = await pool.getConnection();

    if (number) {
      // Update existing record
      const [updateResult] = await connection.query(
        "UPDATE CommentStatus SET statusname = ?, color = ? WHERE number = ? AND projectId = ?",
        [statusname, color, number, projectId]
      );

      if (updateResult.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "Status not found for update",
        });
      }

      const [updatedStatus] = await connection.query(
        "SELECT number, statusname, color FROM CommentStatus WHERE number = ?",
        [number]
      );

      return res.status(200).json({
        success: true,
        data: updatedStatus[0],
        message: "Status updated successfully",
      });
    } else {
      // Insert new record
      const newNumber = generateCustomID("CST");

      const [insertResult] = await connection.query(
        "INSERT INTO CommentStatus (number, statusname, color, projectId) VALUES (?, ?, ?, ?)",
        [newNumber, statusname, color, projectId]
      );

      const [newStatus] = await connection.query(
        "SELECT number, statusname, color FROM CommentStatus WHERE number = ?",
        [newNumber]
      );

      return res.status(201).json({
        success: true,
        data: newStatus[0],
        message: "Status added successfully",
      });
    }
  } catch (error) {
    console.error("Error adding/updating comment status:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};


const deleteCommentStatus = async (req, res) => {
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
const saveComment = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log(req.body);
    const {
      docnumber,
      comment,
      status,
      priority,
      projectId,
      coordinateX,
      coordinateY,
      coordinateZ,
      posX,        
      posY,        
      posZ,       
      targX,       
      targY,      
      targZ,       
      sourcetype,
      fileid
    } = req.body;
    const createdby ="jpo@poulconsult"

    // Validation
    if (!docnumber || !projectId) {
      return res.status(400).json({
        success: false,
        message: "Document number and project ID are required",
      });
    }
 const number = generateCustomID('C')
    const query = `
      INSERT INTO CommentTable (
        number,
        docNumber,
        comment,
        status,
        priority,
        projectId,
        coOrdinateX,
        coOrdinateY,
        coOrdinateZ,
        posX,
        posY,
        posZ,
        targX,
        targY,
        targZ,
        createdby,
        sourcetype,
        fileid,
        createddate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const values = [
      number,
      docnumber || null,
      comment || null,
      status || "open",
      priority || null,
      projectId,
      coordinateX || null,
      coordinateY || null,
      coordinateZ || null,
      posX || null,        
      posY || null,        
      posZ || null,        
      targX || null,        
      targY || null,       
      targZ || null,       
      createdby || null,
      sourcetype || null,
      fileid || null
    ];

    const [result] = await connection.query(query, values);


return res.status(200).json({
  success: true,
  commentId: number,
  message: "Comment saved successfully"
});

  } catch (error) {
    console.error("Error saving comment:", error);
  return res.status(500).json({
  success: false,
  message: "Error saving comment",
  error: error.message
});

  } finally {
    if (connection) connection.release();
  }
};
// const saveComment = async (req, res) => {
//   let connection;
//   try {
//     connection = await pool.getConnection();

//     const {
//       docnumber,
//       comment,
//       status,
//       priority,
//       projectId,
//       coordinateX,
//       coordinateY,
//       coordinateZ,
//       fileid,
//       sourcetype,
//     } = req.body;
// const createdby ="jpo@poulconsult"
   

//     // Validation
//     if (!docnumber || !projectId) {
//       return res.status(400).json({
//         success: false,
//         message: "Document number and project ID are required",
//       });
//     }
//  const number = generateCustomID('C')
//     await connection.query(
//       `INSERT INTO CommentTable (
//         fileid,
//         docNumber,
//         number,
//         projectId,
//         sourcetype,
//         comment,
//         status,
//         priority,
//         createdby,
//         coOrdinateX,
//         coOrdinateY,
//         coOrdinateZ
//       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//       [
//         fileid || null,
//         docnumber,
//         number,
//         projectId,
//         sourcetype || null,
//         comment || null,
//         status || "open",
//         priority || null,
//         createdby || null,
//         coordinateX || null,
//         coordinateY || null,
//         coordinateZ || null
//       ]
//     );

//     res.status(200).json({
//       success: true,
//       message: "Comment saved successfully",
//       data: {
//         number,
//         docNumber: docnumber,
//         projectId,
//         status: status || "open"
//       }
//     });
//   } catch (error) {
//     console.error("Error saving comment:", error);
//     res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       error: error.message,
//     });
//   } finally {
//     if (connection) connection.release();
//   }
// };
const getAllComments = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const projectId  = req.params.id;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required",
      });
    }

    const [results] = await connection.query(
      "SELECT * FROM CommentTable WHERE projectId = ? ORDER BY createddate DESC",
      [projectId]
    );

    res.status(200).json({
      success: true,
      message: "Comments retrieved successfully",
      data: results,
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const getComments = async(req,res)=>{
 let connection;
  try {
    connection = await pool.getConnection();

    const docNumber  = req.params.id;

    if (!docNumber) {
      return res.status(400).json({
        success: false,
        message: "docNumber is required",
      });
    }

    const [results] = await connection.query(
      "SELECT * FROM CommentTable WHERE docNumber = ? ORDER BY createddate DESC",
      [docNumber]
    );

    res.status(200).json({
      success: true,
      message: "Comments retrieved successfully",
      data: results,
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
} 
const updateComment = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const {
      number,
      status,
      
      closedDate,
      coOrdinateX,
      coOrdinateY,
      coOrdinateZ,
      comment,
      docNumber,
      priority,
      projectId,
      sourcetype
    } = req.body;
    console.log(req.body);
    
 const closedBy ="jpo@poulconsult"
    if (!number) {
      return res.status(400).json({
        success: false,
        message: "Comment number is required",
      });
    }

    // Prepare update fields
    const updateFields = {
      coOrdinateX,
      coOrdinateY,
      coOrdinateZ,
      comment,
      docNumber,
      priority,
      projectId,
      sourcetype,
      status
    };

    // Handle closed status fields
    if (status === 'closed') {
      updateFields.closedBy = closedBy || 'dummyclosedby';
      updateFields.closedDate = closedDate ? new Date(closedDate) : new Date();
    } else if (status !== 'closed') {
      updateFields.closedBy = null;
      updateFields.closedDate = null;
    }

    const [result] = await connection.query(
      "UPDATE CommentTable SET ? WHERE number = ?",
      [updateFields, number]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Comment updated successfully",
      data: { number, ...updateFields },
    });

  } catch (error) {
    console.error("Error updating comment:", error);
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
  let connection;
  try {
    connection = await pool.getConnection();

    const number  = req.params.id;

    if (!number) {
      return res.status(400).json({
        success: false,
        message: "Comment number is required in URL parameters",
      });
    }

    const [result] = await connection.query(
      "DELETE FROM CommentTable WHERE number = ?",
      [number]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Comment not found with the specified number",
      });
    }

    res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
      data: { number },
    });

  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting comment",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};
  const deleteAllComment = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const projectId  = req.params.id;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "id is required in URL parameters",
      });
    }

    const [result] = await connection.query(
      "DELETE FROM CommentTable WHERE projectId = ?",
      [projectId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Comment not found with the specified projectId",
      });
    }

    res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
      data: { projectId },
    });

  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting comment",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};
const updateCommentinPage = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const {
      number,
      status,
      
      closedDate,
      coOrdinateX,
      coOrdinateY,
      coOrdinateZ,
      comment,
      docNumber,
      priority,
      projectId,
      sourcetype
    } = req.body;
    console.log(req.body);
    
 const closedBy ="jpo@poulconsult"
    if (!number) {
      return res.status(400).json({
        success: false,
        message: "Comment number is required",
      });
    }

    // Prepare update fields
    const updateFields = {
      comment,
      priority,
      status
    };

    // Handle closed status fields
    if (status === 'closed') {
      updateFields.closedBy = closedBy || 'dummyclosedby';
      updateFields.closedDate = closedDate ? new Date(closedDate) : new Date();
    } else if (status !== 'closed') {
      updateFields.closedBy = null;
      updateFields.closedDate = null;
    }

    const [result] = await connection.query(
      "UPDATE CommentTable SET ? WHERE number = ?",
      [updateFields, number]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }
    const [results] = await connection.query(
      "SELECT * FROM CommentTable WHERE number = ? ORDER BY createddate DESC",
      [number]
    );
 console.log(results);
 
    res.status(200).json({
      success: true,
      message: "Comment updated successfully",
      data: results[0],
    });

  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};
module.exports = { getComments, addComment, deleteComment,saveComment,getCommentStatus,getAllComments,deleteCommentStatus,updateComment,deleteAllComment,updateCommentinPage};
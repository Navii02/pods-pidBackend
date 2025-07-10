const { pool } = require("../config/db");
const fs = require('fs/promises');
const { createReadStream } = require('fs');
const path = require('path');


const getsvgDocs = async (req, res) => {
  const { projectId, type } = req.query;
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('getsvgDocs query params:', { projectId, type });
    const [data] = await connection.query(
      "SELECT * FROM Documents WHERE projectId = ? AND type = ?",
      [projectId, type]
    );
    console.log('getsvgDocs result:', data);
    res.status(200).json({ success: true, files: data });
  } catch (error) {
    console.error('Error in getsvgDocs:', error.message);
    res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  } finally {
    if (connection) connection.release();
  }
};

const getSpidDocuments = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    console.log('Fetching document with ID:', id);
    
    connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT * FROM Documents WHERE documentId = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    const file = rows[0];
    if (!file.filename) {
      return res.status(400).json({ success: false, message: 'File path is missing in database' });
    }

    const filePath = path.join(process.cwd(), 'documents', file.filename);
    console.log('File path:', filePath);

    try {
      await fs.access(filePath);
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        return res.status(404).json({ success: false, message: 'Path is not a file', path: filePath });
      }
    } catch {
      return res.status(404).json({ success: false, message: 'File missing from server', path: filePath });
    }

    res.setHeader('Content-Type', 'image/svg+xml');
    const stream = createReadStream(filePath);
    stream.on('error', (err) => {
      console.error('Stream error:', err.message);
      res.status(500).json({ success: false, message: 'Failed to stream file', error: err.message });
    });
    stream.pipe(res);
  } catch (err) {
    console.error('Error fetching file:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch file', error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

const getspidelements = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    const [fileExists] = await connection.query('SELECT documentId FROM Documents WHERE documentId = ?', [id]);
    if (fileExists.length === 0) {
      return res.status(404).json({ success: false, message: 'SVG file not found' });
    }

    const [items] = await connection.query(
      `SELECT unique_id, item_json FROM spidelements WHERE document_id = ?`,
      [id]
    );

    const parsedItems = [];
    const invalidItems = [];
    
    for (const row of items) {
      try {
        const jsonData = JSON.parse(row.item_json);
        parsedItems.push({
          uniqueId: row.unique_id,
          json: jsonData
        });
      } catch (jsonErr) {
        invalidItems.push({
          uniqueId: row.unique_id,
          error: `Invalid JSON: ${jsonErr.message}`
        });
      }
    }

    res.status(200).json({
      success: true,
      items: parsedItems,
      invalidItems: invalidItems.length > 0 ? invalidItems : undefined
    });
  } catch (err) {
    console.error('Load SVG items error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load items', error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

const SaveElementswithUniqueId = async (req, res) => {
  const { id } = req.params;
  const { items } = req.body; // Now properly destructured from request body

  // Enhanced validation
  if (!Array.isArray(items)) {
    console.error('Invalid items format received:', items);
    return res.status(400).json({ 
      success: false, 
      message: 'Items must be an array',
      received: typeof items
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    
    // Validate document exists
    const [fileExists] = await connection.query(
      'SELECT documentId FROM Documents WHERE documentId = ?', 
      [id]
    );
    
    if (fileExists.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'SVG file not found' 
      });
    }

    // Process items with transaction
    await connection.beginTransaction();
    
    for (const item of items) {
      if (!item.uniqueId || !item.json) {
        console.warn('Skipping invalid item:', item);
        continue;
      }

      try {
        // Validate JSON is properly stringified
        JSON.parse(item.json);
        
        const [existing] = await connection.query(
          `SELECT id FROM spidelements WHERE document_id = ? AND unique_id = ?`,
          [id, item.uniqueId]
        );

        if (existing.length > 0) {
          await connection.query(
            `UPDATE spidelements SET item_json = ? WHERE document_id = ? AND unique_id = ?`,
            [item.json, id, item.uniqueId]
          );
        } else {
          await connection.query(
            `INSERT INTO spidelements (document_id, unique_id, item_json) VALUES (?, ?, ?)`,
            [id, item.uniqueId, item.json]
          );
        }
      } catch (err) {
        console.error(`Error processing item ${item.uniqueId}:`, err);
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Invalid item data for ${item.uniqueId}`,
          error: err.message
        });
      }
    }

    await connection.commit();
    res.status(200).json({ success: true, message: 'Items saved' });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('Save SVG items error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save items', 
      error: err.message 
    });
  } finally {
    if (connection) connection.release();
  }
};

const updatespiddata = async (req, res) => {
  const { id } = req.params; // documentId
  const { svgContent, items } = req.body;

  if (!svgContent) {
    return res.status(400).json({ success: false, message: 'No SVG content provided' });
  }

  try {
    const [fileRows] = await pool.query('SELECT * FROM Documents WHERE documentId = ?', [id]);
    if (fileRows.length === 0) {
      return res.status(404).json({ success: false, message: 'SVG file not found' });
    }

    const existingFile = fileRows[0];
  const uploadDir = path.resolve(__dirname, '../documents');

    const baseFilename = existingFile.filename;
    const newFilePath = path.join(uploadDir, baseFilename);

    await fs.writeFile(newFilePath, svgContent);
    const stats = await fs.stat(newFilePath);

    const invalidItems = [];
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        if (!item.uniqueId || !item.json) {
          invalidItems.push({ uniqueId: item.uniqueId || 'unknown', error: 'Missing uniqueId or json' });
          continue;
        }
        try {
          JSON.parse(item.json);
        } catch (jsonErr) {
          invalidItems.push({ uniqueId: item.uniqueId, error: `Invalid JSON: ${jsonErr.message}` });
        }
      }
    }

    if (invalidItems.length > 0) {
      await fs.unlink(newFilePath).catch(() => {});
      return res.status(400).json({
        success: false,
        message: 'One or more items contain invalid JSON',
        errors: invalidItems
      });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

     const updateQuery = `
  UPDATE Documents 
  SET filename = ?
  WHERE documentId = ?
`;
await connection.query(updateQuery, [baseFilename, id]);

      await connection.query('DELETE FROM spidelements WHERE document_id = ?', [id]);

      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          await connection.query(
            `INSERT INTO spidelements (document_id, unique_id, item_json) VALUES (?, ?, ?)`,
            [id, item.uniqueId, item.json]
          );
        }
      }

      await connection.commit();
      console.log('SVG file updated and items saved:', { documentId: id, itemCount: items.length });

      res.status(200).json({
        success: true,
        message: 'SVG and items saved',
        savedItems: items.length
      });
    } catch (err) {
      await connection.rollback();
      await fs.unlink(newFilePath).catch(() => {});
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Update SVG file error:', err);
    res.status(500).json({ success: false, message: 'Failed to update SVG', error: err.message });
  }finally {
    if (connection) connection.release();
  }
};


//flags

const AssignFlag = async (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({
            success: false,
            message: 'Request body must be a single flag object'
        });
    }

    const flag = req.body;
    let connection;

    try {
        connection = await pool.getConnection();
        
        // Validate required fields
        if (!flag.fileId || !flag.AssigneddocumentId || !flag.flagText) {
            throw new Error(`Missing required fields: fileId, AssigneddocumentId, flagText`);
        }

        // Process uniqueIds - ensure it's always an array and filter invalid values
        const validUniqueIds = Array.isArray(flag.uniqueIds) 
            ? flag.uniqueIds.filter(id => id != null && id.toString().trim() !== '')
            : [];

        // Prepare values with proper JSON stringification
        const values = [
            flag.fileId.toString().trim(),
            flag.AssigneddocumentId.toString().trim(),
            validUniqueIds.length > 0 ? JSON.stringify(validUniqueIds) : null,
            flag.documentTitle ? flag.documentTitle.toString().trim() : null,
            flag.flagText.toString().trim()
        ];

        const query = `
            INSERT INTO Flags 
            (fileId, AssigneddocumentId, uniqueIds, documentTitle, flagText) 
            VALUES (?, ?, ?, ?, ?)
        `;

        const [result] = await connection.query(query, values);

        return res.status(201).json({
            success: true,
            message: 'Flag created successfully',
            insertedId: result.insertId,
            affectedRows: result.affectedRows
        });

    } catch (error) {
        console.error('Database operation failed:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create flag',
            error: error.message
        });
    } finally {
        if (connection) connection.release();
    }
};
const getFlags = async (req, res) => {
    const fileId = req.params.id;
    
    
    if (!fileId || typeof fileId !== 'string' || fileId.trim() === '') {
        return res.status(400).json({
            success: false,
            message: 'Invalid fileId provided'
        });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        
        const query = `
            SELECT 
                id,
                fileId,
                AssigneddocumentId,
                uniqueIds,
                documentTitle,
                flagText
             
            FROM Flags
            WHERE fileId = ?
        `;

        const [results] = await connection.query(query, [fileId.trim()]);

        // Safely parse uniqueIds
        const formattedResults = results.map(flag => {
            let uniqueIds = [];
            try {
                if (flag.uniqueIds) {
                    // Handle both stringified JSON and already parsed arrays
                    uniqueIds = typeof flag.uniqueIds === 'string' 
                        ? JSON.parse(flag.uniqueIds) 
                        : flag.uniqueIds;
                    
                    // Ensure we always return an array
                    if (!Array.isArray(uniqueIds)) {
                        uniqueIds = [];
                    }
                }
            } catch (e) {
                console.error('Error parsing uniqueIds:', e);
                uniqueIds = [];
            }

            return {
                ...flag,
                uniqueIds
            };
        });

        return res.status(200).json({
            success: true,
            data: formattedResults,
            count: formattedResults.length
        });

    } catch (error) {
        console.error('Error fetching flags:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve flags',
            error: error.message
        });
    } finally {
        if (connection) connection.release();
    }
};
  


module.exports = { getsvgDocs, getSpidDocuments, getspidelements, SaveElementswithUniqueId,updatespiddata,AssignFlag,getFlags };
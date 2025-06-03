const mysql = require("mysql2/promise");
require("dotenv").config();

const createTempPool = async () => {
  return mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    queueLimit: 0,
  });
};

const initializeDatabase = async () => {
  let tempPool, connection;
  try {
    tempPool = await createTempPool();
    connection = await tempPool.getConnection();

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``
    );
    console.log(`Database ${process.env.DB_NAME} ensured.`);

    await connection.query(`USE \`${process.env.DB_NAME}\``);

    // Test the main pool connection after database creation
    const testConnection = await pool.getConnection();
    console.log("Successfully connected to database");
    testConnection.release();
  } catch (error) {
    console.error("Error initializing database:", error.message);
    throw error;
  } finally {
    if (connection) connection.release();
    if (tempPool) await tempPool.end();
  }
};

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  queueLimit: 0,
  timezone: "Z",
  connectTimeout: 10000,
  charset: "utf8mb4",
});

const createTables = async () => {
  let connection;
  try {
    connection = await pool.getConnection();

    // Create projects table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        projectId VARCHAR(255) NOT NULL UNIQUE,
        projectNumber VARCHAR(255),
        projectName VARCHAR(255) NOT NULL,
        projectDescription TEXT,
        projectPath TEXT
      )
    `);

    await connection.query(`CREATE TABLE IF NOT EXISTS Documents (
      documentId VARCHAR(36) NOT NULL,
      number VARCHAR(100) NOT NULL UNIQUE,
      title TEXT,
      descr TEXT,
      type VARCHAR(50),
      filename VARCHAR(255),
      projectId VARCHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(documentId)
    )`);

    await connection.query(`CREATE TABLE IF NOT EXISTS spidelements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      document_id VARCHAR(36) NOT NULL,
      unique_id VARCHAR(255) NOT NULL,
      item_json JSON NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES Documents(documentId) ON DELETE CASCADE
    )`);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS Tags (
        tagId TEXT NOT NULL,
        number VARCHAR(767) PRIMARY KEY NOT NULL, 
        name TEXT NOT NULL,
        parenttag TEXT,
        type TEXT NOT NULL,
        filename TEXT
      ) ENGINE=InnoDB;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS TagInfo (
        tagId VARCHAR(255) PRIMARY KEY,
        tag TEXT,
        type TEXT,
        taginfo1 TEXT,
        taginfo2 TEXT,
        taginfo3 TEXT,
        taginfo4 TEXT,
        taginfo5 TEXT,
        taginfo6 TEXT,
        taginfo7 TEXT,
        taginfo8 TEXT,
        taginfo9 TEXT,
        taginfo10 TEXT,
        taginfo11 TEXT,
        taginfo12 TEXT,
        taginfo13 TEXT,
        taginfo14 TEXT,
        taginfo15 TEXT,
        taginfo16 TEXT,
        taginfo17 TEXT,
        taginfo18 TEXT,
        taginfo19 TEXT,
        taginfo20 TEXT,
        taginfo21 TEXT,
        taginfo22 TEXT,
        taginfo23 TEXT,
        taginfo24 TEXT,
        taginfo25 TEXT,
        taginfo26 TEXT,
        taginfo27 TEXT,
        taginfo28 TEXT,
        taginfo29 TEXT,
        taginfo30 TEXT,
        taginfo31 TEXT,
        taginfo32 TEXT,
        taginfo33 TEXT,
        taginfo34 TEXT,
        taginfo35 TEXT,
        taginfo36 TEXT,
        taginfo37 TEXT,
        taginfo38 TEXT,
        taginfo39 TEXT,
        taginfo40 TEXT,
        taginfo41 TEXT,
        taginfo42 TEXT,
        taginfo43 TEXT,
        taginfo44 TEXT,
        taginfo45 TEXT,
        taginfo46 TEXT,
        taginfo47 TEXT,
        taginfo48 TEXT,
        taginfo49 TEXT,
        taginfo50 TEXT
      ) ENGINE=InnoDB;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS LineList (
        tagId VARCHAR(255),
        tag VARCHAR(255) PRIMARY KEY,
        fluidCode TEXT,
        lineId TEXT,
        medium TEXT,
        lineSizeIn DECIMAL(10,2),
        lineSizeNb DECIMAL(10,2),
        pipingSpec TEXT,
        insType TEXT,
        insThickness TEXT,
        heatTrace TEXT,
        lineFrom TEXT,
        lineTo TEXT,
        pnid TEXT,
        pipingIso TEXT,
        pipingStressIso TEXT,
        maxOpPress DECIMAL(10,2),
        maxOpTemp DECIMAL(10,2),
        dsgnPress DECIMAL(10,2),
        minDsgnTemp DECIMAL(10,2),
        maxDsgnTemp DECIMAL(10,2),
        testPress DECIMAL(10,2),
        testMedium TEXT,
        testMediumPhase TEXT,
        massFlow DECIMAL(10,2),
        volFlow DECIMAL(10,2),
        density DECIMAL(10,2),
        velocity DECIMAL(10,2),
        paintSystem TEXT,
        ndtGroup TEXT,
        chemCleaning TEXT,
        pwht TEXT
      ) ENGINE=InnoDB;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS EquipmentList (
        tagId VARCHAR(255),
        tag VARCHAR(255) PRIMARY KEY,
        descr TEXT,
        qty VARCHAR(50),
        capacity DECIMAL(10,2),
        type VARCHAR(100),
        materials TEXT,
        capacityDuty VARCHAR(100),
        dims VARCHAR(100),
        dsgnPress DECIMAL(10,2),
        opPress DECIMAL(10,2),
        dsgnTemp DECIMAL(10,2),
        opTemp DECIMAL(10,2),
        dryWeight DECIMAL(10,2),
        opWeight DECIMAL(10,2),
        pnid VARCHAR(100),
        supplier VARCHAR(255),
        remarks TEXT,
        initStatus VARCHAR(50),
        revision VARCHAR(50),
        revisionDate VARCHAR(50)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS SpidTags (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tag_id VARCHAR(50) NOT NULL,
        unique_id VARCHAR(100) NOT NULL,
        file_id VARCHAR(50) NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_tag_assignment (tag_id, unique_id, file_id)
      ) ENGINE=InnoDB;
    `);
    await connection.query(`CREATE TABLE IF NOT EXISTS Flags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fileId VARCHAR(50) NOT NULL,
    AssigneddocumentId VARCHAR(50) NOT NULL,
    uniqueIds JSON NOT NULL,
    documentTitle VARCHAR(100) NOT NULL,
    flagText VARCHAR(50) NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`);

    console.log(`All tables ensured.`);
  } catch (error) {
    console.error("Error creating tables:", error.message);
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

pool.on("acquire", (connection) => {
  console.log("Connection acquired:", connection.threadId);
});
pool.on("release", (connection) => {
  console.log("Connection released:", connection.threadId);
});

module.exports = {
  pool,
  initializeDatabase,
  createTables,
};

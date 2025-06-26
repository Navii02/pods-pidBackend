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
        tagId VARCHAR(255) PRIMARY KEY,
        number VARCHAR(767) NOT NULL UNIQUE, 
        projectId VARCHAR(36),
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
         projectId VARCHAR(36),
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
        taginfo50 TEXT,
            FOREIGN KEY (tagId) REFERENCES Tags(tagId) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    await connection.query(`
    CREATE TABLE IF NOT EXISTS UserTagInfoFieldUnits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        projectId VARCHAR(36),
        field TEXT NOT NULL,
        unit TEXT NOT NULL,
        statuscheck TEXT NOT NULL
    ) ENGINE=InnoDB;
`);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS LineList (
       projectId VARCHAR(36),
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
        pwht TEXT,
            FOREIGN KEY (tagId) REFERENCES Tags(tagId) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS EquipmentList (
       projectId VARCHAR(36),
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
        revisionDate VARCHAR(50),
            FOREIGN KEY (tagId) REFERENCES Tags(tagId) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);
    await connection.query(`
    CREATE TABLE IF NOT EXISTS valveList (
    
      area VARCHAR(100) DEFAULT NULL,
      discipline VARCHAR(100) DEFAULT NULL,
      Systm VARCHAR(100) DEFAULT NULL,
      function_code VARCHAR(100) DEFAULT NULL,
      sequence_number VARCHAR(100) DEFAULT NULL,
       projectId VARCHAR(36),
        tagId VARCHAR(255),
        tag VARCHAR(255) PRIMARY KEY,
      line_id VARCHAR(100) DEFAULT NULL,
      line_number VARCHAR(100) DEFAULT NULL,
      pid VARCHAR(100) DEFAULT NULL,
      isometric VARCHAR(100) DEFAULT NULL,
      data_sheet VARCHAR(100) DEFAULT NULL,
      drawings VARCHAR(100) DEFAULT NULL,
      design_pressure VARCHAR(100) DEFAULT NULL,
      design_temperature VARCHAR(100) DEFAULT NULL,
      size VARCHAR(100) DEFAULT NULL,
      paint_system VARCHAR(100) DEFAULT NULL,
      purchase_order VARCHAR(100) DEFAULT NULL,
      supplier VARCHAR(100) DEFAULT NULL,
      information_status VARCHAR(100) DEFAULT NULL,
      equipment_status VARCHAR(100) DEFAULT NULL,
      comment TEXT DEFAULT NULL,
          FOREIGN KEY (tagId) REFERENCES Tags(tagId) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS SpidTags (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tag_id VARCHAR(50) NOT NULL,
        unique_id VARCHAR(100) NOT NULL,
        file_id VARCHAR(50) NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    await connection.query(`
  CREATE TABLE IF NOT EXISTS Areatable (
    areaId VARCHAR(100) NOT NULL PRIMARY KEY,
    area VARCHAR(100) UNIQUE, 
    name VARCHAR(100) UNIQUE,
    project_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB;
`);

    await connection.query(`
  CREATE TABLE IF NOT EXISTS Disctable (
    discId VARCHAR(100) NOT NULL PRIMARY KEY,
    disc VARCHAR(100) UNIQUE,  
    name VARCHAR(100),
    project_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB;
`);

    await connection.query(`
  CREATE TABLE IF NOT EXISTS Systable (
    sysId VARCHAR(100) NOT NULL PRIMARY KEY,
    sys VARCHAR(100) UNIQUE, 
    name VARCHAR(100),
    project_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB;
`);

    await connection.query(`
    CREATE TABLE IF NOT EXISTS Tree (
        id INT AUTO_INCREMENT PRIMARY KEY,
        area VARCHAR(100), 
        disc VARCHAR(100) DEFAULT NULL,  
        sys VARCHAR(100) DEFAULT NULL,  
        tag VARCHAR(767) DEFAULT NULL, 
        name VARCHAR(100),
        project_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (area) REFERENCES Areatable(area) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (disc) REFERENCES Disctable(disc) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (sys) REFERENCES Systable(sys) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (tag) REFERENCES Tags(number) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB;
`);
    await connection.query(`
  CREATE TABLE IF NOT EXISTS UnassignedModels (
    number VARCHAR(36) PRIMARY KEY,
    projectId VARCHAR(100) NOT NULL,
    fileName VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB;
`);

    await connection.query(`
  CREATE TABLE IF NOT EXISTS CommentTable (
    fileid VARCHAR(100),
    docNumber VARCHAR(100),
    number VARCHAR(36) PRIMARY KEY,
    projectId VARCHAR(100) NOT NULL,
    sourcetype VARCHAR(100),
    comment TEXT,
    status VARCHAR(50),
    priority VARCHAR(50),
    createdby VARCHAR(100),
    createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    coOrdinateX REAL,
    coOrdinateY REAL,
    coOrdinateZ REAL,
    closedBy VARCHAR(100),
    closedDate TIMESTAMP,
    INDEX (fileid),
    INDEX (docNumber),
    INDEX (projectId)
  ) ENGINE=InnoDB;
`);

    await connection.query(`
  CREATE TABLE IF NOT EXISTS CommentStatus (
    number VARCHAR(36) PRIMARY KEY,
    projectId VARCHAR(100) NOT NULL,
    statusname VARCHAR(100) NOT NULL,
    color VARCHAR(50) NOT NULL,
    INDEX (statusname),
    INDEX (projectId)
  ) ENGINE=InnoDB;
`);

await connection.query(`CREATE TABLE IF NOT EXISTS GroundSettings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  projectId VARCHAR(36) NOT NULL,
  level DOUBLE,
  color VARCHAR(50),
  opacity DOUBLE,
  FOREIGN KEY (projectId) REFERENCES projects(projectId)
) ENGINE=InnoDB;`)

await connection.query(`CREATE TABLE IF NOT EXISTS WaterSettings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  projectId VARCHAR(36) NOT NULL,
  level DOUBLE,
  opacity DOUBLE,
  color VARCHAR(50),
  colorBlendFactor DOUBLE,
  bumpHeight DOUBLE,
  waveLength DOUBLE,
  windForce DOUBLE,
  FOREIGN KEY (projectId) REFERENCES projects(projectId)
) ENGINE=InnoDB;
`)
await connection.query(`CREATE TABLE IF NOT EXISTS Views (
  name VARCHAR(255) NOT NULL,
  projectId VARCHAR(36) NOT NULL,
  posX DOUBLE,
  posY DOUBLE,
  posZ DOUBLE,
  targX DOUBLE,
  targY DOUBLE,
  targZ DOUBLE,
  PRIMARY KEY (name, projectId),
  FOREIGN KEY (projectId) REFERENCES projects(projectId) ON DELETE CASCADE
) ENGINE=InnoDB;
`)


await connection.query(`CREATE TABLE IF NOT EXISTS SettingsTable (
  projectId VARCHAR(36) NOT NULL PRIMARY KEY,
  settings TEXT
) ENGINE=InnoDB;
`)

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

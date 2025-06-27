const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const router = require("./Router/Routes");
const bodyParser = require("body-parser");
const { initializeDatabase, createTables } = require("./config/db");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use("/api", router);
app.use("/upload", express.static(path.join(__dirname, "documents")));

app.use("/models/:projectId",(req, res, next) => {
    next();
  },(req, res, next) => {
    express.static(path.join(__dirname, "models", req.params.projectId))(
      req,
      res,
      next
    );
  }
);

app.use( "/tags/:projectId",(req, res, next) => {
    express.static(path.join(__dirname, "tags", req.params.projectId))(
      req,
      res,
      next
    );
  }
);

const PORT = process.env.PORT || 5000;

async function startApp() {
  try {
    await initializeDatabase();
    await createTables();
    console.log("Database and tables initialized successfully");

    app.listen(PORT, () => {
      console.log(`PlantDesk server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  }
}

startApp();

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const router = require("./Router/Routes");
const bodyParser = require("body-parser");
const swaggerUI = require('swagger-ui-express');
const YAML = require('yamljs');
const { initializeDatabase, createTables } = require("./config/db");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ limit: "500mb", extended: true }));
const swaggerDocument = YAML.load('./docs/swagger.yaml');

app.use("/api", router);
app.use("/upload", express.static(path.join(__dirname, "documents")));
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerDocument));
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
app.use('/octrees', express.static(path.join(__dirname, 'octrees')));
app.use('/originalMeshes', express.static(path.join(__dirname, 'originalMeshes')));
app.use('/mergedMeshes', express.static(path.join(__dirname, 'mergedMeshes')));



// Add this BEFORE your static file middleware
app.use((req, res, next) => {
  if (req.path.endsWith('/') && req.path.length > 1) {
    return res.redirect(301, req.path.slice(0, -1));
  }
  next();
});

// Then your existing static file middleware
app.use("/tags/:projectId", (req, res, next) => {
  const staticMiddleware = express.static(
    path.join(__dirname, "tags", req.params.projectId)
  );
  req.url = req.url.replace(`/${req.params.projectId}`, "");
  staticMiddleware(req, res, next);
});

app.use("/unassignedModels/:projectId", (req, res, next) => {
  const staticMiddleware = express.static(
    path.join(__dirname, "unassignedModels", req.params.projectId)
  );
  req.url = req.url.replace(`/${req.params.projectId}`, "");
  staticMiddleware(req, res, next);
});


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
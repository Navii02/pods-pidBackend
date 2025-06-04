const express = require("express");
const {
  CreateProject,
  getprojects,
  savedocuments,
  getDocuments,
  UpdateProject,
  DeleteProject,
} = require("../controllers/commonControllers");
const documentupload = require("../multer/documentmulter");
const {
  getsvgDocs,
  getSpidDocuments,
  getspidelements,
  SaveElementswithUniqueId,
  updatespiddata,
  AssignFlag,
  getFlags,
} = require("../controllers/spidcontrollers");
const { AddTag, getTags, deleteTag, updateTag, AssignTag, getAssignedTags, getDocumentsByTag } = require("../controllers/TagController");
const router = express.Router();

router.post("/createproject", CreateProject);
router.get("/getproject", getprojects);
router.put("/updateproject", UpdateProject);
router.delete("/deleteproject", DeleteProject);

router.post("/savedocument", documentupload.single("file"), savedocuments);
router.get("/getdocumentsdetails", getDocuments);

router.get("/getsvgdocuments", getsvgDocs);
router.get("/getspiddocument/:id", getSpidDocuments);
router.get("/spidelements/:id", getspidelements);
router.post("/saveelementswithuniqueId/:id", SaveElementswithUniqueId);
router.post("/updatespiddata/:id", updatespiddata);

router.post('/addtag',AddTag)
router.get('/get-alltags',getTags)
router.delete('/delete-tag/:id',deleteTag)
router.put('/update-tag/:id',updateTag)


router.post('/assign-tag',AssignTag)
router.get('/get-assigned-tags/:id',getAssignedTags)
router.get('/tags/:tagId/documents',getDocumentsByTag)


router.post('/assign-flag',AssignFlag)
router.get('/get-assigned-flags/:id',getFlags)


module.exports = router;

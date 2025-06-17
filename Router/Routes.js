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
const convertedFilesUpload = require("../multer/Modalmulter");
const AssignedModels = require("../multer/AssignedModelMulter");

const {
  getsvgDocs,
  getSpidDocuments,
  getspidelements,
  SaveElementswithUniqueId,
  updatespiddata,
  AssignFlag,
  getFlags,
} = require("../controllers/spidcontrollers");
const {
  AddTag,
  getTags,
  deleteTag,
  updateTag,
  AssignTag,
  getAssignedTags,
  getDocumentsByTag,
  GetLineList,
  GetequipmentList,
  GetValveList,
  EditLineList,
  EditEquipmentList,
  EditValveList,
  DeleteValveList,
} = require("../controllers/TagController");
const {
  AddArea,
  AddSystem,
  AddDisipline,
  getSystems,
  getDisipline,
  getArea,
  AddProjectarea,
  AddProjecDisipline,
  AddProjectSystem,
  GetProjectArea,
  GetprojecDesipline,
  GetProjectSystem,
  getTagsproject,
  DeleteEntity,
  updateArea,
  deleteArea,
  deleteAllAreas,
  updateSystem,
  deleteSystem,
  deleteAllSystems,
  updateDiscipline,
  deleteDiscipline,
  deleteAllDisciplines,
  AddProjectTags,
  GetProjectTags,
} = require("../controllers/Treecontroller");
const {
  uploadbulkModal,
  saveBulkModal,
  AssignedBulkModelSave,
  saveChangedUnassigned,
} = require("../controllers/BulkModalController");
const {
  getComments,
  addComment,
  deletecomment,
  deleteComment,
} = require("../controllers/CommentController");
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

router.post("/addtag", AddTag);
router.get("/get-alltags/:id", getTags);
router.delete("/delete-tag/:id", deleteTag);
router.put("/update-tag/:id", updateTag);


 router.get('/getline/:id',GetLineList)
 router.put('/edit-line-list',EditLineList)
 router.delete('/delete-line-list/:id',deleteTag)



  router.get('/getequipment/:id',GetequipmentList)
   router.put('/edit-equipment-list',EditEquipmentList)
   router.delete('/delete-equipment-list/:id',deleteTag)



  router.get('/getvalve/:id',GetValveList)
   router.put('/edit-valve-list',EditValveList)
   router.delete('/delete-valve-list/:id',deleteTag)





router.post("/assign-tag", AssignTag);
router.get("/get-assigned-tags/:id", getAssignedTags);
router.get("/tags/:tagId/documents", getDocumentsByTag);


router.post("/assign-flag", AssignFlag);
router.get("/get-assigned-flags/:id", getFlags);

// tree management

router.post("/add-area", AddArea);
router.get("/getarea/:id", getArea);
router.put("/updatearea", updateArea);
router.delete("/deletearea/:id", deleteArea);
router.delete("/deleteallareas", deleteAllAreas);

router.post("/add-system", AddSystem);
router.get("/getsystems/:id", getSystems);
router.put("/updatesystem", updateSystem);
router.delete("/deletesystem/:id", deleteSystem);
router.delete("/deleteallsystems", deleteAllSystems);

router.post("/add-disipline", AddDisipline);
router.get("/getdispline/:id", getDisipline);
router.put("/updatediscipline", updateDiscipline);
router.delete("/deletediscipline/:id", deleteDiscipline);
router.delete("/deletealldisciplines", deleteAllDisciplines);

router.post("/project-areas", AddProjectarea);
router.post("/project-disciplines", AddProjecDisipline);
router.post("/project-systems", AddProjectSystem);
router.post("/project-tags", AddProjectTags);

router.get("/project-getarea/:id", getArea);
router.get("/project-getdisipline/:id", getDisipline);
router.get("/project-getsystem/:id", getSystems);
router.get("/project-gettags/:id", getTagsproject);

router.get("/getproject-area/:id", GetProjectArea);
router.get("/getproject-disipline", GetprojecDesipline);
router.get("/getproject-system", GetProjectSystem);
router.get("/getproject-tags", GetProjectTags);

router.delete("/deleteEntity", DeleteEntity);

//bulkmodel

router.post(
  "/upload-bulk-files",
  convertedFilesUpload.array("files"),
  uploadbulkModal
);
router.post("/save-bulkimport", saveBulkModal);
router.post("/save-changedfiles", saveChangedUnassigned);

//comments

router.get("/comment/get-comments/:id", getComments);
router.post("/comment/add-comment", addComment);
router.delete("/comment/delete-comment/:id", deleteComment);

module.exports = router;

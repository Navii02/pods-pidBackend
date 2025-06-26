const express = require("express");
const {
  CreateProject,
  getprojects,
  savedocuments,
  getDocuments,
  UpdateProject,
  DeleteProject,
  saveSavedView,
  AllSavedViews,
  deleteSavedView,
  updateSavedView,
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
  getTagByProjectAndFilename,
  GetLineListUsingTagId,
  GetEquipmentListUsingTagId,
  GetValveListUsingTagId,
  GetGeneralTagInfoUsingTagId,
  GetGeneralTagInfoField,
  GetAllGeneralTagInfo,
  UpdateGEneralTagInfField,
  EditGeneralTagInfo,
  ClearTagInfoFields,
  SaveUpdatedTagFile,
  ClearEditableValveFields,
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
  GetUnassignedmodels,
  AssignModeltags,
  DeleteAllUnassigned,
  DeleteUnassigned,
} = require("../controllers/BulkModalController");
const {
  getComments,
  addComment,
  deletecomment,
  deleteComment,
  saveComment,
  getCommentStatus,
  getAllComments,
  updateComment,
  deleteCommentStatus,
  deleteAllComment,
} = require("../controllers/CommentController");
const { GetModal } = require("../controllers/Iroamer");
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
 router.post("/save-updated-tagfile",SaveUpdatedTagFile)
router.get("/get-alltags/:id", getTags);
router.delete("/delete-tag/:id", deleteTag);
router.put("/update-tag/:id", updateTag);
router.get(
  "/get-mesh-tag-by-project/:projectId/:filename",
  getTagByProjectAndFilename
);

router.get("/getline/:id", GetLineList);
router.put("/edit-line-list", EditLineList);
router.delete("/delete-line-list/:id", deleteTag);
router.get("/getline-details/:id/:tagId", GetLineListUsingTagId);

router.get("/getequipment/:id", GetequipmentList);
router.put("/edit-equipment-list", EditEquipmentList);
router.delete("/delete-equipment-list/:id", deleteTag);
router.get("/getequipment-details/:id/:tagId", GetEquipmentListUsingTagId);

router.get("/getvalve/:id", GetValveList);
router.put("/edit-valve-list", EditValveList);
router.put("/delete-valve-list", ClearEditableValveFields);
router.get("/getvalve-details/:id/:tagId", GetValveListUsingTagId);

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
router.get("/get-unassignedmodels/:id", GetUnassignedmodels);
router.post("/assign-model-tags", AssignModeltags);
router.delete("/delete-allunassignedmodel/:id", DeleteAllUnassigned);
router.delete("/delete-unassignedmodel/:id", DeleteUnassigned);

//comments

router.get("/comment/get-comments/:id", getCommentStatus);
router.post("/comment/add-comment", addComment);
router.delete("/comment/delete-comment/:id", deleteCommentStatus);
router.get('/getcomments/:id',getCommentStatus)
router.post('/savecomment',saveComment)
router.get('/get-allcomments/:id',getAllComments)
router.get('/get-comments/:id',getComments)
router.put('/update-comment',updateComment)
router.delete('/delete-comment/:id',deleteComment)
router.delete('/delete=all-comments/:id',deleteAllComment)

router.get('/getmodel/:projectId/:areaIds/:discIds/:systemIds/:tagIds',GetModal)

// all-saved-view

router.get("/get-allgeneral-taginfo/:id",GetAllGeneralTagInfo);
router.get("/getgeneral-taginfo-field/:id",GetGeneralTagInfoField);
router.put("/update-general-taginfo-field",UpdateGEneralTagInfField);
router.put("/edit-general-taginfo-list",EditGeneralTagInfo);
router.put("/delete-general-taginfo-list",ClearTagInfoFields);

router.post("/save-saved-view",saveSavedView);
router.get("/all-saved-view/:projectId",AllSavedViews)
router.delete("/delete-saved-view/:projectId/:viewid",deleteSavedView)
router.put("/update-saved-view",updateSavedView);

module.exports = router;

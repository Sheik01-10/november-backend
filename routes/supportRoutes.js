const express = require("express");
const router = express.Router();
const supportController = require("../controllers/supportController");

router.post("/", supportController.createMessage);
router.get("/", supportController.getMessages);
router.put("/:id/read", supportController.markAsRead);
router.delete("/:id", supportController.deleteMessage);

module.exports = router;

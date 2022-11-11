const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  project: String,
  name: String,
  revitElmtId: Number,
  revitUniqId: String,
  svfParentPath: String,
  isAsset: Boolean,
});
module.exports = mongoose.model("svf_tree_nodes", schema, "svf_tree_nodes");

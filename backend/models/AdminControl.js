import mongoose from "mongoose";

// Serialize staff changes and roster imports so identity claims and promotions
// are checked against the latest committed account state.
const schema = new mongoose.Schema({ _id: String, revision: { type: Number, default: 0 } }, { versionKey: false });
export default mongoose.model("AdminControl", schema);

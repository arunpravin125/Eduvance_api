import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // sender (optional but useful)
  toUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // recipient
  type: {
    type: String,
    enum: ["general", "join_Request", "follow_request", "post", "repost"],
    default: "general",
  },
  message: { type: String, required: true },

  community: { type: mongoose.Schema.Types.ObjectId, ref: "Community" },
  post: { type: mongoose.Schema.Types.ObjectId, ref: "CommunityPost" },

  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export const Notification = mongoose.model("Notification", NotificationSchema);

import mongoose from "mongoose";

// Message Sub-Schema
const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  content: {
    type: String,
    trim: true,
  },
  media: [
    {
      url: { type: String, required: true },
      type: {
        type: String,
        enum: ["image", "video", "audio", "file"],
        required: true,
      },
    },
  ],
  sentAt: { type: Date, default: Date.now },
  seen: {
    type: Boolean,
    default: "false",
  },
  replyTo: {
    _id: { type: mongoose.Schema.Types.ObjectId },
    content: { type: String },
    sender: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      username: String,
      profilePic: String,
    },
  },
  reactions: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      emoji: {
        type: String,
        required: true,
      },
    },
  ],
  seenBy: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  // Optional: Add read receipts or deleted status later
});

// Chat Room (Group) Schema
const chatRoomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    avatar: { type: String }, // group profile picture URL

    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    messages: [messageSchema],
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    lastMessageAt: { type: Date },
  },
  { timestamps: true } // automatically manages createdAt & updatedAt
);

// Pre-save hook to update `lastMessageAt`
chatRoomSchema.pre("save", function (next) {
  if (this.messages.length > 0) {
    this.lastMessageAt = this.messages[this.messages.length - 1].sentAt;
  }
  next();
});

// Export Model
export const ChatRoom = mongoose.model("ChatRoom", chatRoomSchema);

import mongoose from "mongoose";

// Message Sub-Schema
const privateMessageSchema = new mongoose.Schema({
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
  sentAt: {
    type: Date,
    default: Date.now,
  },
  seenBy: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
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
  replyTo: {
    _id: { type: mongoose.Schema.Types.ObjectId }, // original message ID
    content: { type: String },

    sender: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      username: String,
      profilePic: String,
    },
  },
  deletedFor: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
});

// Private Chat Schema
const privateChatRoomSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    deletedFor: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // 👈 New field
    ],
    messages: [privateMessageSchema],
    lastMessageAt: { type: Date },
  },
  { timestamps: true }
);

//  update `lastMessageAt`
privateChatRoomSchema.pre("save", function (next) {
  if (this.messages.length > 0) {
    this.lastMessageAt = this.messages[this.messages.length - 1].sentAt;
  }
  next();
});

// Prevent duplicate private chats
privateChatRoomSchema.index({ participants: 1 }, { unique: false });

export const PrivateChatRoom = mongoose.model(
  "PrivateChatRoom",
  privateChatRoomSchema
);

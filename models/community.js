import mongoose from "mongoose";

const communitySchema = new mongoose.Schema(
  {
    communityName: {
      type: String, // "r/javascript"
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: true, // "javascript developer"
      trime: true,
    },
    color: { name: String, primary: String, secondary: String },
    icon: String,
    description: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    pendingRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    rules: [
      {
        text: {
          type: String,
          required: true,
        },
      },
    ],
    createdAt: { type: Date, default: Date.now() },
    bannerImage: {
      type: String,
    },
    profileImage: {
      type: String,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    category: [{ type: String }],
    ageRestricted: { type: Boolean, default: false },
    tags: [{ type: String }],
    posts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CommunityPost",
      },
    ],
  },
  { timestamps: true }
);

export const Community = mongoose.model("Community", communitySchema);

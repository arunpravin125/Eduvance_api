import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      minlen: 6,
    },
    profilePic: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    joinedCommunities: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Community" },
    ],
    recentViewCommunities: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Community" },
    ],
    followRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    reposts: [{ type: mongoose.Schema.Types.ObjectId, ref: "CommunityPost" }],
    SavePosts: [{ type: mongoose.Schema.Types.ObjectId, ref: "CommunityPost" }],
    CommuniyPostsHide: [
      { type: mongoose.Schema.Types.ObjectId, ref: "CommunityPost" },
    ],
    CommuniyHide: [
      { type: mongoose.Schema.Types.ObjectId, ref: "CommunityPost" },
    ],
    postLiked: [{ type: mongoose.Schema.Types.ObjectId, ref: "CommunityPost" }],
    postDisliked: [
      { type: mongoose.Schema.Types.ObjectId, ref: "CommunityPost" },
    ],
  },
  {
    timestamps: true,
  }
);
export const User = mongoose.model("User", userSchema);

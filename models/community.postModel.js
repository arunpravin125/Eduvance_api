import mongoose from "mongoose";

const pollSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [
    {
      text: { type: String, required: true },
      votes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    },
  ],
  expiresAt: Date,
});

const communityPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String }, // optional text/markdown
    type: {
      type: String,
      enum: ["text", "image", "video", "audio", "link", "poll", "repost"],
      default: "text",
    },
    bannerImage: String, // optional hero image

    images: [String], // array of Cloudinary URLs
    videos: [String],
    audios: [String],
    link: String, // for 'link' type post

    poll: pollSchema, // for poll type post

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
    },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    reposts: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // likes on comment

        replies: [
          {
            _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            text: { type: String, required: true },
            createdAt: { type: Date, default: Date.now },
            likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
          },
        ],
      },
    ],
    repost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommunityPost", // Reference to original post
      default: null,
    },
    repostComment: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export const CommunityPost = mongoose.model(
  "CommunityPost",
  communityPostSchema
);

import express from "express";
import { Community } from "../models/community.js";

import { protectRoutes } from "../middleware/protectRoute.js";
import { CommunityPost } from "../models/community.postModel.js";
import { User } from "../models/user.model.js";

export const postRoutes = express.Router();

// getCombined posts
postRoutes.get("/combinedPosts", protectRoutes, async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // 1. Get all public communities and users
    const publicCommunities = await Community.find({ isPrivate: false }).select(
      "_id"
    );
    const publicUsers = await User.find({ isPrivate: false }).select("_id");
    const publicCommunityIds = publicCommunities.map((c) => c._id.toString());
    const publicUserIds = publicUsers.map((u) => u._id.toString());

    // 2. Get current user's following
    const currentUser = await User.findById(currentUserId).select("following");
    const followingIds = currentUser.following.map((id) => id.toString());

    // 3. Only show posts from followed users who are also public
    const visibleFollowedUserIds = followingIds.filter((id) =>
      publicUserIds.includes(id)
    );

    // 4. Get posts from public communities by those followed & public users
    const posts = await CommunityPost.find({
      community: { $in: publicCommunityIds },
      author: { $in: visibleFollowedUserIds },
    })
      .populate("author", "username fullName profilePic")
      .populate("community", "communityName profileImage title")

      .sort({ createdAt: -1 });

    res.status(200).json(posts);
  } catch (err) {
    console.error("Error fetching combined posts:", err);
    res.status(500).json({ error: "Failed to fetch combined posts" });
  }
});

// Get feed posts: public communities + public users only
postRoutes.get("/", async (req, res) => {
  try {
    // Step 1: Fetch all public community and user IDs in parallel
    const [publicCommunities, publicUsers] = await Promise.all([
      Community.find({ isPrivate: false }).select("_id"),
      User.find({ isPrivate: false }).select("_id"),
    ]);

    const publicCommunityIds = publicCommunities.map((c) => c._id.toString());
    const publicUserIds = publicUsers.map((u) => u._id.toString());

    // Step 2: Fetch posts
    const posts = await CommunityPost.find({
      author: { $in: publicUserIds },
      $or: [
        { community: { $in: publicCommunityIds } }, // posts in public communities
        { community: null }, // or posts not in any community
      ],
    })
      .populate("author", "username fullName profilePic ")
      .populate("community", "communityName profileImage")
      .sort({ createdAt: -1 });

    res.status(200).json(posts);
  } catch (err) {
    console.error("Error fetching posts:", err);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// if community private false,user if private false ,me follow that user only will see the posts
postRoutes.get("/getFollowingPosts", protectRoutes, async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // 1. Get current user's following list
    const currentUser = await User.findById(currentUserId).select("following");
    const followingUserIds = currentUser.following;

    // 2. Fetch posts where the author is in following list and has a community
    const posts = await CommunityPost.find({
      author: { $in: followingUserIds },
      community: { $exists: true, $ne: null }, // Ensure it's a community post
    })
      .populate("author", "username fullName profilePic")
      .populate("community", "name profileImage")
      .sort({ createdAt: -1 });

    res.status(200).json(posts);
  } catch (err) {
    console.error("Error fetching posts:", err);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// getCurrent User community posts
postRoutes.get(
  "/currentUserCommunityPosts",
  protectRoutes,
  async (req, res) => {
    try {
      const communities = await Community.find({
        members: { $in: [req.user._id] },
      }).populate({
        path: "posts",
        populate: {
          path: "author",
          select: "username fullName profilePic",
        },
      });

      // Flatten and collect all posts from the user's communities
      const allPosts = communities.flatMap((community) =>
        community.posts.map((post) => ({
          ...post.toObject(),
          communityId: community._id,
          communityName: community.communityName,
          communityTitle: community.title,
        }))
      );

      res.json(allPosts);
    } catch (error) {
      console.log("error in currentUserCommunityPosts", error);
      res.status(400).json({ message: "error in currentUserCommunityPosts" });
    }
  }
);

async function getPublicCommunityIds() {
  const communities = await Community.find({ isPrivate: true }, "_id");
  return communities.map((c) => c._id);
}

// fetch feed
postRoutes.get("/feed", protectRoutes, async (req, res) => {
  try {
    const userId = req.user._id;

    // Get followed user IDs
    const user = await User.findById(userId).populate("following");
    const followedUserIds = user.following.map((u) => u._id);

    // Get community IDs where user is a member
    const memberCommunityIds = await Community.find(
      { members: userId },
      "_id"
    ).then((communities) => communities.map((c) => c._id));

    // Get all public community IDs
    const publicCommunityIds = await getPublicCommunityIds();

    // Combine allowed community IDs (public + private where user is a member)
    const allowedCommunityIds = [
      ...new Set([...publicCommunityIds, ...memberCommunityIds]),
    ];

    // Fetch posts
    const feedPosts = await CommunityPost.find({
      author: { $in: followedUserIds },
      community: { $in: allowedCommunityIds },
    })
      .sort({ createdAt: -1 })
      .populate("author", "username fullName profilePic")
      .populate("community", "communityName isPrivate profileImage")
      .populate({
        path: "repost",
        populate: { path: "author", select: "username fullName profilePic" },
      });
    const updatedPosts = feedPosts.filter(
      (feed) => feed?.community?.isPrivate !== true
    );
    res.json(updatedPosts);
  } catch (error) {
    console.error("Feed error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

//

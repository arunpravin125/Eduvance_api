import express from "express";
import { protectRoutes } from "../middleware/protectRoute.js";
import { User } from "../models/user.model.js";
import { Notification } from "../models/notification.model.js";
import { Community } from "../models/community.js";
import { CommunityPost } from "../models/community.postModel.js";

export const userRoutes = express.Router();

// get currentUser
userRoutes.get("/", protectRoutes, async (req, res) => {
  try {
    const user = req.user;

    const currentUser = await User.findById(user._id).populate([
      { path: "following", select: "username profilePic" },
      { path: "followers", select: "username profilePic" },
    ]);

    res.status(200).json({ me: currentUser });
  } catch (error) {
    console.log("error in getUser", error);
    res.status(400).json({ message: "error in getUser" });
  }
});
// get other User
userRoutes.get("/otherUser/:id", protectRoutes, async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId).populate([
      { path: "following", select: "username profilePic" },
      { path: "followers", select: "username profilePic" },
    ]);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    console.log("error in getUser", error);
    res.status(400).json({ message: "error in getUser" });
  }
});

// update profile
userRoutes.put("/updateProfile", protectRoutes, async (req, res) => {
  const userId = req.user._id;

  try {
    const { fullName, username, profilePic, bio, email, isPrivate } = req.body;

    const data = [];
    let user = await User.findById(userId);

    if (!user) {
      return res.status(400).json({ message: "Unauthorized user" });
    }

    if (user.fullName !== fullName) data.push("fullName");
    if (user.username !== username) data.push("username");
    if (user.bio !== bio) data.push("bio");
    if (user.email !== email) data.push("email");
    if (typeof isPrivate === "boolean" && user.isPrivate !== isPrivate) {
      user.isPrivate = isPrivate;
      data.push("privacy");
    }

    user.fullName = fullName || user.fullName;
    user.username = username || user.username;
    user.profilePic = profilePic || user.profilePic;
    user.bio = bio || user.bio;
    user.email = email || user.email;
    user.isPrivate = isPrivate || user.isPrivate;

    await user.save();

    res.status(201).json({
      message: `Profile ${data.join(", ")} updated`,
      updatedProfile: user,
    });
  } catch (error) {
    console.log("error in updateProfile", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// follow user
userRoutes.post("/follow/:targetUserId", protectRoutes, async (req, res) => {
  const targetUserId = req.params.targetUserId;
  const currentUserId = req.user._id;

  if (targetUserId === currentUserId.toString()) {
    return res.status(400).json({ error: "You cannot follow yourself." });
  }

  const targetUser = await User.findById(targetUserId);
  const currentUser = await User.findById(currentUserId);

  if (!targetUser || !currentUser) {
    return res.status(404).json({ error: "User not found" });
  }

  const alreadyRequested = targetUser.followRequests.includes(currentUserId);
  const alreadyFollowing = targetUser.followers.includes(currentUserId);

  if (alreadyFollowing) {
    targetUser.followers.pull(currentUserId);
    currentUser.following.pull(targetUserId);
    await targetUser.save();
    await currentUser.save();
    return res.status(200).json({ message: "unfollowed" });
  }
  if (alreadyRequested || alreadyFollowing) {
    return res.status(400).json({ error: "Already following or requested" });
  }

  if (targetUser.isPrivate) {
    // Save follow request
    targetUser.followRequests.push(currentUserId);
    await targetUser.save();

    // ➕ Create a notification
    await Notification.create({
      fromUser: currentUserId,
      toUser: targetUserId,
      type: "follow_request",
      message: `${currentUser.username} has requested to follow you.`,
    });

    return res
      .status(200)
      .json({ message: "Follow request sent with notification" });
  } else {
    // Direct follow
    targetUser.followers.push(currentUserId);
    currentUser.following.push(targetUserId);

    await targetUser.save();
    await currentUser.save();

    return res.status(200).json({ message: "Now following", user: req.user });
  }
});

userRoutes.post(
  "/follow/accept/:requesterId",
  protectRoutes,
  async (req, res) => {
    const requesterId = req.params.requesterId;
    const currentUserId = req.user._id;

    const currentUser = await User.findById(currentUserId);
    const requester = await User.findById(requesterId);

    if (!requester || !currentUser)
      return res.status(404).json({ error: "User not found" });

    const index = currentUser.followRequests.indexOf(requesterId);
    if (index === -1) {
      return res.status(400).json({ error: "No such follow request" });
    }

    // Accept request
    currentUser.followRequests.splice(index, 1);
    currentUser.followers.push(requesterId);
    requester.following.push(currentUserId);

    await currentUser.save();
    await requester.save();

    res.status(200).json({ message: "Follow request accepted" });
  }
);

// follow rejects
userRoutes.post(
  "/follow/reject/:requesterId",
  protectRoutes,
  async (req, res) => {
    const requesterId = req.params.requesterId;
    const currentUserId = req.user._id;

    const currentUser = await User.findById(currentUserId);
    if (!currentUser) return res.status(404).json({ error: "User not found" });

    currentUser.followRequests = currentUser.followRequests.filter(
      (id) => id.toString() !== requesterId
    );

    await currentUser.save();
    res.status(200).json({ message: "Follow request rejected" });
  }
);

// get follow requests
userRoutes.get("/follow/requests", protectRoutes, async (req, res) => {
  const currentUser = await User.findById(req.user._id).populate(
    "followRequests",
    "username profilePic"
  );
  res.status(200).json({ requests: currentUser.followRequests });
});

// suggestCommunity
userRoutes.get("/suggested-communities", protectRoutes, async (req, res) => {
  try {
    const userId = req.user._id;

    // Find public communities where user is not a member or in pendingRequests
    const suggestedCommunities = await Community.find({
      members: { $ne: userId },
      pendingRequests: { $ne: userId },
    })
      .select(
        "communityName title description profileImage isPrivate tags posts"
      )
      .limit(10)
      .sort({ createdAt: -1 }); // optional: newest communities first

    res.status(200).json(suggestedCommunities);
  } catch (error) {
    console.error("Error fetching suggested communities:", error);
    res.status(500).json({ error: "Failed to fetch suggested communities" });
  }
});

// get myRepost
userRoutes.post("/myReposts", protectRoutes, async (req, res) => {
  try {
    const { userId } = req.body;

    // Populate reposted posts from the user's reposts array
    const user = await User.findById(userId).populate({
      path: "reposts",
      populate: [
        { path: "author", select: "username profilePic" },
        { path: "community", select: "communityName" },
        {
          path: "repost",
          populate: { path: "author", select: "username profilePic" },
        },
      ],
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    res.status(200).json({ reposts: user.reposts });
  } catch (error) {
    console.error("Get my reposts error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// getSaved posts
userRoutes.get("/posts/saved", protectRoutes, async (req, res) => {
  const { userId } = req.body;
  try {
    const user = await User.findById(userId).populate({
      path: "SavePosts",
      populate: [
        { path: "author", select: "username profilePic" },
        { path: "community", select: "communityName profileImage" },
      ],
    });

    res.status(200).json(user.SavePosts);
  } catch (error) {
    console.error("Error fetching saved posts:", error);
    res.status(500).json({ error: error.message });
  }
});
userRoutes.post("/posts/saved", protectRoutes, async (req, res) => {
  const { userId } = req.body;
  try {
    const user = await User.findById(userId).populate({
      path: "SavePosts",
      populate: [
        { path: "author", select: "username profilePic" },
        { path: "community", select: "communityName profileImage" },
      ],
    });

    res.status(200).json(user.SavePosts);
  } catch (error) {
    console.error("Error fetching saved posts:", error);
    res.status(500).json({ error: error.message });
  }
});

// get likedPosts
userRoutes.post(
  "/getLikedPosts",
  protectRoutes,

  async (req, res) => {
    const { userId } = req.body;
    try {
      const user = await User.findById(userId).populate({
        path: "postLiked",
        populate: [
          { path: "author", select: "username fullName profilePic" },
          { path: "community", select: "communityName profileImage" },
        ],
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json(user.postLiked || []);
    } catch (error) {
      console.error("Error in getLikedPosts:", error);
      res.status(500).json({ message: "Server error in getLikedPosts" });
    }
  }
);

// get userSaved posts

userRoutes.post("/posts/getSavedPosts", protectRoutes, async (req, res) => {
  const { userId } = req.body;
  try {
    const user = await User.findById(userId).populate({
      path: "SavePosts",
      populate: [
        { path: "author", select: "username fullName profilePic" },
        { path: "community", select: "communityName isPrivate profileImage" },
      ],
    });

    if (!user) {
      return res.status(400).json({ message: "User is not authenticated" });
    }

    res.status(200).json(user.SavePosts);
  } catch (error) {
    console.error("Error in getSavedPosts:", error);
    res.status(500).json({ message: "Server error in getSavedPosts" });
  }
});

// Get all posts created by the logged-in user
userRoutes.get("/user/posts", protectRoutes, async (req, res) => {
  try {
    const getUserPostedPosts = await CommunityPost.find({
      author: req.user._id,
    })
      .sort({ createdAt: -1 })
      .populate("community", "communityName profileImage icon")
      .populate("author", "username fullName profilePic"); // optional: most recent first

    res.status(200).json(getUserPostedPosts);
  } catch (error) {
    console.error("error in getUserPosts", error);
    res.status(500).json({ message: "Server error while fetching user posts" });
  }
});
// Get all posts created by the logged-in user
userRoutes.post("/otherUser/posts", protectRoutes, async (req, res) => {
  const { userId } = req.body;
  try {
    const getUserPostedPosts = await CommunityPost.find({
      author: userId,
    })
      .sort({ createdAt: -1 })
      .populate("community", "communityName profileImage icon")
      .populate("author", "username fullName profilePic"); // optional: most recent first

    res.status(200).json(getUserPostedPosts);
  } catch (error) {
    console.error("error in getUserPosts", error);
    res.status(500).json({ message: "Server error while fetching user posts" });
  }
});

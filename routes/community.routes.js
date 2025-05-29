import express from "express";
import { protectRoutes } from "../middleware/protectRoute.js";
import { Community } from "../models/community.js";
import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.model.js";

export const communityRoute = express.Router();

// todo bannerImage,community
communityRoute.post("/", protectRoutes, async (req, res) => {
  try {
    const {
      communityName,
      title,
      description,
      tags,
      isPrivate,
      colorTheme,
      moderators,
      ageRestricted,
      category,
      rules,
      icon,
    } = req.body;

    // Check if community exists
    const existing = await Community.findOne({
      communityName: communityName.toLowerCase(),
    });
    if (existing)
      return res.status(400).json({ error: "Community name already exists" });

    const community = new Community({
      communityName: communityName.toLowerCase(),
      title,
      description,
      tags: tags || [],
      isPrivate: !!isPrivate,
      icon: icon ? icon : "",
      category,
      AgeRetricted: ageRestricted,
      moderators,
      color: {
        name: colorTheme?.name || "",
        primary: colorTheme.primary || "",
        secondary: colorTheme.secondary || "",
      },
      rules,
      createdBy: req.user._id,
      members: [req.user._id],
    });

    await community.save();
    res.status(201).json(community);
  } catch (error) {
    console.error("Create community error:", error);
    res.status(500).json({ error: error.message });
  }
});

// get Community
communityRoute.get("/:id", protectRoutes, async (req, res) => {
  try {
    const community = await Community.findById(req.params.id)
      .populate("createdBy", "username fullName profilePic")
      .populate({
        path: "posts",
        populate: {
          path: "author",
          select: "username profilePic",
        },
      })
      .populate("members", "username profilePic");

    if (!community)
      return res.status(404).json({ error: "Community not found" });
    res.status(200).json(community);
  } catch (error) {
    console.error("Get community error:", error);
    res.status(500).json({ error: error.message });
  }
});
// todo banner image ,Edit community
communityRoute.put("/:id", protectRoutes, async (req, res) => {
  try {
    const {
      title,
      description,
      tags,
      isPrivate,
      bannerImage,
      profileImage,
      colorTheme,
      moderators,
      ageRestricted,
      category,
    } = req.body;

    const community = await Community.findById(req.params.id);
    if (!community)
      return res.status(404).json({ error: "Community not found" });

    if (community.createdBy.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ error: "Not authorized to update this community" });
    }

    if (title) community.title = title;
    if (description) community.description = description;
    if (tags) community.tags = tags;

    if (
      typeof isPrivate === "boolean" ||
      isPrivate === "true" ||
      isPrivate === "false"
    ) {
      community.isPrivate = isPrivate === true || isPrivate === "true";
    }

    if (bannerImage) community.bannerImage = bannerImage;
    if (profileImage) community.profileImage = profileImage;

    if (colorTheme) {
      community.color = {
        name: colorTheme?.name || "",
        primary: colorTheme?.primary || "",
        secondary: colorTheme?.secondary || "",
      };
    }

    if (moderators) community.moderators = moderators;
    if (typeof ageRestricted === "boolean") {
      community.ageRestricted = ageRestricted;
    } else if (ageRestricted === "true" || ageRestricted === "false") {
      community.ageRestricted = ageRestricted === "true";
    }

    if (category) community.category = category;

    await community.save();
    res.status(200).json(community);
  } catch (error) {
    console.error("Update community error:", error);
    res.status(500).json({ error: error.message });
  }
});

// delete community
communityRoute.delete("/:id", protectRoutes, async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community)
      return res.status(404).json({ error: "Community not found" });

    // Optional: Check permission here (e.g. only creator can delete)
    if (community.createdBy.toString() !== req.user._id.toString()) {
      return res.status(400).json({ message: "you not allowed to delete" });
    }
    await Community.deleteOne({ _id: req.params.id });
    res.status(200).json({ message: "Community deleted successfully" });
  } catch (error) {
    console.error("Delete community error:", error);
    res.status(500).json({ error: error.message });
  }
});

communityRoute.post("/:id/manageMember", protectRoutes, async (req, res) => {
  try {
    const { userId, action } = req.body;
    const communityId = req.params.id;

    if (!userId || !action) {
      return res.status(400).json({ error: "User ID and action are required" });
    }

    const [community, user] = await Promise.all([
      Community.findById(communityId).populate(
        "members",
        "username profilePic"
      ),
      User.findById(userId),
    ]);

    if (!community)
      return res.status(404).json({ error: "Community not found" });
    if (!user) return res.status(404).json({ error: "User not found" });

    const isMember = community.members.some(
      (member) => member._id.toString() === userId.toString()
    );

    const hasRequested = community.pendingRequests.some(
      (reqId) => reqId.toString() === userId.toString()
    );

    // REMOVE MEMBER
    if (action === "remove") {
      if (!isMember) {
        return res.status(400).json({ message: "User is not a member" });
      }

      community.members = community.members.filter(
        (member) => member._id.toString() !== userId.toString()
      );
      await community.save();

      return res.status(200).json({ message: "Member removed", community });
    }

    // ADD MEMBER
    if (action === "add") {
      if (isMember) {
        return res.status(400).json({ message: "User already a member" });
      }

      if (hasRequested) {
        return res.status(400).json({ message: "Join request already sent" });
      }

      if (community.isPrivate) {
        community.pendingRequests.push(userId);
        await community.save();

        await Notification.create({
          toUser: community.createdBy,
          fromUser: userId,
          type: "join_Request",
          message: `${user.username} has requested to join ${community.communityName}`,
          community: community._id,
        });

        return res
          .status(200)
          .json({ message: "Join request sent to community admin" });
      }

      // Public community
      community.members.push(userId);
      await community.save();

      return res
        .status(200)
        .json({ message: "User added to community", community });
    }

    // INVALID ACTION
    res
      .status(400)
      .json({ error: "Invalid action. Must be 'add' or 'remove'" });
  } catch (error) {
    console.error("Manage member error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// if private community person are waiting to join
communityRoute.get("/:id/pendingRequests", protectRoutes, async (req, res) => {
  try {
    const community = await Community.findById(req.params.id).populate(
      "pendingRequests",
      "username email profileImage"
    );

    if (!community) {
      return res.status(404).json({ error: "Community not found" });
    }

    // SAFELY check if the user is the creator
    if (!community.createdBy.equals(req.user._id)) {
      return res
        .status(403)
        .json({ error: "Only the creator can view pending requests" });
    }

    res.status(200).json({ pendingRequests: community.pendingRequests });
  } catch (error) {
    console.error("Error getting pending requests:", error);
    res.status(500).json({ error: error.message });
  }
});

// approve Member if private,only community createdBy user can add that requested member
communityRoute.post("/:id/approveMember", protectRoutes, async (req, res) => {
  try {
    const { userId } = req.body;
    const community = await Community.findById(req.params.id);

    if (!community)
      return res.status(404).json({ error: "Community not found" });

    // Only creator can approve
    if (community.createdBy.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ error: "Only the creator can approve members" });
    }

    // Check if in pending
    if (!community.pendingRequests.includes(userId)) {
      return res
        .status(400)
        .json({ message: "User has not requested to join" });
    }

    // Move from pendingRequests to members
    community.pendingRequests.pull(userId);
    community.members.push(userId);
    await community.save();

    res.status(200).json({ message: "User added to community", community });
  } catch (error) {
    console.error("Approve member error:", error);
    res.status(500).json({ error: error.message });
  }
});

// // if community is private,some one cannot join immediately so first get that pendingRequests and add members list
// communityRoute.post("/:id/removeMember", protectRoutes, async (req, res) => {
//   try {
//     const { userId } = req.body;
//     const community = await Community.findById(req.params.id);
//     if (!community)
//       return res.status(404).json({ error: "Community not found" });
//     if (!community.members.includes(userId)) {
//       return res.status(400).json({ message: "user not there" });
//     }
//     community.members = community.members.filter(
//       (memberId) => memberId.toString() !== userId.toString()
//     );

//     await community.save();
//     res.status(200).json({ message: "Member removed", community });
//   } catch (error) {
//     console.error("Remove member error:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// get all community
communityRoute.get("/", protectRoutes, async (req, res) => {
  try {
    // Get hidden community IDs for current user
    const user = await User.findById(req.user._id).select("CommuniyHide");
    const hiddenCommunityIds = user.CommuniyHide;

    // Get communities not hidden by user
    const communities = await Community.find({
      _id: { $nin: hiddenCommunityIds },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("members", "username profilePic");

    res.status(200).json(communities);
  } catch (error) {
    console.error("Get all communities error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Top communities route first
communityRoute.get("/TopCommunities", protectRoutes, async (req, res) => {
  try {
    const topCommunities = await Community.aggregate([
      // Stage 1: Lookup actual posts to get accurate count
      {
        $lookup: {
          from: "communityposts", // Must match your Post collection name
          localField: "posts",
          foreignField: "_id",
          as: "actualPosts",
        },
      },
      // Stage 2: Add counts and calculate popularity
      {
        $addFields: {
          postCount: { $size: "$actualPosts" },
          memberCount: { $size: "$members" },
          // Weighted score (posts 60%, members 40%)
          popularityScore: {
            $add: [
              { $multiply: ["$memberCount", 0.4] },
              { $multiply: ["$postCount", 0.6] },
            ],
          },
        },
      },
      // Stage 3: Sort by popularity
      {
        $sort: {
          popularityScore: -1,
          memberCount: -1,
          postCount: -1,
        },
      },
      // Stage 4: Limit results
      { $limit: 10 },
      // Stage 5: Shape the output
      {
        $project: {
          communityName: 1,
          title: 1,
          description: 1,
          memberCount: 1,
          postCount: 1,
          popularityScore: 1,
          bannerImage: 1,
          profileImage: 1,
        },
      },
    ]);

    // Populate creator details if needed
    const populatedCommunities = await Community.populate(topCommunities, [
      {
        path: "createdBy",
        select: "username profilePic",
      },
    ]);

    res.status(200).json(populatedCommunities);
  } catch (error) {
    console.error("Top communities error:", error);
    res.status(500).json({
      error: "Failed to fetch communities",
      details: error.message,
    });
  }
});

// community Hide
communityRoute.put(
  "/communityHide/:communityId",
  protectRoutes,
  async (req, res) => {
    try {
      const { communityId } = req.params;
      const community = await Community.findById(communityId);
      const user = await User.findById(req.user._id);
      if (!community) {
        return res.status(404).json({ message: "community not found" });
      }
      const checkCommunityHide = user.CommuniyHide.includes(community._id);
      if (checkCommunityHide) {
        user.CommuniyHide.pull(community._id);
      } else {
        user.CommuniyHide.push(community._id);
      }

      await user.save();
      const updateduser = await User.findById(req.user._id).populate(
        "CommuniyPostsHide",
        "name profileImage"
      );

      res
        .status(200)
        .json({ message: checkCommunityHide ? "hide" : "view", updateduser });
    } catch (error) {
      console.log("error in communityHide", error);
      res.status(400).json({ message: "error in communityHide" });
    }
  }
);

// get User joined community
communityRoute.get("/join/joinedCommunity", protectRoutes, async (req, res) => {
  try {
    const userId = req.user._id;

    const joinedCommunities = await Community.find({
      members: userId, // OR members: { $in: [userId] }
    });

    res.status(200).json(joinedCommunities);
  } catch (error) {
    console.error("Error fetching joined communities:", error);
    res.status(500).json({ message: error.message });
  }
});

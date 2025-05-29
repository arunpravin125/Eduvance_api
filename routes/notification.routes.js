import express from "express";
import { protectRoutes } from "../middleware/protectRoute.js";
import { Notification } from "../models/notification.model.js";
import { Community } from "../models/community.js";
import { User } from "../models/user.model.js";

export const notificationRoutes = express.Router();

notificationRoutes.get("/", protectRoutes, async (req, res) => {
  try {
    const getNotification = await Notification.find({ toUser: req.user._id });

    if (getNotification.length < 0) {
      return res.status(400).json({ message: "no notification found" });
    }

    res.status(200).json(getNotification);
  } catch (error) {
    console.log("error in getNotification", error);
    res.status(400).json({ message: "error in getNotification" });
  }
});

// if anyrequest comes in notification for joining community

notificationRoutes.post("/seeRequests", protectRoutes, async (req, res) => {
  try {
    const requestedNotifications = await Notification.find({
      toUser: req.user._id,
      type: "join_Request", // filter directly in DB
    }).populate({ path: "community", select: "createdBy" });

    // Only return notifications where the user is the creator of the community
    const ownedRequests = requestedNotifications.filter((notification) => {
      return (
        notification.community &&
        notification.community.createdBy.toString() === req.user._id.toString()
      );
    });

    res.status(200).json({
      message: "Join requests for your communities",
      requests: ownedRequests,
    });
  } catch (error) {
    console.error("error in accept_requests", error);
    res.status(400).json({ message: "error in accept_requests" });
  }
});

// join community member
notificationRoutes.post(
  "/RequestToAdd/:id",
  protectRoutes,
  async (req, res) => {
    try {
      const requestedUserId = req.params.id; // user who sent the join request
      const currentUserId = req.user._id; // the current user (must be community creator)

      // Find the notification related to this request
      const notification = await Notification.findOne({
        fromUser: requestedUserId,
        toUser: currentUserId,
        type: "join_Request",
      }).populate({
        path: "community",
        select: "createdBy pendingRequests members",
      });

      if (!notification) {
        return res.status(404).json({ message: "Request not found" });
      }

      const community = await Community.findById(notification.community._id);
      if (!community) {
        return res.status(400).json({ message: "Community not found" });
      }
      // Ensure current user is the creator of the community
      if (community.createdBy.toString() !== currentUserId.toString()) {
        return res
          .status(403)
          .json({ message: "Only the community creator can approve requests" });
      }

      // Add user to members if not already
      if (!community.members.includes(requestedUserId)) {
        community.members.push(requestedUserId);
      }

      // Remove user from pendingRequests
      community.pendingRequests = community.pendingRequests.filter(
        (userId) => userId.toString() !== requestedUserId
      );

      await community.save();

      // isRead:true the notification
      await Notification.updateOne(
        { _id: notification._id },
        { $set: { isRead: true } }
      );

      res.status(200).json({ message: "User added to community" });
    } catch (error) {
      console.error("Error in acceptRequestToAdd:", error);
      res.status(500).json({ message: "Error in acceptRequestToAdd" });
    }
  }
);

// get follow Request
notificationRoutes.get("/followRequests", protectRoutes, async (req, res) => {
  try {
    const notifications = await Notification.find({
      toUser: req.user._id,
      type: "follow_request",
    })
      .populate("fromUser", "username profilePic")
      .sort({ createdAt: -1 });

    res.status(200).json(notifications);
  } catch (err) {
    console.error("Error fetching follow requests:", err);
    res.status(500).json({ error: "Failed to fetch follow requests" });
  }
});

// confirm follow request

notificationRoutes.post(
  "/confirm-follow/:notificationId",
  protectRoutes,
  async (req, res) => {
    try {
      const { notificationId } = req.params;

      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        return res.status(400).json({ error: "Invalid notification ID" });
      }

      // Find and validate notification
      const notification = await Notification.findById(notificationId);
      if (!notification || notification.type !== "follow_request") {
        return res.status(404).json({ error: "Follow request not found" });
      }

      const targetUserId = req.user._id;
      const requesterId = notification.fromUser;

      if (!requesterId) {
        return res
          .status(400)
          .json({ error: "Invalid requester in notification" });
      }

      const targetUser = await User.findById(targetUserId);
      const requester = await User.findById(requesterId);

      if (!targetUser || !requester) {
        return res.status(404).json({ error: "User not found" });
      }

      // Add follower/following only if not already present
      if (!targetUser.followers.includes(requesterId)) {
        targetUser.followers.push(requesterId);
      }

      if (!requester.following.includes(targetUserId)) {
        requester.following.push(targetUserId);
      }

      // Remove follow request from target user
      if (targetUser.followRequests?.includes(requesterId)) {
        targetUser.followRequests.pull(requesterId);
      }

      await targetUser.save();
      await requester.save();

      // Optionally: Delete or mark notification as read
      // await Notification.findByIdAndDelete(notificationId);
      const getUpdateduser = await User.findByIdAndUpdate(req.user._id, {
        $pull: { followRequests: requesterId },
      });
      res
        .status(200)
        .json({ message: "Follow request accepted", user: getUpdateduser });
    } catch (err) {
      console.error("Error confirming follow request:", err);
      res.status(500).json({ error: "Failed to confirm follow request" });
    }
  }
);

// get Reposted
notificationRoutes.get("/reposts", protectRoutes, async (req, res) => {
  try {
    const userId = req.user._id;

    const repostNotifications = await Notification.find({
      toUser: userId,
      type: "repost",
    })
      .sort({ createdAt: -1 })
      .populate("fromUser", "username profilePic")
      .populate("post", "title content")
      .populate("community", "communityName");

    res.status(200).json({ notifications: repostNotifications });
  } catch (error) {
    console.error("Error fetching repost notifications:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

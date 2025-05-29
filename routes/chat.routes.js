import express from "express";
import { protectRoutes } from "../middleware/protectRoute.js";
import { Community } from "../models/community.js";
import { ChatRoom } from "../models/chatRoom.model.js";

export const chatCommunityGroup = express.Router();

// create group in a community
chatCommunityGroup.post("/:communityId", protectRoutes, async (req, res) => {
  try {
    const { communityId } = req.params;
    const { name, description, avatar } = req.body;

    // 1. Find the community
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ error: "Community not found" });
    }

    // 2. Only creator can create chat group
    if (community.createdBy.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ error: "Only the creator can create a group chat" });
    }

    // 3. Get members
    const members = community.members;
    if (members.length === 0) {
      return res.status(400).json({ error: "No members in community" });
    }

    // 4. Create group chat
    const newGroupChat = new ChatRoom({
      name: name || `${community.title} Group Chat`,
      description,
      avatar,
      members,
      admins: [req.user._id],
      createdBy: req.user._id,
      community: communityId,
    });

    await newGroupChat.save();

    res.status(201).json({
      message: "Community group chat created",
      chatRoom: newGroupChat,
    });
  } catch (error) {
    console.log("error in createCommunityGroupChat", error);
    res.status(500).json({ error: error.message });
  }
});

// send message
chatCommunityGroup.post(
  "/message/:chatRoomId",
  protectRoutes,
  async (req, res) => {
    try {
      const { chatRoomId } = req.params;
      const { content, media = [] } = req.body;
      if (!content) {
        return res.status(400).json({ message: "" });
      }
      const chatRoom = await ChatRoom.findById(chatRoomId);
      if (!chatRoom) {
        return res.status(404).json({ error: "Chat room not found" });
      }

      // Check if sender is part of the chat group
      const isMember = chatRoom.members.includes(req.user._id);
      if (!isMember) {
        return res
          .status(403)
          .json({ error: "Only community members can send messages" });
      }

      // Create message object
      const newMessage = {
        sender: req.user._id,
        content,
        media,
        sentAt: new Date(),
        seen: false,
      };

      // Push message to chat room
      chatRoom.messages.push(newMessage);
      await chatRoom.save();

      res.status(201).json({
        message: "Message sent to group",
        newMessage,
      });

      // socket.io here
    } catch (error) {
      console.error("Error sending message to group:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// reply for particular message

chatCommunityGroup.post(
  "/reply/:chatRoomId/:messageId",
  protectRoutes,
  async (req, res) => {
    try {
      const { chatRoomId, messageId } = req.params;
      const { content, media = [] } = req.body;
      const userId = req.user._id;

      if (!content && media.length === 0) {
        return res
          .status(400)
          .json({ error: "Message content or media is required" });
      }

      const chatRoom = await ChatRoom.findById(chatRoomId).populate({
        path: "messages.sender",
        select: "username profilePic",
      });

      if (!chatRoom) {
        return res.status(404).json({ error: "Chat room not found" });
      }

      const isMember = chatRoom.members.includes(userId);
      if (!isMember) {
        return res
          .status(403)
          .json({ error: "You must be a member to send messages" });
      }

      const originalMessage = chatRoom.messages.id(messageId);
      if (!originalMessage) {
        return res.status(404).json({ error: "Replied message not found" });
      }

      const originalSender = originalMessage.sender;

      const replyMessage = {
        sender: userId,
        content,
        media,
        sentAt: new Date(),
        seen: false,
        replyTo: {
          _id: originalMessage._id,
          content: originalMessage.content,
          sender: {
            _id: originalSender._id,
            username: originalSender.username,
            profilePic: originalSender.profilePic,
          },
        },
      };

      chatRoom.messages.push(replyMessage);
      chatRoom.lastMessageAt = new Date();
      await chatRoom.save();

      res.status(201).json({
        message: "Reply sent successfully",
        replyMessage,
      });

      // Optional: Emit via socket.io
    } catch (error) {
      console.error("Send reply error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// get messages
chatCommunityGroup.get(
  "/:chatRoomId/messages",
  protectRoutes,
  async (req, res) => {
    try {
      const { chatRoomId } = req.params;

      const chatRoom = await ChatRoom.findById(chatRoomId)
        .populate({
          path: "messages.sender",
          select: "username profilePic", // sender details
        })
        .populate({
          path: "messages.seenBy",
          select: "username profilePic", // seen by user info
        });

      if (!chatRoom) {
        return res.status(404).json({ error: "Chat room not found" });
      }

      // Check if user is a member
      const isMember = chatRoom.members.some(
        (memberId) => memberId.toString() === req.user._id.toString()
      );

      if (!isMember) {
        return res
          .status(403)
          .json({ error: "Only community members can view messages" });
      }

      // Filter out messages deleted by current user
      const visibleMessages = chatRoom.messages.filter(
        (msg) =>
          !msg.deletedFor?.some(
            (userId) => userId.toString() === req.user._id.toString()
          )
      );

      res.status(200).json({
        messages: visibleMessages,
      });
    } catch (error) {
      console.error("Error getting group messages:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// get chatroom in a community
chatCommunityGroup.get(
  "/:communityId/rooms",
  protectRoutes,
  async (req, res) => {
    try {
      const rooms = await ChatRoom.find({
        community: req.params.communityId,
      }).populate("members", "username profilePic");

      res.status(200).json({ rooms });
    } catch (error) {
      console.error("Error fetching chat rooms:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// seen by user specific
chatCommunityGroup.post(
  "/seen/:chatRoomId/:messageId",
  protectRoutes,
  async (req, res) => {
    try {
      const { chatRoomId, messageId } = req.params;
      console.log({ chatRoomId, messageId });
      const chatRoom = await ChatRoom.findById(chatRoomId);
      if (!chatRoom) {
        return res.status(404).json({ error: "Chat room not found" });
      }

      // Find the message by its unique _id
      const message = chatRoom.messages.id(messageId);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      const alreadySeen = message.seenBy?.some(
        (userId) => userId.toString() === req.user._id.toString()
      );

      if (!alreadySeen) {
        message.seenBy = message.seenBy || [];
        message.seenBy.push(req.user._id);
        await chatRoom.save();
      }

      res.status(200).json({
        message: "Message marked as seen",
        seenBy: message.seenBy,
      });
    } catch (error) {
      console.error("Error marking message as seen:", error);
      res.status(500).json({ error: error.message });
    }
  }
);
// get who seenBy
chatCommunityGroup.get(
  "/message-seen/:chatRoomId/:messageId",
  protectRoutes,
  async (req, res) => {
    try {
      const { chatRoomId, messageId } = req.params;

      const chatRoom = await ChatRoom.findById(chatRoomId).populate(
        "messages.seenBy",
        "username profilePic"
      ); // populate seenBy

      if (!chatRoom) {
        return res.status(404).json({ error: "Chat room not found" });
      }

      const message = chatRoom.messages.id(messageId);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      res.status(200).json({
        message: "Seen by users",
        seenBy: message.seenBy,
      });
    } catch (error) {
      console.error("Error getting seen users:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// reactions for message
chatCommunityGroup.post(
  "/react/:chatRoomId/:messageId",
  protectRoutes,
  async (req, res) => {
    try {
      const { chatRoomId, messageId } = req.params;
      const { type } = req.body;

      if (!type) {
        return res.status(400).json({ error: "Reaction type is required" });
      }

      const chatRoom = await ChatRoom.findById(chatRoomId);
      if (!chatRoom) {
        return res.status(404).json({ error: "Chat room not found" });
      }

      const message = chatRoom.messages.id(messageId);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      const existingReaction = message.reactions.find(
        (r) => r.user.toString() === req.user._id.toString()
      );

      if (existingReaction) {
        if (existingReaction.type === type) {
          // Toggle off (remove)
          message.reactions = message.reactions.filter(
            (r) => r.user.toString() !== req.user._id.toString()
          );
        } else {
          // Change reaction
          existingReaction.type = type;
        }
      } else {
        // Add new reaction
        message.reactions.push({ user: req.user._id, emoji: type });
      }

      await chatRoom.save();

      res.status(200).json({
        message: "Reaction updated",
        reactions: message.reactions,
      });
    } catch (error) {
      console.error("Error reacting to message:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// get reactions for message
chatCommunityGroup.get(
  "/reactions/:chatRoomId/:messageId",
  protectRoutes,
  async (req, res) => {
    try {
      const { chatRoomId, messageId } = req.params;

      const chatRoom = await ChatRoom.findById(chatRoomId).populate(
        "messages.reactions.user",
        "username profilePic"
      );

      if (!chatRoom) {
        return res.status(404).json({ error: "Chat room not found" });
      }

      const message = chatRoom.messages.id(messageId);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      res.status(200).json({
        message: "Reactions fetched successfully",
        reactions: message.reactions,
      });
    } catch (error) {
      console.error("Error fetching reactions:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// delete message for me
chatCommunityGroup.post(
  "/deleteForMe/:chatRoomId/:messageId",
  protectRoutes,
  async (req, res) => {
    try {
      const { chatRoomId, messageId } = req.params;

      const chatRoom = await ChatRoom.findById(chatRoomId);
      if (!chatRoom) {
        return res.status(404).json({ error: "Chat room not found" });
      }

      const message = chatRoom.messages.id(messageId);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      const alreadyDeleted = message.deletedFor?.some(
        (userId) => userId.toString() === req.user._id.toString()
      );

      if (!alreadyDeleted) {
        message.deletedFor.push(req.user._id);
        await chatRoom.save();
      }

      res.status(200).json({ message: "Message hidden for user." });
    } catch (error) {
      console.error("Delete for me error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

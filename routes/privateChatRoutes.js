import express from "express";
import { protectRoutes } from "../middleware/protectRoute.js";
import { PrivateChatRoom } from "../models/PrivateChatRoom.js";
import { User } from "../models/user.model.js";

export const privateChatRoute = express.Router();

// get participants
privateChatRoute.get("/participant", protectRoutes, async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all chat rooms where user is a participant AND has not soft-deleted the chat
    const chats = await PrivateChatRoom.find({
      participants: userId,
      deletedFor: { $ne: userId }, // 👈 exclude chats deleted for this user
    }).populate({
      path: "participants",
      select: "username profilePic",
    });

    if (!chats || chats.length === 0) {
      return res.status(404).json({ error: "No chats found" });
    }

    // Build a response array: [{ chatRoomId, participant }]
    const response = chats.map((chat) => {
      const otherUser = chat.participants.find(
        (user) => user._id.toString() !== userId.toString()
      );

      return {
        chatRoomId: chat._id,
        participant: otherUser,
      };
    });

    res.status(200).json({ participants: response });
  } catch (err) {
    console.error("Get participants error:", err);
    res.status(500).json({ error: err.message });
  }
});

// send message
privateChatRoute.post("/send/:recipientId", protectRoutes, async (req, res) => {
  try {
    const { content, media = [] } = req.body;
    const { recipientId } = req.params;
    const userId = req.user._id;

    // 1. Find or create the chat room between the two users
    let chat = await PrivateChatRoom.findOne({
      participants: { $all: [userId, recipientId], $size: 2 },
    });

    if (!chat) {
      chat = await PrivateChatRoom.create({
        participants: [userId, recipientId],
        messages: [],
        deletedFor: [],
      });
    }

    const newMessage = {
      sender: userId,
      content,
      media,
    };

    chat.messages.push(newMessage);

    // Restore chat for both sender and recipient if previously deleted
    chat.deletedFor = chat.deletedFor.filter(
      (id) =>
        id.toString() !== userId.toString() &&
        id.toString() !== recipientId.toString()
    );

    await chat.save();

    res.status(200).json({ message: "Message sent", chatRoom: chat });
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ error: err.message });
  }
});

// delete message
privateChatRoute.delete(
  "/delete-message/:chatRoomId/:messageId",
  protectRoutes,
  async (req, res) => {
    const { chatRoomId, messageId } = req.params;
    const userId = req.user._id;

    const chat = await PrivateChatRoom.findById(chatRoomId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    const msg = chat.messages.id(messageId);
    if (!msg) return res.status(404).json({ error: "Message not found" });

    if (!msg.deletedFor.includes(userId)) {
      msg.deletedFor.push(userId);
      await chat.save();
    }

    res.status(200).json({ message: "Message deleted for you" });
  }
);

// delete chat room for me
privateChatRoute.delete(
  "/delete-chat/:chatRoomId",
  protectRoutes,
  async (req, res) => {
    const { chatRoomId } = req.params;
    const userId = req.user._id;

    const chat = await PrivateChatRoom.findById(chatRoomId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    // If already deleted for this user, just return
    if (chat.deletedFor.includes(userId)) {
      return res.status(200).json({ message: "Chat already deleted for you" });
    }

    // Mark the chat as deleted for this user
    chat.deletedFor.push(userId);

    // Mark each message as deleted for this user too
    chat.messages.forEach((msg) => {
      if (!msg.deletedFor.includes(userId)) {
        msg.deletedFor.push(userId);
      }
    });

    await chat.save();

    res.status(200).json({ message: "Chat and messages deleted for you only" });
  }
);

// add reaction in Message
privateChatRoute.post(
  "/react/:chatRoomId/:messageId",
  protectRoutes,
  async (req, res) => {
    const { chatRoomId, messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    const chat = await PrivateChatRoom.findById(chatRoomId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    const msg = chat.messages.id(messageId);
    if (!msg) return res.status(404).json({ error: "Message not found" });

    const existing = msg.reactions.find(
      (r) => r.user.toString() === userId.toString()
    );

    if (existing) {
      if (existing.emoji === emoji) {
        msg.reactions = msg.reactions.filter(
          (r) => r.user.toString() !== userId.toString()
        );
      } else {
        existing.emoji = emoji;
      }
    } else {
      msg.reactions.push({ user: userId, emoji });
    }

    await chat.save();
    res
      .status(200)
      .json({ message: "Reaction updated", reactions: msg.reactions });
  }
);

// getMessage

privateChatRoute.get(
  "/:chatRoomId/messages",
  protectRoutes,
  async (req, res) => {
    const { chatRoomId } = req.params;
    const userId = req.user._id;

    const chat = await PrivateChatRoom.findById(chatRoomId)
      .populate({
        path: "messages.sender",
        select: "username profilePic",
      })
      .populate({
        path: "messages.reactions.user",
        select: "username profilePic",
      });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    if (chat.deletedFor.includes(userId)) {
      return res.status(403).json({ error: "Chat deleted for you" });
    }

    const visibleMessages = chat.messages.filter(
      (msg) => !msg.deletedFor.includes(userId)
    );

    res.status(200).json({ messages: visibleMessages });
  }
);

// reply for message

privateChatRoute.post(
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

      const chatRoom = await PrivateChatRoom.findById(chatRoomId).populate({
        path: "messages.sender",
        select: "username profilePic",
      });

      if (!chatRoom) {
        return res.status(404).json({ error: "Chat room not found" });
      }

      // Ensure the user is a participant
      const isParticipant = chatRoom.participants.some((id) =>
        id.equals(userId)
      );
      if (!isParticipant) {
        return res
          .status(403)
          .json({ error: "You must be a participant to send messages" });
      }

      const originalMessage = chatRoom.messages.id(messageId);
      if (!originalMessage) {
        return res.status(404).json({ error: "Original message not found" });
      }

      const originalSender = originalMessage.sender;

      const replyMessage = {
        sender: userId,
        content,
        media,
        sentAt: new Date(),
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

      // Optional: socket.emit for real-time update
    } catch (error) {
      console.error("Reply error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

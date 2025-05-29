import express from "express";
import { protectRoutes } from "../middleware/protectRoute.js";

import { Community } from "../models/community.js";
import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.model.js";
import { CommunityPost } from "../models/community.postModel.js";

export const communityPostRoutes = express.Router();

// create community posts
communityPostRoutes.post("/", protectRoutes, async (req, res) => {
  try {
    const {
      title,
      content,
      type,
      bannerImage,
      images,
      videos,
      audios,
      link,
      poll,
      communityId,
      postType,
    } = req.body;

    if (!title || !content) {
      return res
        .status(400)
        .json({ message: "Title and content are required" });
    }

    // If it's a community post
    if (postType === "community") {
      const community = await Community.findById(communityId).populate(
        "members"
      );

      if (!community) {
        return res.status(404).json({ error: "Community not found" });
      }

      // If private, ensure the user is a member
      if (community.isPrivate) {
        const isMember = community.members.some(
          (member) => member._id.toString() === req.user._id.toString()
        );

        if (!isMember) {
          return res.status(403).json({
            message: "Only members can post in this private community",
          });
        }
      }

      // Create the post
      const newPost = new CommunityPost({
        title,
        content,
        type,
        bannerImage,
        images,
        videos,
        audios,
        link,
        poll,
        author: req.user._id,
        community: communityId,
      });

      await newPost.save();

      // Notify other members
      const notifications = community.members
        .filter((member) => member._id.toString() !== req.user._id.toString())
        .map((member) => ({
          toUser: member._id,
          fromUser: req.user._id,
          type: "post",
          message: `${req.user.username} posted in ${community.communityName}`,
          community: community._id,
          post: newPost._id,
        }));

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }

      // Add post to the community
      await Community.findByIdAndUpdate(communityId, {
        $push: { posts: newPost._id },
      });

      return res
        .status(201)
        .json({ message: "Community Post created", post: newPost });
    }

    // If it's a general post (not tied to a community)
    const newPost = new CommunityPost({
      title,
      content,
      type,
      bannerImage,
      images,
      videos,
      audios,
      link,
      poll,
      author: req.user._id,
    });

    await newPost.save();
    const post = await CommunityPost.findById(newPost._id).populate(
      "author",
      "username fullName profilePic"
    );
    return res.status(201).json({ message: "Post created", post: post });
  } catch (error) {
    console.error("Error creating community post:", error);
    return res.status(500).json({ error: error.message });
  }
});

// get community post
communityPostRoutes.get(
  "/getcommunity/:communityId",
  protectRoutes,
  async (req, res) => {
    try {
      const { communityId } = req.params;
      const userId = req.user._id;

      // Get user to know which posts are hidden
      const user = await User.findById(userId);
      const hiddenPosts = user?.CommuniyPostsHide || [];

      // Fetch posts excluding hidden ones
      const posts = await CommunityPost.find({
        community: communityId,
        _id: { $nin: hiddenPosts }, // Exclude hidden post IDs
      })
        .populate("author", "username profilePic") // typo fix: profileImage -> profilePic
        .sort({ createdAt: -1 });

      res.json(posts);
    } catch (error) {
      console.error("error in getCommunityPost", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// get Posts
communityPostRoutes.get("/:postId", async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await CommunityPost.findById(postId)
      .populate("author", "username profilePic") // Author of post
      .populate("community", "name profileImage") // Community
      .populate({
        path: "comments.user", // Comment author
        select: "username profilePic",
      })
      .populate({
        path: "comments.replies.user", // Reply author
        select: "username profilePic",
      });

    if (!post) return res.status(404).json({ error: "Post not found" });

    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// post like
communityPostRoutes.put("/like/:postId", protectRoutes, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    const post = await CommunityPost.findById(postId);
    const user = await User.findById(userId);

    if (!post || !user)
      return res.status(404).json({ message: "Post or user not found" });

    const hasLiked = post.likes.includes(userId);
    const hasDisliked = post.dislikes.includes(userId);

    // Remove dislike if exists
    if (hasDisliked) {
      post.dislikes.pull(userId);
      user.postDisliked.pull(postId);
    }

    if (hasLiked) {
      post.likes.pull(userId);
      user.postLiked.pull(postId);
    } else {
      post.likes.push(userId);
      user.postLiked.push(postId);
    }

    await post.save();
    await user.save();

    res.json({
      message: hasLiked ? "Post unliked" : "Post liked",
      post,
    });
  } catch (error) {
    console.error("Error in liking post:", error);
    res.status(500).json({ message: "Server error in like" });
  }
});

// post dislike
communityPostRoutes.put("/dislike/:postId", protectRoutes, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    const post = await CommunityPost.findById(postId);
    const user = await User.findById(userId);

    if (!post || !user)
      return res.status(404).json({ message: "Post or user not found" });

    const hasDisliked = post.dislikes.includes(userId);
    const hasLiked = post.likes.includes(userId);

    // Remove like if exists
    if (hasLiked) {
      post.likes.pull(userId);
      user.postLiked.pull(postId);
    }

    if (hasDisliked) {
      post.dislikes.pull(userId);
      user.postDisliked.pull(postId);
    } else {
      post.dislikes.push(userId);
      user.postDisliked.push(postId);
    }

    await post.save();
    await user.save();

    res.json({
      message: hasDisliked ? "Post undisliked" : "Post disliked",
      likesCount: post.likes.length,
      dislikesCount: post.dislikes.length,
    });
  } catch (error) {
    console.error("Error in disliking post:", error);
    res.status(500).json({ message: "Server error in dislike" });
  }
});

// get comment on that post
communityPostRoutes.post(
  "/comment/:postId",
  protectRoutes,
  async (req, res) => {
    const user = req.user;
    try {
      const { postId } = req.params;
      const { text } = req.body;

      const post = await CommunityPost.findById(postId);
      if (!post) return res.status(404).json({ error: "Post not found" });

      post.comments.push({
        user: req.user._id,
        text,
      });

      await post.save();
      res.json({ message: "Comment added", comments: post.comments });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// getComments
communityPostRoutes.get(
  "/Getcomment/:postId",
  protectRoutes,
  async (req, res) => {
    try {
      const { postId } = req.params;

      const post = await CommunityPost.findById(postId)
        .populate({
          path: "comments.user",
          select: "username profilePic",
        })
        .populate({
          path: "comments.replies.user",
          select: "username profilePic",
        });

      if (!post) return res.status(404).json({ error: "Post not found" });

      res.json({ comments: post.comments });
    } catch (error) {
      console.error("Error in Getcomment:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// delete comment
communityPostRoutes.delete(
  "/comment/:postId/:commentId",
  protectRoutes,
  async (req, res) => {
    try {
      const { postId, commentId } = req.params;
      console.log({ postId, commentId });
      const userId = req.user._id;

      const post = await CommunityPost.findById(postId);

      if (!post) return res.status(404).json({ error: "Post not found" });

      const comment = post.comments.id(commentId);
      console.log("comment", comment);
      if (!comment) return res.status(404).json({ error: "Comment not found" });
      if (comment.user.toString() !== userId.toString())
        return res
          .status(403)
          .json({ error: "Unauthorized to delete this comment" });

      post.comments.pull(commentId);
      await post.save();
      res.json({ message: "Comment deleted" });
    } catch (error) {
      console.log("error in deleteComment", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// delete post
communityPostRoutes.delete("/:postId", protectRoutes, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    const post = await CommunityPost.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    if (post.author.toString() !== userId.toString())
      return res.status(403).json({ error: "Unauthorized to delete post" });

    await post.remove();
    res.json({ message: "Post deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// reply that comment
communityPostRoutes.post(
  "/comment/reply/:postId/:commentId",
  protectRoutes,
  async (req, res) => {
    try {
      const { postId, commentId } = req.params;
      const { text } = req.body;
      const userId = req.user._id;

      const post = await CommunityPost.findById(postId);
      if (!post) return res.status(404).json({ error: "Post not found" });

      const comment = post.comments.id(commentId);
      if (!comment) return res.status(404).json({ error: "Comment not found" });

      comment.replies.push({
        user: userId,
        text,
        createdAt: new Date(),
        likes: [],
      });

      await post.save();
      const updatedPost = await CommunityPost.findById(postId).populate(
        "comments.replies.user",
        "username profilePic"
      );
      res.status(200).json({ message: "Reply added", updatedPost });
    } catch (error) {
      console.log("error in replyToComment", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// like comment
communityPostRoutes.post(
  "/comment/like/:postId/:commentId",
  protectRoutes,
  async (req, res) => {
    try {
      const { postId, commentId } = req.params;
      const userId = req.user._id;

      const post = await CommunityPost.findById(postId);
      if (!post) return res.status(404).json({ error: "Post not found" });

      const comment = post.comments.id(commentId);
      if (!comment) return res.status(404).json({ error: "Comment not found" });

      const alreadyLiked = comment.likes.includes(userId);
      if (alreadyLiked) {
        comment.likes.pull(userId); // Dislike
      } else {
        comment.likes.push(userId); // Like
      }

      await post.save();
      const updatedPost = await CommunityPost.findById(postId).populate(
        "comments.likes",
        "username profilePic"
      );
      res.status(200).json({ liked: !alreadyLiked, currentPost: updatedPost });
    } catch (error) {
      console.log("error in likeDislikeComment", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// delete that reply comment
communityPostRoutes.delete(
  "/comment/:postId/:commentId",
  protectRoutes,
  async (req, res) => {
    try {
      const { postId, commentId } = req.params;
      const userId = req.user._id;

      const post = await CommunityPost.findById(postId);
      if (!post) return res.status(404).json({ error: "Post not found" });

      const comment = post.comments.id(commentId);
      if (!comment) return res.status(404).json({ error: "Comment not found" });

      if (comment.user.toString() !== userId.toString())
        return res
          .status(403)
          .json({ error: "Unauthorized to delete this comment" });

      comment.remove(); // shortcut for pull + match
      await post.save();

      res.json({ message: "Comment deleted" });
    } catch (error) {
      console.log("error in deleteComment", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// edit Comment
communityPostRoutes.put(
  "/comment/:postId/:commentId",
  protectRoutes,
  async (req, res) => {
    try {
      const { postId, commentId } = req.params;
      const { newComment } = req.body;
      console.log({ newComment });
      const userId = req.user._id;

      const post = await CommunityPost.findById(postId);
      if (!post) return res.status(404).json({ error: "Post not found" });

      const comment = post.comments.id(commentId);
      if (!comment) return res.status(404).json({ error: "Comment not found" });

      if (comment.user.toString() !== userId.toString())
        return res
          .status(403)
          .json({ error: "Unauthorized to edit this comment" });

      comment.text = newComment;
      await post.save();
      const updatePost = await CommunityPost.findById(postId);
      res.json({ message: "Comment updated", updatePost });
    } catch (error) {
      console.log("error in editComment", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// edit replies comment
communityPostRoutes.put(
  "/comment/reply/:postId/:commentId/:replyId",
  protectRoutes,
  async (req, res) => {
    try {
      const { postId, commentId, replyId } = req.params;
      const { text } = req.body;
      const userId = req.user._id;

      const post = await CommunityPost.findById(postId);
      if (!post) return res.status(404).json({ error: "Post not found" });

      const comment = post.comments.id(commentId);
      if (!comment) return res.status(404).json({ error: "Comment not found" });

      const reply = comment.replies.id(replyId);
      if (!reply) return res.status(404).json({ error: "Reply not found" });

      if (reply.user.toString() !== userId.toString())
        return res
          .status(403)
          .json({ error: "Unauthorized to edit this reply" });

      reply.text = text;
      await post.save();

      res.json({ message: "Reply updated", reply });
    } catch (error) {
      console.error("error in editReply", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// replies like and Unlike
communityPostRoutes.put(
  "/comment/reply/like/:postId/:commentId/:replyId",
  protectRoutes,
  async (req, res) => {
    try {
      const { postId, commentId, replyId } = req.params;
      const userId = req.user._id;

      const post = await CommunityPost.findById(postId);
      if (!post) return res.status(404).json({ error: "Post not found" });

      const comment = post.comments.id(commentId);
      if (!comment) return res.status(404).json({ error: "Comment not found" });

      const reply = comment.replies.id(replyId);
      if (!reply) return res.status(404).json({ error: "Reply not found" });

      const alreadyLiked = reply.likes.includes(userId);

      if (alreadyLiked) {
        // Unlike
        reply.likes = reply.likes.filter(
          (id) => id.toString() !== userId.toString()
        );
      } else {
        // Like
        reply.likes.push(userId);
      }

      await post.save();

      res.json({
        message: alreadyLiked ? "Reply unliked" : "Reply liked",
        totalLikes: reply.likes.length,
      });
    } catch (error) {
      console.error("error in like/unlike reply", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// repost communityPosts

communityPostRoutes.put(
  "/repost/:originalPostId",
  protectRoutes,
  async (req, res) => {
    try {
      const { originalPostId } = req.params;
      const { repostComment, communityId } = req.body;
      const userId = req.user._id;
      console.log({ originalPostId });
      const originalPost = await CommunityPost.findById(originalPostId);
      if (!originalPost) {
        return res.status(404).json({ error: "Original post not found" });
      }

      // If already reposted, remove repost (unrepost)
      if (originalPost.reposts.includes(userId)) {
        originalPost.reposts.pull(userId);
        await originalPost.save();

        // Remove from user's reposts
        await User.findByIdAndUpdate(userId, {
          $pull: { reposts: originalPostId },
        });

        return res.status(200).json({ message: "Repost removed" });
      }

      if (!originalPost.community) {
        const newRepost = await CommunityPost.create({
          title: `Repost: ${originalPost.title}`,
          type: "repost",
          repost: originalPost._id,
          repostComment,
          author: userId,

          reposts: [userId], // only the current user has reposted it initially
        });

        await User.findByIdAndUpdate(userId, {
          $addToSet: { reposts: newRepost._id },
        });

        // Add current user to original post's repost list
        originalPost.reposts.push(userId);
        await originalPost.save();

        // Send notification to original post's author if not the same user
        if (originalPost.author.toString() !== userId.toString()) {
          const user = await User.findById(userId);
          await Notification.create({
            fromUser: userId,
            toUser: originalPost.author,
            type: "repost",
            message: `${user.username} reposted your post`,
            post: originalPost._id,
          });
        }

        return res
          .status(201)
          .json({ message: "Normal post Reposted created", repost: newRepost });
      }
      // Create new repost

      const newRepost = await CommunityPost.create({
        title: `Repost: ${originalPost.title}`,
        type: "repost",
        repost: originalPost._id,
        repostComment,
        author: userId,
        community: communityId ? communityId : "",
        reposts: [userId], // only the current user has reposted it initially
      });

      // Add repost ID to user history
      await User.findByIdAndUpdate(userId, {
        $addToSet: { reposts: newRepost._id },
      });

      // Add current user to original post's repost list
      originalPost.reposts.push(userId);
      await originalPost.save();

      // Send notification to original post's author if not the same user
      if (originalPost.author.toString() !== userId.toString()) {
        const user = await User.findById(userId);
        await Notification.create({
          fromUser: userId,
          toUser: originalPost.author,
          type: "repost",
          message: `${user.username} reposted your post`,
          post: originalPost._id,
          community: communityId ? communityId : "",
        });
      }

      return res
        .status(201)
        .json({ message: "Repost created", repost: newRepost });
    } catch (error) {
      console.error("Repost error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// save posts to user
communityPostRoutes.post(
  "/posts/save/:postId",
  protectRoutes,
  async (req, res) => {
    try {
      const userId = req.user._id;
      const { postId } = req.params;

      const post = await CommunityPost.findById(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      const user = await User.findById(userId);

      const isSaved = user.SavePosts.includes(postId);

      if (isSaved) {
        user.SavePosts.pull(postId);
        await user.save();
        const updateduser = await User.findById(req.user._id).populate(
          "SavePosts"
        );
        return res.status(200).json({
          message: "Post unsaved",
          updateduser: updateduser.SavePosts,
        });
      } else {
        user.SavePosts.push(postId);
        await user.save();
        const updateduser = await User.findById(req.user._id).populate(
          "SavePosts"
        );
        return res
          .status(200)
          .json({ message: "Post saved", updateduser: updateduser.SavePosts });
      }
    } catch (error) {
      console.error("Error saving/unsaving post:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// communityPosts Hide
communityPostRoutes.put(
  "/postHide/:postId",
  protectRoutes,
  async (req, res) => {
    try {
      const { postId } = req.params;

      const checkPost = await CommunityPost.findById(postId);
      if (!checkPost) {
        return res.status(404).json({ message: "Post not found" });
      }
      const user = await User.findById(req.user._id);
      const CheckalreadyPostsHide = user.CommuniyPostsHide.includes(postId);
      if (CheckalreadyPostsHide) {
        user.CommuniyPostsHide.pull(postId);
      } else {
        user.CommuniyPostsHide.push(postId);
      }

      await user.save();
      // Add the postId to user's hidden posts

      const updatedUser = await User.findById(req.user._id).populate(
        "CommuniyPostsHide"
      );

      res.status(200).json({
        message: CheckalreadyPostsHide ? "Post View" : "Post hidden",
        user: updatedUser,
      });
    } catch (error) {
      console.log("Error in communityPostHide:", error);
      res.status(400).json({ message: "Error hiding post" });
    }
  }
);

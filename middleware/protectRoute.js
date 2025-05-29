import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

export const protectRoutes = async (req, res, next) => {
  try {
    // Get token from cookies
    const token = req.cookies?.jwt;
    console.log("token", token);
    if (!token) {
      return res.status(401).json({ message: "Not authorized, token missing" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // console.log("decodedToken", decoded);
    // Find user based on token's payload
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Attach user to request
    req.user = user;
    next(); // Continue to the next middleware or route handler
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(401).json({ message: "Token is invalid or expired" });
  }
};

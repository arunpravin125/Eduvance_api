import express from "express";
import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const authRoutes = express.Router();

// token Generate
const generateTokenAndSetCookie = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });

  res.cookie("jwt", token, {
    httpOnly: true,
    secure: false, // must be false on localhost HTTP
    sameSite: "lax", // 'lax' is usually safe for auth cookies
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
};

// SIGNUP ROUTE
authRoutes.post("/signup", async (req, res) => {
  try {
    const { fullName, username, email, password, confirmPassword } = req.body;

    if (!fullName || !username || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      fullName,
      username,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    generateTokenAndSetCookie(newUser._id, res);

    res.status(201).json({
      user: newUser,
      message: "Signup successful",
    });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//LOGIN ROUTE
authRoutes.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect password" });
    }

    generateTokenAndSetCookie(user._id, res);

    res.status(200).json({
      user,
      message: "Login successful",
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//LOGOUT ROUTE
authRoutes.post("/logout", (req, res) => {
  try {
    res.cookie("jwt", "", {
      httpOnly: true,
      maxAge: 1,
    });
    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

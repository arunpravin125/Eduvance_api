import express from "express";
import dotenv from "dotenv";
import { connection } from "./lib/db.js";
import { authRoutes } from "./routes/authRoutes.js";
import cors from "cors";

import { communityPostRoutes } from "./routes/communityPostRoutes.js";
import { userRoutes } from "./routes/user.routes.js";
import { communityRoute } from "./routes/community.routes.js";
import { notificationRoutes } from "./routes/notification.routes.js";
import { chatCommunityGroup } from "./routes/chat.routes.js";
import { privateChatRoute } from "./routes/privateChatRoutes.js";
import { postRoutes } from "./routes/postfeedRoutes.js";
import cookieParser from "cookie-parser";
import { app, io, server } from "./socket/socket.js";

// const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3001", // frontend origin
    credentials: true, // allow cookies
  })
);

dotenv.config();

const PORT = process.env.PORT || 3001;

app.use("/api/auth", authRoutes); //  finished
app.use("/api/user", userRoutes); // finished
app.use("/api/community", communityRoute); // finished
app.use("/api/communityPost", communityPostRoutes); // finished
app.use("/api/notification", notificationRoutes);
app.use("/api/communityGroupChat", chatCommunityGroup); // finished
app.use("/api/privateChat", privateChatRoute); // finished
app.use("/api/postFeed", postRoutes);

server.listen(PORT, () => {
  connection();
  console.log(`Server started...${PORT}`);
});

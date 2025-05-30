import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: ["http://localhost:3001"],
  methods: ["GET", "POST", "PUT", "DELETE"],
});
io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  // socket.on() is used to listen events,can be used client and server side
  socket.on("disconnect", () => {
    console.log("user disconnected", socket.id);
  });
});
export { app, io, server };

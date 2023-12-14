const express = require("express");
const http = require("http");
const app = express();
const path = require("path");
const fs = require("fs");
const server = http.createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const blobMap = new Map();

function saveVideoToFile(socketId, videoData) {
  const fileName = `video_${socketId}_${Date.now()}.webm`;
  const uploadDir = path.join(__dirname, "uploads");
  const filePath = path.join(uploadDir, fileName);

  fs.writeFile(filePath, videoData, "binary", (err) => {
    if (err) throw err;
    console.log(`Video saved for ${socketId}:`, fileName);
  });
}

io.on("connection", (socket) => {
  socket.emit("me", socket.id);

  socket.on("disconnect", () => {
    if (blobMap.has(socket.id)) {
      console.log("blobMap.size", blobMap.size);
      const fullVideoData = Buffer.concat(blobMap.get(socket.id));
      console.log("fullVideoData", fullVideoData);
      blobMap.delete(socket.id);

      saveVideoToFile(socket.id, fullVideoData);
    }
    socket.broadcast.emit("callEnded");
  });

  socket.on("callUser", (data) => {
    io.to(data.userToCall).emit("callUser", {
      signal: data.signalData,
      from: data.from,
      name: data.name,
    });
  });

  socket.on("answerCall", (data) => {
    io.to(data.to).emit("callAccepted", data.signal);
  });

  socket.on("recordedVideoChunk", ({ data }) => {
    if (!blobMap.has(socket.id)) {
      blobMap.set(socket.id, []);
    }

    blobMap.get(socket.id).push(Buffer.from(data));
  });
});

server.listen(5000, () => console.log("server is running on port 5000"));

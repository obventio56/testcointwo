const httpServer = require("http").createServer();
const io = require("socket.io")(httpServer, {
  cors: {
    origin: "*"
  }
});

io.on("connection", socket => {
  console.log(`Connected ${socket.id}`);
  socket.broadcast.emit("ready", { id: socket.id });

  /*
  socket.on("broadcast", data => {
    console.log(`Broadcast from ${socket.id}: ${data}`);
    socket.broadcast.emit("broadcast", { data, from: socket.id });
  });
  */

  socket.on("message", data => {
    console.log(`Message from ${socket.id} to ${data.to}: ${data}`);
    socket.to(data.to).emit("message", { from: socket.id, data: data.data });
  });
});

httpServer.listen(9000);

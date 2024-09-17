import { corsUrl, port } from "../config";
import app from "./app";
import http from "http";
import { Server } from "socket.io";
import { initializeDB } from "../data";
import { Logger } from "../util";
import { ioOnConnection } from "./connection";

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsUrl,
  },
});

export function initializeServer() {
  ioOnConnection(io);

  server
    .listen(port, () => {
      Logger.log(`server running at http://localhost:${port}`);
    })
    .on("error", (e) => {
      Logger.error("server start error", e);
    });
}

export function startServer() {
  initializeDB()
    .then((_) => {
      Logger.log("connect db success");
      initializeServer();
    })
    .catch((err) => {
      Logger.error("connect db failed", err);
    });
}

import { Server, Socket } from "socket.io";
import { Logger } from "../util";
import {
  onAddUsersToChannel,
  onCreateChannel,
  onDeleteFriend,
  onFetchFirstMessageID,
  onFetchFriends,
  onFetchMessages,
  onFetchUser,
  onLeaveChannel,
  onNewFriendRequest,
  onReceiveMessage,
  onUpdateBio,
  onUpdateChannelName,
  onUpdateFriendRequest,
  onUpdateNickname,
  sendChannelUnreadInfo,
  sendFirstMessages,
  sendFriendRequests,
  sendFriendsInfo,
  sendLatestMessages,
  sendUserInfoAndChannels,
} from ".";
import { onlineUsers, userConnections } from "./connection-manager";

function joinUser(socket: Socket, uid: string) {
  onlineUsers.set(socket.id, uid);
  let connections = userConnections.get(uid);
  if (connections === undefined) {
    connections = new Set();
  }
  connections.add(socket);
  userConnections.set(uid, connections);
  Logger.log("onlineUsers", onlineUsers);
}

function onJoin(socket: Socket) {
  socket.on(
    "join",
    (uid: string, checkedChannelMessageIDs: Record<string, number>) => {
      joinUser(socket, uid);
      sendUserInfoAndChannels(socket, uid);
      sendLatestMessages(socket, uid);
      sendFirstMessages(socket, uid);
      sendChannelUnreadInfo(socket, uid, checkedChannelMessageIDs);
      sendFriendsInfo(socket, uid);
      sendFriendRequests(socket, uid);
    }
  );
}

function onUserDisconnect(socket: Socket) {
  socket.on("disconnect", () => {
    const uid = onlineUsers.get(socket.id);
    onlineUsers.delete(socket.id);
    if (uid !== undefined) {
      const connections = userConnections.get(uid);
      if (connections !== undefined) {
        connections.delete(socket);
        if (connections.size === 0) {
          userConnections.delete(uid);
        }
      }
    }
    Logger.log("user disconnected, online user count:", onlineUsers.size);
    Logger.log("onlineUsers", onlineUsers);
  });
}

export function ioOnConnection(io: Server) {
  io.on("connection", (socket) => {
    Logger.log("user connected, online user count:", onlineUsers.size);

    onJoin(socket);
    onReceiveMessage(socket);
    onFetchMessages(socket);
    onFetchFirstMessageID(socket);
    onFetchUser(socket);
    onFetchFriends(socket);
    onNewFriendRequest(socket);
    onUpdateFriendRequest(socket);
    onCreateChannel(socket);
    onAddUsersToChannel(socket);
    onUpdateChannelName(socket);
    onLeaveChannel(socket);
    onDeleteFriend(socket);
    onUpdateBio(socket);
    onUpdateNickname(socket);
    onUserDisconnect(socket);
  });
}

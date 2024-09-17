import { Socket } from "socket.io";
import {
  createMessage,
  getChannelFirstMessagID,
  fetchMessageDesc,
  createGroupChannel,
  addUsersToChannel,
  updateChannelName,
  leaveChannel,
  getUserChannelLastMessags,
  getUserChannelFirstMessags,
  getUserChannelsUnreadInfo,
  getUserInfoAndChannels,
} from "../data";
import { Logger } from "../util";
import { getSocketsExcept } from "./connection-manager";
import { extractMessagesInfo } from "./util";
import { ChannelUnreadInfo, UserInfoAndChannels } from "../types";

export function sendChannelUnreadInfo(
  socket: Socket,
  uid: string,
  checkedChannelMessageIDs: Record<string, number>
) {
  getUserChannelsUnreadInfo(uid, checkedChannelMessageIDs)
    .then((info: ChannelUnreadInfo) => {
      socket.emit("channelUnread", { ok: true, data: info });
    })
    .catch((e) => {
      Logger.error("getChannels failed", e);
    });
}

export function sendUserInfoAndChannels(socket: Socket, uid: string) {
  getUserInfoAndChannels(uid)
    .then((user: UserInfoAndChannels | null) => {
      if (!user) {
        Logger.error("get userInfo error: cannot find user", uid);
        socket.emit("userInfo", { ok: false });
        return;
      }
      Logger.log("getUserInfo success", uid, socket.id, Date.now());
      socket.emit("userInfo", { ok: true, data: user });
    })
    .catch((e) => {
      Logger.error("get userInfo error", e);
      socket.emit("userInfo", { ok: false });
    });
}

export function sendLatestMessages(socket: Socket, uid: string) {
  getUserChannelLastMessags(uid)
    .then((messages) => {
      if (!messages) {
        Logger.log("getUserChannelLastMessags failed", uid);
        return;
      }
      Logger.log("getUserChannelLastMessags success", socket.id, Date.now());
      socket.emit("messages", { data: messages });
    })
    .catch((e) => {
      Logger.error("getUserChannelLastMessags error", e);
    });
}

export function sendFirstMessages(socket: Socket, uid: string) {
  getUserChannelFirstMessags(uid)
    .then((firstMessages) => {
      if (!firstMessages) {
        Logger.log("getUserChannelFirstMessags failed", uid);
        return;
      }
      Logger.log("getUserChannelFirstMessags success");
      socket.emit("firstMessage", { data: firstMessages });
    })
    .catch((e) => {
      Logger.error("getUserChannelFirstMessags error", e);
    });
}

export function onReceiveMessage(socket: Socket) {
  socket.on("userSendMessage", (userID, channelID, content, callBack) => {
    const createTime = Date.now();
    createMessage(userID, channelID, content, createTime)
      .then((message: { channel?: { userIDs: string[] } } | undefined) => {
        if (!message) {
          Logger.log(
            "createMessage failed",
            userID,
            channelID,
            content,
            createTime
          );
          callBack?.({ ok: false });
          return;
        }
        const channelUIDs = message.channel?.userIDs;
        delete message.channel;
        callBack?.({ ok: true, data: message });
        getSocketsExcept(channelUIDs, socket.id).forEach((userSocket) => {
          userSocket.emit("newMessage", { data: message });
        });
      })
      .catch((e) => {
        Logger.error("createMessage failed", e);
        callBack?.({ ok: false });
      });
  });
}

export function onFetchMessages(socket: Socket) {
  socket.on(
    "fetchMessages",
    (channelID, lastMessageID: number | undefined, callBack) => {
      fetchMessageDesc(channelID, lastMessageID, undefined)
        .then((channel) => {
          if (!channel) {
            Logger.log("fetchMessageDesc failed", channelID, lastMessageID);
            callBack?.({ ok: false });
            return;
          }
          Logger.log("fetchMessageDesc success");
          const result = extractMessagesInfo(channel.messages);
          callBack?.({ ok: true, data: result });
        })
        .catch((e) => {
          Logger.error("fetchMessageDesc error", channelID, lastMessageID, e);
          callBack?.({ ok: false });
        });
    }
  );
}

export function onFetchFirstMessageID(socket: Socket) {
  socket.on("fetchFirstMessageID", (channelID, callBack) => {
    getChannelFirstMessagID(channelID)
      .then((firstMessages) => {
        if (!firstMessages) {
          Logger.log("getChannelFirstMessagID failed", channelID);
          callBack?.({ ok: false });
          return;
        }
        Logger.log("getChannelFirstMessagID success");
        callBack?.({ ok: true, data: firstMessages });
      })
      .catch((e) => {
        Logger.error("getChannelFirstMessagID error", channelID, e);
        callBack?.({ ok: false });
      });
  });
}

export function onCreateChannel(socket: Socket) {
  socket.on(
    "createChannel",
    (
      request: { createrID: string; otherUIDs: string[]; channelName: string },
      callBack
    ) => {
      const { createrID, otherUIDs, channelName } = request;
      const groupUIDs = [createrID, ...otherUIDs];
      createGroupChannel(createrID, groupUIDs, channelName)
        .then((channel) => {
          if (!channel) {
            Logger.log("createChannel failed", request);
            callBack?.({ ok: false });
            return;
          }
          const messagesInfo = extractMessagesInfo(channel.messages);
          const channelsInfo = { [channel.id]: channel };
          const data = { channels: channelsInfo, messages: messagesInfo };
          callBack?.({ ok: true, data: data });
          getSocketsExcept(groupUIDs, socket.id).forEach((userSocket) => {
            userSocket.emit("updateChannels", { data: data });
          });
        })
        .catch((e) => {
          Logger.log("createChannel error", request, e);
          callBack?.({ ok: false });
        });
    }
  );
}

export function onAddUsersToChannel(socket: Socket) {
  socket.on(
    "addUsersToChannel",
    (request: { uid: string; channelID: string; uids: string[] }, callBack) => {
      const { uid, channelID, uids } = request;
      addUsersToChannel(uid, channelID, uids)
        .then((channel) => {
          if (!channel) {
            Logger.log("addUsersToChannel failed", request);
            callBack?.({ ok: false });
            return;
          }
          const messagesInfo = extractMessagesInfo(channel.messages);
          const data = {
            channels: { [channel.id]: channel },
            messages: messagesInfo,
          };
          callBack?.({ ok: true, data: data });
          getSocketsExcept(channel.userIDs, socket.id).forEach((userSocket) => {
            userSocket.emit("updateChannels", { data: data });
          });
        })
        .catch((e) => {
          Logger.log("addUsersToChannel error", request, e);
          callBack?.({ ok: false });
        });
    }
  );
}

export function onUpdateChannelName(socket: Socket) {
  socket.on(
    "updateChannelName",
    (
      request: { uid: string; channelID: string; newName: string },
      callBack
    ) => {
      const { uid, channelID, newName } = request;
      updateChannelName(uid, channelID, newName)
        .then((channel) => {
          if (!channel) {
            Logger.log("updateChannelName failed", request);
            callBack?.({ ok: false });
            return;
          }
          const data = { channels: { [channel.id]: channel } };
          callBack?.({ ok: true, data: data });
          getSocketsExcept(channel.userIDs, socket.id).forEach((userSocket) => {
            userSocket.emit("updateChannels", { data: data });
          });
        })
        .catch((e) => {
          Logger.log("updateChannelName error", request, e);
          callBack?.({ ok: false });
        });
    }
  );
}

export function onLeaveChannel(socket: Socket) {
  socket.on(
    "leaveChannel",
    (request: { uid: string; channelID: string }, callBack) => {
      const { uid, channelID } = request;
      leaveChannel(uid, channelID)
        .then((channel) => {
          if (!channel) {
            Logger.log("leaveChannel failed", request);
            callBack?.({ ok: false });
            return;
          }
          const deletedChannel = { channels: { [channel.id]: null } };
          callBack?.({ ok: true, data: deletedChannel });
          getSocketsExcept([uid], socket.id).forEach((userSocket) => {
            userSocket.emit("updateChannels", { data: deletedChannel });
          });
          const channelsInfo = { channels: { [channel.id]: channel } };
          getSocketsExcept(channel.userIDs, socket.id).forEach((userSocket) => {
            userSocket.emit("updateChannels", { data: channelsInfo });
          });
        })
        .catch((e) => {
          Logger.log("leaveChannel error", request, e);
          callBack?.({ ok: false });
        });
    }
  );
}

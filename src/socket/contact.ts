import { Socket } from "socket.io";
import {
  getFriends,
  getUser,
  getUserByUsername,
  sendFriendRequest,
  updateFriendRequest,
  acceptFriendRequest,
  deleteFriend,
  getFriendRequests,
} from "../data";
import { FriendRequests, UserWithFriends, UsersInfo } from "../types";
import { FriendRequestStatus } from "@prisma/client";
import { Logger } from "../util";
import { getSocketsExcept } from "./connection-manager";
import { extractMessagesInfo } from "./util";

export function sendFriendRequests(socket: Socket, uid: string) {
  getFriendRequests(uid)
    .then((user) => {
      if (!user) {
        Logger.error("getFriendRequests error: cannot find user", uid);
        return;
      }
      Logger.log("getFriendRequests success", uid);
      const friendRequests: FriendRequests = [
        ...(user.sentFriendRequests ?? []),
        ...(user.receivedFriendRequests ?? []),
      ].reduce((prev: FriendRequests, curr) => {
        prev[curr.id] = curr;
        return prev;
      }, {});
      socket.emit("friendRequests", { data: friendRequests });
    })
    .catch((e) => {
      Logger.error("getFriendRequests error", e);
    });
}

export function sendFriendsInfo(socket: Socket, uid: string) {
  getFriends(uid)
    .then((user: UserWithFriends | null) => {
      if (!user) {
        Logger.error("get friends error: cannot find user", uid);
        return;
      }
      const friends = getFriendsFromUser(user);
      socket.emit("friends", {
        data: {
          self: user,
          users: friends,
        },
      });
    })
    .catch((e) => {
      Logger.error("get friends error", e);
    });
}

export function onNewFriendRequest(socket: Socket) {
  socket.on(
    "sendFriendRequest",
    (
      request: {
        senderID: string;
        receiverID: string;
        message: string;
      },
      callBack
    ) => {
      const { senderID, receiverID, message } = request;
      sendFriendRequest(senderID, receiverID, message)
        .then((friendRequest) => {
          if (!friendRequest) {
            Logger.log("sendFriendRequest failed", request);
            callBack?.({ ok: false });
            return;
          }
          const friendRequests = { [friendRequest.id]: friendRequest };
          callBack?.({ ok: true, data: friendRequests });
          getSocketsExcept([receiverID, senderID], socket.id).forEach(
            (userSocket) => {
              userSocket.emit("friendRequests", { data: friendRequests });
            }
          );
        })
        .catch((e) => {
          Logger.log("sendFriendRequest failed", request, e);
          callBack?.({ ok: false });
        });
    }
  );
}

export function onUpdateFriendRequest(socket: Socket) {
  socket.on(
    "updateFriendRequest",
    (
      request: {
        id: string;
        senderID: string;
        receiverID: string;
        status: FriendRequestStatus;
      },
      callBack
    ) => {
      const { id, senderID, receiverID, status } = request;
      if (status !== FriendRequestStatus.Accepted) {
        updateFriendRequest(id, status)
          .then((friendRequest) => {
            if (friendRequest.status !== status) {
              Logger.log("updateFriendRequest failed", request);
              callBack?.({ ok: false });
            } else {
              const friendRequests = { [friendRequest.id]: friendRequest };
              callBack?.({
                ok: true,
                data: {
                  friendRequests: friendRequests,
                },
              });
              if (friendRequest.status === FriendRequestStatus.Refused) {
                getSocketsExcept([senderID, receiverID], socket.id).forEach(
                  (userSocket) => {
                    userSocket.emit("friendRequests", { data: friendRequests });
                  }
                );
              }
            }
          })
          .catch((e) => {
            Logger.log("updateFriendRequest failed", request, e);
            callBack?.({ ok: false });
          });
      } else {
        acceptFriendRequest(id, senderID, receiverID)
          .then((res) => {
            const [userInfo, channelInfo, friendRequest] = res;
            if (
              !friendRequest ||
              friendRequest.status !== FriendRequestStatus.Accepted
            ) {
              Logger.log("updateFriendRequest failed", request);
              callBack?.({ ok: false });
            } else {
              const sender = friendRequest.sender;
              const friendRequests = { [friendRequest.id]: friendRequest };
              const mesages = channelInfo.messages;
              const messagesInfo = extractMessagesInfo(mesages);
              const receiverData = {
                user: userInfo,
                channels: { [channelInfo.id]: channelInfo },
                users: sender ? { [sender.id]: sender } : undefined,
                messages: messagesInfo,
                friendRequests: friendRequests,
              };
              callBack?.({
                ok: true,
                data: receiverData,
              });
              getSocketsExcept([receiverID], socket.id).forEach(
                (userSocket) => {
                  userSocket.emit("acceptedFriendRequest", {
                    data: receiverData,
                  });
                }
              );
              if (sender?.id === senderID) {
                const senderData = {
                  user: sender,
                  channels: { [channelInfo.id]: channelInfo },
                  users: { [userInfo.id]: userInfo },
                  messages: messagesInfo,
                  friendRequests: friendRequests,
                };
                getSocketsExcept([senderID], socket.id).forEach(
                  (userSocket) => {
                    userSocket.emit("acceptedFriendRequest", {
                      data: senderData,
                    });
                  }
                );
              }
            }
          })
          .catch((e) => {
            Logger.log("updateFriendRequest failed", request, e);
            callBack?.({ ok: false });
          });
      }
    }
  );
}

export function onDeleteFriend(socket: Socket) {
  socket.on(
    "deleteFriend",
    (
      request: {
        uid: string;
        friendUID: string;
      },
      callBack
    ) => {
      const { uid, friendUID } = request;
      deleteFriend(uid, friendUID)
        .then((result) => {
          const [user, friend] = result;
          if (!result || !user) {
            Logger.log("deleteFriend failed", request);
            callBack?.({ ok: false });
            return;
          }
          const callerData = {
            self: user,
            users: !!friend ? { [friend.id]: friend } : undefined,
          };
          callBack?.({
            ok: true,
            data: callerData,
          });
          getSocketsExcept([uid], socket.id).forEach((userSocket) =>
            userSocket.emit("friends", { data: callerData })
          );
          if (!!friend) {
            getSocketsExcept([friendUID]).forEach((userSocket) =>
              userSocket.emit("friends", {
                data: {
                  self: friend,
                  users: { [user.id]: user },
                },
              })
            );
          }
        })
        .catch((e) => {
          Logger.log("deleteFriend error", request, e);
          callBack?.({ ok: false });
        });
    }
  );
}

export function onFetchUser(socket: Socket) {
  socket.on(
    "fetchUser",
    (uid: string | undefined, username: string | undefined, callBack) => {
      if (uid === undefined && username === undefined) {
        Logger.error("invalid uid and username");
        callBack?.({ ok: false });
        return;
      }
      const promise = uid ? getUser(uid) : getUserByUsername(username!);
      promise
        .then((user) => {
          if (!user) {
            Logger.log("getUser failed", uid, username);
            callBack?.({ ok: false });
            return;
          }
          callBack?.({ ok: true, data: user });
        })
        .catch((e) => {
          Logger.log("getUser error", uid, username, e);
          callBack?.({ ok: false });
        });
    }
  );
}

export function onFetchFriends(socket: Socket) {
  socket.on("fetchFriends", (uid: string, callBack) => {
    getFriends(uid)
      .then((user) => {
        if (!user) {
          Logger.log("getFriends failed", uid);
          callBack?.({ ok: false });
          return;
        }
        const friends = getFriendsFromUser(user);
        callBack?.({
          ok: true,
          data: {
            self: user,
            users: friends,
          },
        });
      })
      .catch((e) => {
        Logger.log("getFriends error", uid, e);
        callBack?.({ ok: false });
      });
  });
}

function getFriendsFromUser(user: UserWithFriends): UsersInfo {
  const friends = [...(user.friends ?? []), ...(user.friendsOf ?? [])].reduce(
    (prev: UsersInfo, curr) => {
      prev[curr.id] = curr;
      return prev;
    },
    {}
  );
  return friends;
}

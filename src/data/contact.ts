import { ChannelType, FriendRequestStatus, MessageType } from "@prisma/client";
import {
  UserWithFriends,
  UserInfo,
  FriendRequestInfo,
  ChannelWithMessage,
} from "../types";
import { prisma, store } from "./constant";
import { getDMID } from "./util";

export async function sendFriendRequest(
  senderID: string,
  receiverID: string,
  message: string,
  createdAt?: number
) {
  const createTime = createdAt ?? Date.now()
  const resutlt = await prisma.friendRequest.create({
    data: {
      senderID: senderID,
      receiverID: receiverID,
      message: message,
      createdAt: createTime,
      status: FriendRequestStatus.Sent,
      finished: false,
    },
    include: {
      sender: true,
      receiver: true,
    },
  });
  return resutlt;
}

export async function acceptFriendRequest(
  id: string,
  senderID: string,
  receiverID: string,
  createdAt?: number
): Promise<[UserInfo, ChannelWithMessage, FriendRequestInfo]> {
  const createTime = createdAt ?? Date.now()
  const dmID = getDMID(senderID, receiverID);
  const messageIDCreate = store.uniqueID++;
  const messageIDAddFriend = store.uniqueID++;
  const resutlt = await prisma.$transaction([
    prisma.user.update({
      where: {
        id: receiverID,
      },
      data: {
        friendsOf: {
          connect: [
            {
              id: senderID,
            },
          ],
        },
      },
    }),
    prisma.channel.upsert({
      where: {
        dmID: dmID,
      },
      update: {
        messages: {
          create: {
            messageID: messageIDAddFriend,
            content: "",
            createdAt: createTime,
            messageType: MessageType.AddFriend,
            userID: receiverID,
          },
        },
      },
      create: {
        channelType: ChannelType.DirectMessage,
        dmID: dmID,
        users: {
          connect: [{ id: senderID }, { id: receiverID }],
        },
        adminIDs: [],
        ownerID: undefined,
        messages: {
          createMany: {
            data: [
              {
                messageID: messageIDCreate,
                content: "",
                createdAt: createTime,
                messageType: MessageType.ChannelStart,
                userID: receiverID,
              },
              {
                messageID: messageIDAddFriend,
                content: "",
                createdAt: createTime,
                messageType: MessageType.AddFriend,
                userID: receiverID,
              },
            ],
          },
        },
      },
      include: {
        messages: {
          where: {
            messageID: {
              in: [messageIDCreate, messageIDAddFriend],
            },
          },
          include: {
            user: true,
          },
        },
      },
    }),
    prisma.friendRequest.update({
      where: {
        id: id,
        finished: false,
      },
      data: {
        status: FriendRequestStatus.Accepted,
        finished: true,
      },
      include: {
        sender: true,
        receiver: true,
      },
    }),
  ]);
  return resutlt;
}

export async function updateFriendRequest(
  id: string,
  status: FriendRequestStatus
): Promise<FriendRequestInfo> {
  const willFinish =
    status === FriendRequestStatus.Accepted ||
    status === FriendRequestStatus.Refused;
  const result = await prisma.friendRequest.update({
    where: {
      id: id,
      finished: false,
    },
    data: {
      status: status,
      finished: willFinish,
    },
    include: {
      sender: true,
      receiver: true,
    },
  });
  return result;
}

export async function deleteFriend(uid1: string, uid2: string) {
  const result = await prisma.$transaction([
    prisma.user.update({
      where: {
        id: uid1,
      },
      data: {
        friends: {
          disconnect: [{ id: uid2 }],
        },
        friendsOf: {
          disconnect: [{ id: uid2 }],
        },
      },
    }),
    prisma.user.findUnique({
      where: {
        id: uid2,
      },
    }),
  ]);
  return result;
}

export async function getFriendRequests(uid: string) {
  const result = await prisma.user.findUnique({
    where: {
      id: uid,
    },
    select: {
      sentFriendRequests: {
        include: {
          receiver: true,
        },
      },
      receivedFriendRequests: {
        include: {
          sender: true,
        },
      },
    },
  });

  return result;
}

export async function getFriends(uid: string): Promise<UserWithFriends | null> {
  const result = await prisma.user.findUnique({
    where: {
      id: uid,
    },
    include: {
      friends: true,
      friendsOf: true,
    },
  });

  return result;
}

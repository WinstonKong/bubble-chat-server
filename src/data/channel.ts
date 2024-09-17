import { Message, Channel, ChannelType, MessageType } from "@prisma/client";
import {
  UserInfoAndChannels,
  MessagesInfo,
  ChannelFirstMessages,
  ChannelUnreadInfo,
  ChannelWithMessage,
} from "../types";
import { defaultMessagePageSize, prisma, store } from "./constant";
import { getDMID } from "./util";

export async function getUserInfoAndChannels(
  uid: string
): Promise<UserInfoAndChannels | null> {
  const result = await prisma.user.findUnique({
    where: {
      id: uid,
    },
    include: {
      channels: true,
    },
  });
  return result;
}

export async function getUserChannelLastMessags(
  uid: string
): Promise<MessagesInfo | undefined> {
  const user = await prisma.user.findUnique({
    where: {
      id: uid,
    },
    include: {
      channels: {
        include: {
          messages: {
            take: 10,
            orderBy: {
              messageID: "desc",
            },
            include: {
              user: true,
            },
          },
        },
      },
    },
  });
  const result = user?.channels
    .map((c) => c.messages)
    .reduce((prev: MessagesInfo, curr) => {
      curr.forEach((m) => (prev[m.id] = m));
      return prev;
    }, {});
  return result;
}

export async function getUserChannelFirstMessags(
  uid: string
): Promise<ChannelFirstMessages | undefined> {
  const user = await prisma.user.findUnique({
    where: {
      id: uid,
    },
    include: {
      channels: {
        include: {
          messages: {
            take: 1,
            orderBy: {
              messageID: "asc",
            },
            select: {
              id: true,
            },
          },
        },
      },
    },
  });
  const result = user?.channels.reduce((prev: ChannelFirstMessages, curr) => {
    if (curr.messages.length > 0) {
      prev[curr.id] = curr.messages[0].id;
    } else {
      prev[curr.id] = false;
    }
    return prev;
  }, {});
  return result;
}

export async function getChannelFirstMessagID(
  channelID: string
): Promise<ChannelFirstMessages | undefined> {
  const channel = await prisma.channel.findUnique({
    where: {
      id: channelID,
    },
    include: {
      messages: {
        take: 1,
        orderBy: {
          messageID: "asc",
        },
        select: {
          id: true,
        },
      },
    },
  });
  if (!channel) {
    return undefined;
  }
  const result: ChannelFirstMessages = {};
  if (channel.messages.length > 0) {
    result[channelID] = channel.messages[0].id;
  } else {
    result[channelID] = false;
  }
  return result;
}

export async function getChannel(channelID: string): Promise<Channel | null> {
  const result = await prisma.channel.findUnique({ where: { id: channelID } });
  return result;
}

export async function getDMChannel(
  userAID: string,
  userBID: string
): Promise<Channel | null> {
  return await prisma.channel.findUnique({
    where: {
      dmID: getDMID(userAID, userBID),
    },
  });
}

export async function getLastMessageIDOfChannel(
  channelID: string
): Promise<number | undefined> {
  const lastMessage = await prisma.message.findFirst({
    where: {
      channelID: channelID,
    },
    select: {
      messageID: true,
    },
    orderBy: {
      messageID: "desc",
    },
  });
  return lastMessage?.messageID;
}

export async function createMessage(
  userID: string,
  channelID: string,
  content: string,
  createdAt: number
): Promise<
  {
    channel: {
      userIDs: string[];
    };
  } & Message
> {
  const messageID = store.uniqueID++;
  const message = await prisma.message.create({
    data: {
      messageID: messageID,
      content: content,
      createdAt: createdAt,
      messageType: MessageType.Content,
      user: {
        connect: {
          id: userID,
        },
      },
      channel: {
        connect: {
          id: channelID,
          userIDs: {
            has: userID,
          },
        },
      },
    },
    include: {
      channel: {
        select: {
          userIDs: true,
        },
      },
      user: {
        omit: {
          friendIDs: true,
          friendOfIDs: true,
          channelIDs: true,
        },
      },
    },
  });
  return message;
}

export async function createGroupChannel(
  createrID: string,
  userIDs: string[],
  channelName: string,
  createdAt?: number
): Promise<ChannelWithMessage> {
  const createTime = createdAt ?? Date.now()
  const dmID = createTime + "_" + store.uniqueID++;
  const messageID = store.uniqueID++;
  const result = await prisma.channel.create({
    data: {
      name: channelName,
      channelType: ChannelType.Group,
      dmID: dmID,
      users: {
        connect: userIDs.map((uid) => ({ id: uid })),
      },
      ownerID: createrID,
      messages: {
        create: {
          messageID: messageID,
          content: "",
          createdAt: createTime,
          messageType: MessageType.ChannelStart,
          userID: createrID,
        },
      },
    },
    include: {
      messages: {
        where: {
          messageID: messageID,
        },
        include: {
          user: true,
        },
      },
    },
  });
  return result;
}

export async function addUsersToChannel(
  uid: string,
  channelID: string,
  uids: string[]
): Promise<ChannelWithMessage> {
  const messages = uids.map((uid) => {
    const messageID = store.uniqueID++;
    return {
      messageID: messageID,
      content: "",
      createdAt: Date.now(),
      messageType: MessageType.JoinChannel,
      userID: uid,
    };
  });
  const messageIDs = messages.map((m) => m.messageID);

  const result = await prisma.channel.update({
    where: {
      id: channelID,
      channelType: ChannelType.Group,
      userIDs: {
        has: uid,
      },
    },
    data: {
      users: {
        connect: uids.map((uid) => ({ id: uid })),
      },
      messages: {
        createMany: {
          data: messages,
        },
      },
    },
    include: {
      messages: {
        where: {
          messageID: {
            in: messageIDs,
          },
        },
        include: {
          user: true,
        },
      },
    },
  });
  return result;
}

export async function updateChannelName(
  uid: string,
  channelID: string,
  newName: string
): Promise<Channel> {
  const result = await prisma.channel.update({
    where: {
      id: channelID,
      channelType: ChannelType.Group,
      OR: [
        {
          ownerID: uid,
        },
        {
          adminIDs: { has: uid },
        },
      ],
    },
    data: {
      name: newName,
    },
  });
  return result;
}

export async function leaveChannel(
  uid: string,
  channelID: string
): Promise<Channel> {
  const result = await prisma.channel.update({
    where: {
      id: channelID,
      channelType: ChannelType.Group,
    },
    data: {
      users: {
        disconnect: [{ id: uid }],
      },
    },
  });
  return result;
}

export async function createDMChannel(
  userAID: string,
  userBID: string
): Promise<Channel> {
  const dmID = getDMID(userAID, userBID);
  try {
    const result = await prisma.channel.upsert({
      where: {
        dmID: dmID,
      },
      update: {},
      create: {
        channelType: ChannelType.DirectMessage,
        dmID: dmID,
        users: {
          connect: [{ id: userAID }, { id: userBID }],
        },
      },
    });
    return result;
  } catch (e) {
    throw e;
  }
}

export async function getUserChannelsUnreadInfo(
  uid: string,
  checkedChannelMessageIDs: Record<string, number>
): Promise<ChannelUnreadInfo> {
  const user = await prisma.user.findUnique({
    where: {
      id: uid,
    },
    select: {
      channels: {
        select: {
          id: true,
          messages: {
            take: 100,
            orderBy: {
              messageID: "desc",
            },
          },
        },
      },
    },
  });
  if (!user) {
    throw new Error(`cannot find user: ${uid}`);
  }

  const result = user.channels.reduce((prev: ChannelUnreadInfo, channel) => {
    const { messages, id } = channel;
    prev[id] = getReadInfo(
      uid,
      id,
      messages,
      checkedChannelMessageIDs
    ).unreadCount;
    return prev;
  }, {});

  return result;
}

function getReadInfo(
  uid: string,
  channelID: string,
  sortedMessages: Message[],
  localReadInfo: Record<string, number>
) {
  if (
    sortedMessages.length > 0 &&
    sortedMessages[sortedMessages.length - 1].messageType ===
      MessageType.ChannelStart
  ) {
    sortedMessages.pop();
  }

  const localReadMessageID = localReadInfo[channelID];
  const localReadIndex =
    typeof localReadMessageID !== "number"
      ? -1
      : sortedMessages.findIndex((m) => m.messageID === localReadMessageID);

  const userSendMessageIndex = sortedMessages.findIndex(
    (m) => m.userID === uid
  );
  const messageCountAfterUserSend =
    userSendMessageIndex === -1 ? sortedMessages.length : userSendMessageIndex;
  const messageCountAfterLocalRead =
    localReadIndex === -1 ? sortedMessages.length : localReadIndex;

  return {
    unreadCount: Math.min(
      messageCountAfterUserSend,
      messageCountAfterLocalRead
    ),
    readMessageID:
      messageCountAfterUserSend < messageCountAfterLocalRead
        ? sortedMessages[userSendMessageIndex]
        : localReadMessageID,
  };
}

export async function fetchChannelHistoryMessage(
  channelID: string,
  orderByDesc: boolean,
  cursorMessageID: number | undefined,
  take: number,
  skip: number
) {
  const cursor =
    typeof cursorMessageID === "number"
      ? { cursor: { messageID: cursorMessageID } }
      : {};
  return await prisma.channel.findUnique({
    where: { id: channelID },
    include: {
      messages: {
        skip: skip ?? 0,
        take: take ?? defaultMessagePageSize,
        orderBy: { messageID: orderByDesc ? "desc" : "asc" },
        ...cursor,
        include: {
          user: true,
        },
      },
    },
  });
}

// lastReadMessageID: undefined, return [0,1,2,3,4...]
// lastReadMessageID: 1, return [2,3,4...]
export async function fetchMessageAsc(
  channelID: string,
  messageIDCursor: number | undefined,
  take: number | undefined
) {
  return await fetchChannelHistoryMessage(
    channelID,
    false,
    messageIDCursor,
    take ?? defaultMessagePageSize,
    typeof messageIDCursor !== "number" ? 0 : 1
  );
}

// lastReadMessageID: undefined, return [3,2,1,0]
// lastReadMessageID: 2, return [1,0]
export async function fetchMessageDesc(
  channelID: string,
  messageIDCursor: number | undefined,
  take: number | undefined
) {
  return await fetchChannelHistoryMessage(
    channelID,
    true,
    messageIDCursor,
    take ?? defaultMessagePageSize,
    typeof messageIDCursor !== "number" ? 0 : 1
  );
}

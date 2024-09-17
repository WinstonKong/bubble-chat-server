import { Logger } from "../util";
import { prisma, store } from "./constant";

export async function initializeDB() {
  const latestMessageID = await prisma.message.findFirst({
    select: {
      messageID: true,
    },
    orderBy: {
      messageID: "desc",
    },
  });
  Logger.log(`latestMessageID: ${latestMessageID?.messageID}`);
  if (latestMessageID) {
    store.uniqueID = latestMessageID.messageID + 1;
  }
}

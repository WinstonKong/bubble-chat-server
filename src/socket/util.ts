import { MessageInfo, MessagesInfo } from "../types";

export function extractMessagesInfo(messages: MessageInfo[]) {
  return messages.reduce((prev: MessagesInfo, curr) => {
    prev[curr.id] = curr;
    return prev;
  }, {});
}

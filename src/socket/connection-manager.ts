import { Socket } from "socket.io";

export const onlineUsers = new Map<string, string>(); // socket.id => uid
export const userConnections = new Map<string, Set<Socket>>(); // uid => socket.id[]

export function getSocketsExcept(uids?: string[], socketID?: string) {
  const result: Socket[] = [];
  uids?.forEach((uid) => {
    userConnections.get(uid)?.forEach((socket) => {
      if (socket.id !== socketID) {
        result.push(socket);
      }
    });
  });
  return result;
}

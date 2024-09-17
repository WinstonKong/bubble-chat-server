import { Socket } from "socket.io";
import { updateBio, updateNickname } from "../data";
import { Logger } from "../util";
import { getSocketsExcept } from "./connection-manager";

export function onUpdateBio(socket: Socket) {
  socket.on("updateBio", (request: { uid: string; bio: string }, callBack) => {
    const { uid, bio } = request;
    if (bio.length > 190) {
      Logger.log("updateBio failed: bio is too long", bio.length, uid, bio);
      callBack?.({ ok: false });
      return;
    }
    updateBio(uid, bio)
      .then((user) => {
        if (!user) {
          Logger.log("updateBio failed", uid);
          callBack?.({ ok: false });
          return;
        }
        callBack?.({
          ok: true,
          data: user,
        });

        getSocketsExcept([uid], socket.id).forEach((userSocket) =>
          userSocket.emit("self", { data: user })
        );
      })
      .catch((e) => {
        Logger.log("updateBio error", uid, e);
        callBack?.({ ok: false });
      });
  });
}

export function onUpdateNickname(socket: Socket) {
  socket.on(
    "updateNickname",
    (request: { uid: string; nickname: string }, callBack) => {
      const { uid, nickname } = request;
      if (nickname.length > 63 || nickname.length < 1) {
        Logger.log(
          "updateNickname failed: nickname is too long or short",
          nickname.length,
          uid,
          nickname
        );
        callBack?.({ ok: false });
        return;
      }
      updateNickname(uid, nickname)
        .then((user) => {
          if (!user) {
            Logger.log("updateNickname failed", uid);
            callBack?.({ ok: false });
            return;
          }
          callBack?.({
            ok: true,
            data: user,
          });

          getSocketsExcept([uid], socket.id).forEach((userSocket) =>
            userSocket.emit("self", { data: user })
          );
        })
        .catch((e) => {
          Logger.log("updateNickname error", uid, e);
          callBack?.({ ok: false });
        });
    }
  );
}

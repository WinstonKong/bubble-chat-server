import { UserType } from "@prisma/client";
import { type UserCreateInfo } from "../types";
import { Logger } from "../util";
import { prisma } from "./constant";
import {
  DBUniqueConstraintError,
  isFailedUniqueConstraint,
  UserUsernameKey,
} from "./error";

export async function updateBio(uid: string, bio: string) {
  const result = await prisma.user.update({
    where: {
      id: uid,
    },
    data: {
      bio: bio,
    },
  });

  return result;
}

export async function updateNickname(uid: string, nickname: string) {
  const result = await prisma.user.update({
    where: {
      id: uid,
    },
    data: {
      nickname: nickname,
    },
  });

  return result;
}

export async function createUser(userInfo: UserCreateInfo) {
  try {
    const result = await prisma.user.create({
      data: { ...userInfo, userType: UserType.User },
    });
    return result;
  } catch (e) {
    if (isFailedUniqueConstraint(e, UserUsernameKey)) {
      throw new DBUniqueConstraintError("username");
    }
    Logger.log("createUser failed", e);
    throw e;
  }
}

export async function deleteUser(uid: string) {
  return await prisma.user.delete({
    where: {
      id: uid,
    },
  });
}

export async function getUser(uid: string) {
  return await prisma.user.findUnique({
    where: {
      id: uid,
    },
  });
}

export async function getUserByUsername(username: string) {
  const result = await prisma.user.findUnique({
    where: {
      username: username,
    },
  });
  return result;
}

export async function getUserInfo(uid: string) {
  const result = await prisma.user.findUnique({
    where: {
      id: uid,
    },
  });
  return result;
}

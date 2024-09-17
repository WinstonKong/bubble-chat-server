import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

export const FailedCodeUniqueConstraint = "P2002";
export const UserUsernameKey = "User_username_key";
export const ChannelDMIDKey = "Channel_dmID_key";

export class DBUniqueConstraintError extends Error {}

export function isFailedUniqueConstraint(error: any, key: string) {
  return (
    error instanceof PrismaClientKnownRequestError &&
    error.code === FailedCodeUniqueConstraint &&
    error.meta?.target === key
  );
}

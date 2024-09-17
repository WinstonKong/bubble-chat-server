import { PrismaClient } from "@prisma/client";

export const defaultMessagePageSize = 10;

export const store = {
  uniqueID: 0,
};

export const prisma = new PrismaClient({
  omit: {
    user: {
      password: true,
    },
  },
});

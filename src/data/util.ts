export function getDMID(userAID: string, userBID: string) {
  return userAID > userBID ? `${userAID}_${userBID}` : `${userBID}_${userAID}`;
}

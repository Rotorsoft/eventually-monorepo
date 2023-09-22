import { Firestore } from "@google-cloud/firestore";

export const dropCollection = async (
  db: Firestore,
  collection: string
): Promise<void> => {
  const ref = db.collection(`/${collection}`);
  const bulkWriter = db.bulkWriter();
  bulkWriter.onWriteError((error) => {
    if (error.failedAttempts < 3) {
      return true;
    } else {
      console.log(error);
      return false;
    }
  });
  await db.recursiveDelete(ref, bulkWriter);
  await bulkWriter.close();
};

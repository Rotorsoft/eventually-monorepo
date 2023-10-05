import { Firestore } from "@google-cloud/firestore";
import { config } from "./config";

export const create = (): Firestore =>
  new Firestore({
    projectId: config.gcp.projectId,
    ignoreUndefinedProperties: true,
    host: config.gcp.firestore?.host,
    port: config.gcp.firestore?.port,
    keyFilename: config.gcp.keyFilename
  });

export const dispose = async (db: Firestore): Promise<void> => {
  await db.terminate();
  return Promise.resolve();
};

export const drop = async (
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

import { PubSub, Topic as GoogleTopic } from "@google-cloud/pubsub";
import { config } from "./config";

export const Topic = async (streamName: string): Promise<GoogleTopic> => {
  const pubsub = new PubSub({
    projectId: config.gcp?.project,
    keyFilename: config.gcp?.keyfilename
  });
  const topic = new GoogleTopic(pubsub, streamName);
  const [exists] = await topic.exists();
  if (!exists) {
    await topic.create();
  }
  return topic;
};

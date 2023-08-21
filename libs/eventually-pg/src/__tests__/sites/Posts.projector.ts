import { InferProjector, client } from "@rotorsoft/eventually";
import { PostsSchemas } from "./schemas/Posts";

export const Posts = (): InferProjector<typeof PostsSchemas> => ({
  description: "TODO: describe this artifact!",
  schemas: PostsSchemas,
  on: {
    PostCreated: ({ stream, data }) => {
      return Promise.resolve([
        {
          id: data.slug,
          userId: data.userId,
          siteId: stream,
          title: data.title,
          published: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);
    },
    PostUpdated: async ({ data }, map) => {
      const { id, slug, ...rest } = data;
      if (slug && slug !== id) {
        const old = map.records.get(id) ?? (await client().read(Posts, id));
        return [{ id }, { ...old, ...rest, id: slug, updatedAt: new Date() }];
      }
      return [{ ...rest, id, updatedAt: new Date() }];
    },
    PostDeleted: ({ data }) => {
      return Promise.resolve([{ id: data.id }]);
    }
  }
});

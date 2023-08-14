import { InferAggregate, bind } from "@rotorsoft/eventually";
import { SiteSchemas } from "./schemas/Site";

export const Site = (stream: string): InferAggregate<typeof SiteSchemas> => ({
  description: "A web site where the stream id is the subdomain",
  stream,
  schemas: SiteSchemas,
  init: () => ({
    name: "",
    font: "",
    posts: {},
    userId: ""
  }),
  reduce: {
    SiteCreated: (state, { data }) => ({ ...data }),
    SiteUpdated: (state, { data }) => ({ ...data }),
    SiteDeleted: (state, { data }) => ({ ...data }),
    PostCreated: (state, { data }) => {
      const { slug, ...rest } = data;
      return { posts: { [slug]: rest } };
    },
    PostUpdated: (state, { data }) => {
      const { id, slug, ...rest } = data;
      const old = state.posts[id];
      const upd = { ...old, ...rest };
      if (slug && slug !== id) {
        // delete old entry when slug changes
        return {
          posts: {
            [id]: undefined,
            [slug]: upd
          }
        };
      }
      return { posts: { [id]: upd } };
    },
    PostDeleted: () => ({})
  },
  given: {
    CreateSite: [],
    UpdateSite: [],
    DeleteSite: [],
    CreatePost: [],
    UpdatePost: [],
    DeletePost: []
  },
  on: {
    CreateSite: (data, state) => {
      if (state.name) throw Error("Site already exists");
      return Promise.resolve([bind("SiteCreated", data)]);
    },
    UpdateSite: (data, state) => {
      if (!state.name) throw Error("Site not found");
      return Promise.resolve([bind("SiteUpdated", data)]);
    },
    DeleteSite: () => {
      return Promise.resolve([]);
    },
    CreatePost: (data, state) => {
      if (state.posts[data.slug]) throw Error("Post slug already exists");
      return Promise.resolve([bind("PostCreated", data)]);
    },
    UpdatePost: (data, state) => {
      const old = state.posts[data.id];
      if (!state.posts[data.id]) throw Error("Post not found");

      const { id: _, slug: __, ...rest } = data;
      const upd = { ...old, ...rest };
      const patched = JSON.stringify(old) !== JSON.stringify(upd);
      return Promise.resolve(patched ? [bind("PostUpdated", data)] : []);
    },
    DeletePost: () => {
      return Promise.resolve([]);
    }
  }
});

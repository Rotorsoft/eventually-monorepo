import { InferProjector } from "@rotorsoft/eventually";
import { SitesSchemas } from "./schemas/Sites";

export const Sites = (): InferProjector<typeof SitesSchemas> => ({
  description: "TODO: describe this artifact!",
  schemas: SitesSchemas,
  on: {
    SiteCreated: async ({ stream, data }) => {
      return Promise.resolve([
        {
          ...data,
          id: stream,
          font: "",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);
    },
    SiteUpdated: async ({ stream, data }) => {
      return Promise.resolve([{ ...data, id: stream, updatedAt: new Date() }]);
    },
    SiteDeleted: async ({ stream }) => {
      return Promise.resolve([{ id: stream }]);
    }
  }
});

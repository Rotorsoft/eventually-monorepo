import { ArtifactType, decamelize } from "@rotorsoft/eventually";

export const httpGetPath = (name: string): string =>
  "/".concat(decamelize(name), "/:id");

export const httpPostPath = (
  name: string,
  type: ArtifactType,
  message = ""
): string => {
  switch (type) {
    case "aggregate":
      return "/".concat(decamelize(name), "/:id/", decamelize(message));
    case "system":
      return "/".concat(decamelize(name), "/", decamelize(message));
    default:
      return "/".concat(decamelize(name));
  }
};

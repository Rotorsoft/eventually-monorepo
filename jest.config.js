/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*spec.ts"],
  modulePathIgnorePatterns: ["<rootDir>/.+/dist/.+"],
  testPathIgnorePatterns: ["<rootDir>/.+/dist/.+"]
};

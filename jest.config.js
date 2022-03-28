/* eslint-disable no-undef */
/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*spec.ts"],
  moduleNameMapper: {
    "^@rotorsoft/(.*)$": "<rootDir>/libs/$1/src"
  }
};

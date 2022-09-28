export const swagger = {
  openapi: "3.0.3",
  info: {
    title: "test",
    version: "1.3.3",
    description: "Service"
  },
  servers: [
    {
      url: "/"
    }
  ],
  tags: [
    {
      name: "System"
    }
  ],
  components: {
    parameters: {
      id: {
        in: "path",
        name: "id",
        description: "Reducible Id",
        schema: {
          type: "string"
        },
        required: true
      },
      stream: {
        in: "query",
        name: "stream",
        description: "Filter by stream name",
        schema: {
          type: "string"
        }
      },
      names: {
        in: "query",
        name: "names",
        description: "Filter by event names",
        schema: {
          type: "array",
          items: {
            type: "string"
          }
        }
      },
      after: {
        in: "query",
        name: "after",
        description: "Get all stream after this event id",
        schema: {
          type: "integer",
          default: -1
        }
      },
      limit: {
        in: "query",
        name: "limit",
        description: "Max number of events to query",
        schema: {
          type: "integer",
          default: 1
        }
      },
      before: {
        in: "query",
        name: "before",
        description: "Get all stream before this event id",
        schema: {
          type: "integer"
        }
      },
      created_after: {
        in: "query",
        name: "created_after",
        description: "Get all stream created after this date/time",
        schema: {
          type: "string",
          format: "date-time"
        }
      },
      created_before: {
        in: "query",
        name: "created_before",
        description: "Get all stream created before this date/time",
        schema: {
          type: "string",
          format: "date-time"
        }
      }
    },
    securitySchemes: {},
    schemas: {
      ValidationError: {
        type: "object",
        properties: {
          message: {
            type: "string",
            enum: ["ERR_VALIDATION"]
          },
          details: {
            type: "array",
            items: {
              type: "string"
            }
          }
        },
        required: ["message", "details"]
      },
      RegistrationError: {
        type: "object",
        properties: {
          message: {
            type: "string",
            enum: ["ERR_REGISTRATION"]
          },
          details: {
            type: "string"
          }
        }
      },
      ConcurrencyError: {
        type: "object",
        properties: {
          message: {
            type: "string",
            enum: ["ERR_CONCURRENCY"]
          },
          lastVersion: {
            type: "integer"
          },
          events: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string"
                },
                data: {
                  type: "object"
                }
              },
              required: ["name"]
            }
          },
          expectedVersion: {
            type: "integer"
          }
        },
        required: ["message", "lastEvent", "events", "expectedVersion"]
      },
      DeactivateProfile: {
        type: "object",
        properties: {
          profileId: {
            type: "string",
            format: "uuid"
          }
        },
        required: ["profileId"],
        additionalProperties: false
      },
      ActivateProfile: {
        type: "object",
        properties: {
          profileId: {
            type: "string",
            format: "uuid"
          }
        },
        required: ["profileId"],
        additionalProperties: false
      },
      DeleteProfile: {
        type: "object",
        properties: {
          profileId: {
            type: "string",
            format: "uuid"
          }
        },
        required: ["profileId"],
        additionalProperties: false
      },
      ProfileUpdated: {
        type: "object",
        properties: {
          name: {
            type: "string",
            enum: ["ProfileUpdated"]
          },
          id: {
            type: "integer"
          },
          stream: {
            type: "string"
          },
          version: {
            type: "integer"
          },
          created: {
            type: "string",
            format: "date-time"
          },
          data: {
            type: "object",
            properties: {
              profileId: {
                type: "string",
                format: "uuid"
              },
              location: {
                type: "object",
                properties: {
                  country: {
                    type: "string"
                  },
                  timezone: {
                    type: "string"
                  },
                  locale: {
                    type: "string"
                  }
                },
                required: ["country", "timezone", "locale"],
                additionalProperties: false
              },
              picture: {
                type: "string"
              }
            },
            required: ["profileId"],
            additionalProperties: false
          }
        },
        required: ["name", "id", "stream", "version", "created"],
        additionalProperties: false,
        description: "No description provided"
      },
      ProfileDeactivated: {
        type: "object",
        properties: {
          name: {
            type: "string",
            enum: ["ProfileDeactivated"]
          },
          id: {
            type: "integer"
          },
          stream: {
            type: "string"
          },
          version: {
            type: "integer"
          },
          created: {
            type: "string",
            format: "date-time"
          },
          data: {
            type: "object",
            properties: {
              profileId: {
                type: "string",
                format: "uuid"
              }
            },
            required: ["profileId"],
            additionalProperties: false
          }
        },
        required: ["name", "id", "stream", "version", "created"],
        additionalProperties: false,
        description: "No description provided"
      },
      ProfileActivated: {
        type: "object",
        properties: {
          name: {
            type: "string",
            enum: ["ProfileActivated"]
          },
          id: {
            type: "integer"
          },
          stream: {
            type: "string"
          },
          version: {
            type: "integer"
          },
          created: {
            type: "string",
            format: "date-time"
          },
          data: {
            type: "object",
            properties: {
              profileId: {
                type: "string",
                format: "uuid"
              }
            },
            required: ["profileId"],
            additionalProperties: false
          }
        },
        required: ["name", "id", "stream", "version", "created"],
        additionalProperties: false,
        description: "No description provided"
      },
      ProfileDeleted: {
        type: "object",
        properties: {
          name: {
            type: "string",
            enum: ["ProfileDeleted"]
          },
          id: {
            type: "integer"
          },
          stream: {
            type: "string"
          },
          version: {
            type: "integer"
          },
          created: {
            type: "string",
            format: "date-time"
          },
          data: {
            type: "object",
            properties: {
              profileId: {
                type: "string",
                format: "uuid"
              }
            },
            required: ["profileId"],
            additionalProperties: false
          }
        },
        required: ["name", "id", "stream", "version", "created"],
        additionalProperties: false,
        description: "No description provided"
      }
    }
  },
  paths: {
    "/stats": {
      get: {
        operationId: "getStats",
        summary: "Get Store Stats",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: {
                        type: "string"
                      },
                      count: {
                        type: "integer"
                      },
                      firstId: {
                        type: "integer"
                      },
                      lastId: {
                        type: "integer"
                      },
                      firstCreated: {
                        type: "string",
                        format: "date-time"
                      },
                      lastCreated: {
                        type: "string",
                        format: "date-time"
                      }
                    },
                    required: ["name", "count"],
                    additionalProperties: false
                  }
                }
              }
            }
          },
          default: {
            description: "Internal Server Error"
          }
        },
        security: [{}]
      }
    },
    "/all": {
      parameters: [
        {
          $ref: "#/components/parameters/stream"
        },
        {
          $ref: "#/components/parameters/names"
        },
        {
          $ref: "#/components/parameters/after"
        },
        {
          $ref: "#/components/parameters/limit"
        },
        {
          $ref: "#/components/parameters/before"
        },
        {
          $ref: "#/components/parameters/created_after"
        },
        {
          $ref: "#/components/parameters/created_before"
        }
      ],
      get: {
        operationId: "getAll",
        summary: "Query All Stream",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: {
                        type: "string"
                      },
                      id: {
                        type: "integer"
                      },
                      stream: {
                        type: "string"
                      },
                      version: {
                        type: "integer"
                      },
                      created: {
                        type: "string",
                        format: "date-time"
                      },
                      data: {
                        type: "object",
                        properties: {},
                        additionalProperties: false
                      }
                    },
                    required: ["name", "id", "stream", "version", "created"],
                    additionalProperties: false
                  }
                }
              }
            }
          },
          default: {
            description: "Internal Server Error"
          }
        },
        security: [{}]
      }
    },
    "/projector/project": {
      post: {
        operationId: "Project",
        tags: ["Projector"],
        summary: "Project Events",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ProfileUpdated"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {}
                }
              }
            }
          },
          default: {
            description: "Internal Server Error"
          }
        },
        security: [{}]
      }
    },
    "/profile-system/update-profile": {
      post: {
        operationId: "UpdateProfile",
        tags: ["System"],
        summary: "UpdateProfile",
        description: "Handles **UpdateProfile** Command",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/UpdateProfile"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {}
                }
              }
            }
          },
          "400": {
            description: "Validation Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ValidationError"
                }
              }
            }
          },
          "409": {
            description: "Concurrency Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ConcurrencyError"
                }
              }
            }
          },
          default: {
            description: "Internal Server Error"
          }
        },
        security: [{}]
      }
    },
    "/profile-system/deactivate-profile": {
      post: {
        operationId: "DeactivateProfile",
        tags: ["System"],
        summary: "DeactivateProfile",
        description: "Handles **DeactivateProfile** Command",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/DeactivateProfile"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {}
                }
              }
            }
          },
          "400": {
            description: "Validation Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ValidationError"
                }
              }
            }
          },
          "409": {
            description: "Concurrency Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ConcurrencyError"
                }
              }
            }
          },
          default: {
            description: "Internal Server Error"
          }
        },
        security: [{}]
      }
    },
    "/profile-system/activate-profile": {
      post: {
        operationId: "ActivateProfile",
        tags: ["System"],
        summary: "ActivateProfile",
        description: "Handles **ActivateProfile** Command",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ActivateProfile"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {}
                }
              }
            }
          },
          "400": {
            description: "Validation Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ValidationError"
                }
              }
            }
          },
          "409": {
            description: "Concurrency Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ConcurrencyError"
                }
              }
            }
          },
          default: {
            description: "Internal Server Error"
          }
        },
        security: [{}]
      }
    },
    "/profile-system/delete-profile": {
      post: {
        operationId: "DeleteProfile",
        tags: ["System"],
        summary: "DeleteProfile",
        description: "Handles **DeleteProfile** Command",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/DeleteProfile"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {}
                }
              }
            }
          },
          "400": {
            description: "Validation Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ValidationError"
                }
              }
            }
          },
          "409": {
            description: "Concurrency Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ConcurrencyError"
                }
              }
            }
          },
          default: {
            description: "Internal Server Error"
          }
        },
        security: [{}]
      }
    }
  }
};

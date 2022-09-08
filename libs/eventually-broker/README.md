# eventually-broker

[![NPM Version](https://img.shields.io/npm/v/@rotorsoft/eventually-broker.svg)](https://www.npmjs.com/package/@rotorsoft/eventually-broker)

[Eventually](../../README.md) Library implementing a simple message broker

## Services and Subscriptions

TODO: Documentation

## Service Graph

TODO: Documentation

## Correlation Explorer

TODO: Documentation

## Contract Explorer

The broker automatically polls HTTP services every 30 seconds at **GET** `/swagger` and expects a JSON representation of the OpenAPI Spec3. It uses this data to consolidate event contracts into a single view. The spec interpreter follows these simple conventions:

* All event schemas (consumed or produced) by the service are included in the spec components section `#/components/schemas`
* All event handler paths are represented as **POST** methods and include references `#ref` to **consumed** event schemas in the `requestBody`
* Events not found referenced by handler paths are considered events **produced** by this service
* All event schemas are object types with the following mandatory fields:
  * name: `string` - constrained by `enum` with the event name
  * created: `datetime`
  * data: `object` - event payload schema

### Example

```json
{
  "openapi": "3.0.3",
  "info": {
    "title": "calculator",
    "version": "1.0.0",
    "description": "Calculator API"
  },
  ...
  "components": {
     ...
    "schemas": {
      ... 
      "DigitPressed": {
        "type": "object",
        "properties": {
          "name": { "type": "string", "enum": ["DigitPressed"] },
          "id": { "type": "integer" },
          "stream": { "type": "string" },
          "version": { "type": "integer" },
          "created": { "type": "string", "format": "date-time" },
          "data": {
            "type": "object",
            "properties": {
              "digit": {
                "type": "string",
                "enum": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]
              }
            },
            "required": ["digit"],
            "additionalProperties": false
          }
        },
        "required": ["name", "id", "stream", "version", "created", "data"],
        "additionalProperties": false,
        "name": "DigitPressed",
        "description": "Generated when a **digit** is pressed\n\nThis is and example to use\n* markup language\n* inside descriptions"
      },
      "OperatorPressed": {
        "type": "object",
        "properties": {
          "name": { "type": "string", "enum": ["OperatorPressed"] },
          "id": { "type": "integer" },
          "stream": { "type": "string" },
          "version": { "type": "integer" },
          "created": { "type": "string", "format": "date-time" },
          "data": {
            "type": "object",
            "properties": {
              "operator": { "type": "string", "enum": ["+", "-", "*", "/"] }
            },
            "required": ["operator"],
            "additionalProperties": false
          }
        },
        "required": ["name", "id", "stream", "version", "created", "data"],
        "additionalProperties": false,
        "name": "OperatorPressed",
        "description": "Generated when operator is pressed"
      }
      ...
    }
  },
  "paths": {
    ...
    "/counter": {
      "post": {
        "operationId": "Counter",
        "tags": ["Counter"],
        "summary": "Handle Counter Events",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "oneOf": [
                  { "$ref": "#/components/schemas/DigitPressed" },
                  ...
                  { "$ref": "#/components/schemas/OperatorPressed" }
                ]
              }
            }
          }
        },
        ...
      }
    }
  }
}
```

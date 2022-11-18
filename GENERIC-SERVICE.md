# Generic Services

Steps to build a service from a generic template

- Create project

```bash
mkdir generic-service
cd generic-service
npm init -y
npm i @rotorsoft/eventually-service-expg @rotorsoft/calculator-artifacts
```

- Declare artifacts in `package.json`

```json
...
  "dependencies": {
    ...
  },
  "eventually": {
    "store": "calculator",
    "aggregates": {
      "Calculator": {
        "package": "@rotorsoft/calculator-artifacts",
        "description": "Generic Calculator Aggregate"
      }
    },
    "process-managers": {
      "Counter": {
        "package": "@rotorsoft/calculator-artifacts",
        "description": "Generic Counter Policy"
      }
    },
    "adapters": {
      "PressKeyAdapter": {
        "package": "@rotorsoft/calculator-artifacts",
        "description": "Generic PressKey Adapter"
      }
    }
  }
...  
```

- Run Service

```bash
node ./node_modules/@rotorsoft/eventually-service-expg/dist/index.js
```

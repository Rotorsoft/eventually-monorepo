# Generic Services

Steps to build a service from a generic template

- Create project

```bash
mkdir generic-service
cd generic-service
npm init -y
npm i @rotorsoft/eventually-service-expg @rotorsoft/calculator-artifacts
```

- Declare the artifacts you want to deploy in `package.json` under the `eventually` section
- Add a `start` script pointing to the generic service index

```json
{
    "name": "generic-service",
    "description": "Generic Service",
    "version": "1.0.0",
    "main": "index.js",
    "scripts": {
        "start": "node ./node_modules/@rotorsoft/eventually-service-expg/dist"
    },
    "author": {
        "name": "name",
        "email": "email@email.com"
    },
    "license": "ISC",
    "keywords": [],
    "dependencies": {
        "@rotorsoft/calculator-artifacts": "^0.1.1",
        "@rotorsoft/eventually-service-expg": "^0.1.1"
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
}
```

- Configure PG in `.env` file

```bash
LOG_LEVEL="info"
PG_HOST="localhost"
PG_USER="postgres"
PG_DATABASE="postgres"
PG_PASSWORD="postgres"
```

- Run Service

```bash
npm run start
```

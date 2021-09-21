## Eventually Monorepo

This is a Yarn2 based monorepo showing a simple recipe based on yarn workspaces and typescript project references.

- `/libs` - frameworks and shared libraries
- `/services` - micro services

A `calculator` sample service is provided as a template. We recommend using consistent project structures like the one below. Start by defining your models and validation schemas, then write your aggregates and policies. Follow TDD practices and the Test utility to acomplish 100% code coverage.

```bash
./src
  /__mocks__
  /__tests__
  /Aggregates
  /Policies
  /Projectors (optional)
  /Schemas
  App.ts
```

![Microservice Structure](./assets/microservice.png)

#### Setup

Full installation and configuration details can be found [here](https://yarnpkg.com/getting-started)

###### Installing Yarn

```bash
> npm install -g yarn
> cd ~/path/to/project
> yarn set version berry
```

###### Using Yarn

```bash
> yarn --version
> yarn help

# starting a new project
> cd ~/path/to/project
> yarn init -2

# adding dependencies
> yarn add [package]
> yarn add [package]@[version]
> yarn add [package]@[tag]

# adding dev and peer dependencies
> yarn add [package] --dev
> yarn add [package] --peer

# upgrading dependencies
> yarn up [package]
> yarn up [package]@[version]
> yarn up [package]@[tag]

# removing dependencies
> yarn remove [package]

# upgrading yarn
> yarn set version latest
> yarn set version from sources

# installing all dependencies
> yarn
> yarn install
```

###### Updating `.gitignore`

```bash
# Yarn 2
.yarn/*
!.yarn/cache
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/sdks
!.yarn/versions
```

###### Updating `.gitattributes`

```bash
/.yarn/releases/** binary
/.yarn/plugins/** binary
```

###### Configuring TypeScript with VSCode Integration

```bash
> yarn add --dev typescript
> yarn dlx @yarnpkg/sdks vscode

# to manage @types automatically
> yarn plugin import typescript

# to bump versions with yarn version
> yarn plugin import version

# to start new package in monorepo
> yarn ./path/to/package init

# to run commands inside package
> yarn ./path/to/package [command]
```

- Press `ctrl-shift-p` in a TS file
- Choose "Select TypeScript Version"
- Pick "Use Workspace Version"

###### Using PnP mode `.yarnrc.yml`

```bash
nodeLinker: pnp

plugins:
  - path: .yarn/plugins/@yarnpkg/plugin-typescript.cjs
    spec: "@yarnpkg/plugin-typescript"
  - path: .yarn/plugins/@yarnpkg/plugin-version.cjs
    spec: "@yarnpkg/plugin-version"

yarnPath: .yarn/releases/yarn-berry.cjs
```

###### Configuring the Monorepo

- Follow structure of base `package.json`. Pay attention to repository and workspaces
- Internal packages follow standard format, but you can reference other monorepo packages using `workspace:...` prefix like this `"@rotorsoft/eventually": "workspace:^1.0.0"`
- Follow structure of base `tsconfig.json`. Update references as you add more packages and dependencies between packages
- Internal packages inherit from common `tsconfig.base.json`, adding their own `composite` settings like below:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "tsBuildInfoFile": "./dist/.tsbuildinfo",
    "composite": true
  },
  "references": [
    { "path": "../../libs/eventually" },
    { "path": "../../libs/eventually-pg" }
  ],
  "include": ["src"],
  "exclude": ["**/__mocks__/**", "**/__tests__/**"]
}
```

### Configuring VS Code Icons

You can customize your workbech by copying the custom [vsicons](https://marketplace.visualstudio.com/items?itemName=vscode-icons-team.vscode-icons) and settings under `./vscode` to your local VSCode user directory. This will validate the folder structure and naming conventions we are proposing to follow when building new micro-services as shown below:

### Testing

Run `yarn ./services/calculator start` and you should see a running micro-service with blue command handlers and red event handlers ready to receive messages

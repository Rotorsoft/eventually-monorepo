# Yarn 2 Intallation

> Full Yarn 2 installation and configuration details can be found here: [https://yarnpkg.com/getting-started](https://yarnpkg.com/getting-started)

## Installing Yarn 2

```bash
> npm install -g yarn
> cd ~/path/to/project
```

## Using Yarn 2

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

## Updating `.gitignore`

```bash
# Yarn 2
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/sdks
```

## Updating `.gitattributes` for binary files

```bash
/.yarn/releases/** binary
/.yarn/plugins/** binary
```

## Configuring TypeScript with VSCode Integration

```bash
> yarn add --dev typescript
> yarn dlx @yarnpkg/sdks vscode

# to manage @types automatically
> yarn plugin import typescript

# to start new package in monorepo
> yarn ./path/to/package init

# to run commands inside package
> yarn ./path/to/package [command]
```

### In VSCode

- Press `ctrl-shift-p` in a TS file
- Choose "Select TypeScript Version"
- Pick "Use Workspace Version"

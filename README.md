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

![Microservice Structure](/assets/microservice.png)

#### Setup

TODO - steps to configure monorepo

### Configuring VS Code

You can customize your workbech by copying the custom [vsicons](https://marketplace.visualstudio.com/items?itemName=vscode-icons-team.vscode-icons) and settings under `./vscode` to your local VSCode user directory. This will validate the folder structure and naming conventions we are proposing to follow when building new micro-services as shown below:

### Testing

Run `yarn ./services/calculator start` and you should see a running micro-service with blue command handlers and red event handlers ready to receive messages

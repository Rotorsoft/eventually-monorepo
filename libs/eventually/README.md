# Eventually Framework

[![NPM Version](https://img.shields.io/npm/v/@rotorsoft/eventually.svg)](https://www.npmjs.com/package/@rotorsoft/eventually)

This project aims at exploring practical ideas around building reactive web services. Our goal is to provide a simple recipe grounded on well known methodologies, patterns, and tools.

## Methodologies, Patterns, and Tools

- [Domain Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html) - DDD
- [Event Storming](https://www.eventstorming.com/)
- [Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html)
- [Command Query Responsibility Segregation](https://martinfowler.com/bliki/CQRS.html) - CQRS
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [Yarn 2 Zero Installs](https://yarnpkg.com/features/zero-installs)- [Yarn 2 Plug'n'Play](https://yarnpkg.com/features/pnp)
- [Yarn 2 Workspaces](https://yarnpkg.com/features/workspaces) - Monorepo Structure
- [Test Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html) - TDD

## Logical Model

Software engineering should be approached as a “group learning process”, a close collaboration among clients, domain experts, and engineers that iteratively produces “clear business models” as the drivers of implementations - [source code should be seen as a side effect](https://www.lambdabytes.io/posts/selearning/). The deeper we can track these models within the implementation the better.

> Tackle complexity early by understanding the domain

Event Sourcing is a practical methodology used to model business processes. The nice thing about it is how easiliy models get tranferred to source code by 1-to-1 mappings of DDD artifacts to the common working patterns of any reactive system:

![Logical Model](./assets/flow.png)

## Value Proposition

This project is trying to answer the following questions:

- **Future Proof Single Source of Truth** - The “append-only” nature of event sourcing is an old and battle tested concept. The replayability aspect of it guarantees full auditability, integrability, and testability.

- **Transparent Model-To-Implementation Process** - Focus on transferring business models to code with minimal technical load. A “convention over configuration” philosophy removes tedious technical decision making from the process.

- **Ability to Swap Platform Services** - Abstractions before frameworks, protocols, or any other platform services.

## Building your first Micro-Service

> The anatomy of a micro-service should reflect the business model

From a technical perspective, reactive microservices encapsulate a small number of protocol-agnostic message handlers in charge of solving specific business problems. These handlers are grouped together logically according to a domain model, and can be optionally streamable or reducible to some kind of pesistent state if needed. The table below presents all practical options available and their proper mapping to DDD:

<table>
    <tr>
        <th>Message Handler</th>
        <th>Consumes</th>
        <th>Produces</th>
        <th style="text-align:center">Streamable</th>
        <th style="text-align:center">Reducible</th>
        <th>DDD Artifact</th>
    </tr>
    <tr>
        <td rowspan="2">Command Handlers</td>
        <td rowspan="2" style="color:cyan">Commands</td>
        <td rowspan="2" style="color:orange">Events</td>
        <td style="text-align:center">Yes</td>
        <td style="text-align:center">Yes</td>
        <td style="color:yellow">Aggregate</td>
    </tr>
    <tr>
        <td style="text-align:center">Yes</td>
        <td style="text-align:center">No</td>
        <td style="color:pink">External System</td>
    </tr>
    <tr>
        <td rowspan="2">Event Handlers</td>
        <td rowspan="2" style="color:orange">Events</td>
        <td rowspan="2" style="color:cyan">Commands</td>
        <td style="text-align:center">Yes</td>
        <td style="text-align:center">Yes</td>
        <td style="color:purple">Process Manager</td>
    </tr>
    </tr>
        <td style="text-align:center">No</td>
        <td style="text-align:center">No</td>
        <td style="color:purple">Policy</td>
    </tr>
</table>

> `Aggregates` define the consistency boundaries of business entities while `Process Managers` can expand those boundaries across many aggregates or systems.

### Public and Private Messages

`Commands` and `Events` can have either public of private scope.

Public messages are used for integrations with other micro-services by exposing public endpoints (e.g. HTTP POST).

- Public schemas are usually bigger and more stable
- Public events are published to the message broker with `at-least-once` delivery guarantees and are expected to be eventually consumed by either pub/sub or polling patterns

Private messages are limited to the boundaries of the micro-service

- Private messages get delivered synchronously (in-process) inside a single transaction context
- Private schemas are usually smaller and can change more frequently

The sequence below shows two `{{ applications }}` exchanging a public event triggered by an internal private flow within a `[[ transaction ]]` context:

command -> `{{ system1 -> [[ private-event1 -> policy1 -> private-command1 -> aggregate1 -> public-event1 ]] }}` ->

public-event1 -> `{{ policy2 -> private-command2 -> system2 -> [[ private-event2 ]] }}`

## Routing conventions (using REST protocol by default)

Public message handlers are routed by convention. Getters provide the current state of reducible artifacts, and can be used to audit their streams or for integrations via polling:

| Artifact        | Handler                                     | Getters                                                                |
| --------------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| Aggregate       | `POST /aggregate-type/:stream/command-name` | `GET /aggregate-type/:stream`<br/>`GET /aggregate-type/:stream/stream` |
| Process Manager | `POST /manager-type/event-name`             | `GET /manager-type/:stream`<br/>`GET /manager-type/:stream/stream`     |
| External System | `POST /system-type/command-name`            | `GET /all?stream=system-type`                                          |
| Policy          | `POST /policy-type/event-name`              | `N/A`                                                                  |
| All Stream      | `N/A`                                       | `GET /all?[stream=stream-type]&[name=event-name]&[after=-1]&[limit=1]` |

## Testing your code

We group unit tests inside `__tests__` folders. Tests should mainly focus on testing business logic and follow this basic pattern:

- `given` [messages] `when` [message] `expect` [state]

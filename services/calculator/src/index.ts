import { App, config } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { PostgresStore } from "@rotorsoft/eventually-pg";
//import { PubSubBroker } from "@rotorsoft/eventually-gcp";
import { commands } from "./calculator.commands";
import { Calculator } from "./calculator.aggregate";
import { events } from "./calculator.events";
import { Counter } from "./counter.policy";

const app = App(new ExpressApp());
void app
  .withEvents(events)
  .withCommands(commands)
  .withAggregate(Calculator)
  .withPolicy(Counter)
  .build({ store: PostgresStore() })
  .then((express) => {
    if (
      express.listen &&
      !config.host.endsWith("cloudfunctions.net/calculator")
    )
      express.listen(config.port, () => {
        app.log.info("white", "Express app is listening", config);
      });
  });

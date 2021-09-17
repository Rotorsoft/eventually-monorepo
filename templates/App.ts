import { App } from "@rotorsoft/eventually";
import { $CommandsFactory } from "./$.Commands";
import { $EventsFactory } from "./$.Events";
import { $AggregateOrPolicy } from "./$AggregateOrPolicy";

const app = App();

const routes = async (): Promise<void> => {
    await app.routeAggregate($, $CommandsFactory);
    await app.routePolicy($, $EventsFactory);
};

void routes().then(() => app.listen());
import { App } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";

App(new ExpressApp()).build();
void App().listen();

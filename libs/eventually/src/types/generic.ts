/**
 * Resource disposer function
 */
export type Disposer = () => Promise<void>;

/**
 * Resource Seeder function
 */
export type Seeder = () => Promise<void>;

export type CommandHandlerType = "aggregate" | "external-system";
export type EventHandlerType = "policy" | "process-manager" | "projector";

/**
 * Store stats
 */
export type StoreStat = {
  name: string;
  count: number;
  firstId?: number;
  lastId?: number;
  firstCreated?: Date;
  lastCreated?: Date;
};

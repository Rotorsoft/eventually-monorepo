export type Account = {
  readonly id: string;
};

export type ExternalAccount = {
  readonly id: string;
  readonly externalId: string;
};

export type WaitForAllState = {
  readonly id: string;
  readonly account1?: string;
  readonly account3?: string;
};

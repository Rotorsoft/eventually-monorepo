import z from "zod";

export const Account = z.object({
  id: z.string().min(1)
});

export const ExternalAccount = z.object({
  id: z.string().min(1),
  externalId: z.string().min(1)
});

export const WaitForAllStateSchema = z.object({
  account1: z.string().min(1).optional(),
  account3: z.string().min(1).optional()
});
export const WaitForAllRecordSchema = z.record(WaitForAllStateSchema);

export type WaitForAllState = z.infer<typeof WaitForAllStateSchema>;
export type WaitForAllRecord = z.infer<typeof WaitForAllRecordSchema>;

export type Commands = {
  CreateAccount1: z.infer<typeof Account>;
  CreateAccount2: z.infer<typeof Account>;
  CreateAccount3: z.infer<typeof Account>;
  CompleteIntegration: z.infer<typeof Account>;
};

export type Events = {
  AccountCreated: z.infer<typeof Account>;
  Account1Created: z.infer<typeof ExternalAccount>;
  Account2Created: z.infer<typeof ExternalAccount>;
  Account3Created: z.infer<typeof ExternalAccount>;
  IntegrationCompleted: z.infer<typeof Account>;
};

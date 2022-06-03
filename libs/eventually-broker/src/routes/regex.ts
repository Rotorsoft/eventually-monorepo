export const name = /^[a-z][a-z-0-9]*$/;
export const path = /^[a-z][a-z-0-9]*\/?$/;
export const pg_channel = /^pg:\/\/[a-z][a-z_0-9]*$/;
export const outbox_channel = /^outbox:\/\/[a-z][a-z_0-9]*$/;
export const cron_channel =
  /^cron:\/\/(@(weekly|daily|hourly))|(@every-(\d+(s|m|h))+)$/;
export const void_channel = /^void:\/\/$/;

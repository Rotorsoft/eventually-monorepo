export const DAY = 24 * 60 * 60 * 1000;
export const fromToday = (days: number): Date =>
  new Date(new Date().valueOf() + days * DAY);
export const addDays = (date: Date, days: number): Date =>
  new Date(date.valueOf() + days * DAY);

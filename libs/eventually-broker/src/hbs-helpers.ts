import { UnknownObject } from "express-handlebars/types";
import { formatDate, formatDateLocal, formatInt } from "./utils";

export const hbsHelpers: UnknownObject = {
  json: (context: any) => JSON.stringify(context),
  dateFormat: (date: Date) => formatDate(date),
  toDateFormat: (date: string) => formatDate(new Date(date)),
  fromISOToLocal: (date: Date) => formatDateLocal(date),
  intFormat: (int: number) => formatInt(int),
  inc: (val: number) => val + 1,
  and: (val1: any, val2: any) => val1 && val2,
  or: (val1: any, val2: any) => val1 || val2,
  eq: (val1: any, val2: any) => val1 === val2,
  includes: (val1: string[], val2: string) => val1 && val1.includes(val2),
  in: (val1: object, val2: string) => val2 in val1
};

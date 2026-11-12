const constructDateFrom = Symbol.for("constructDateFrom");

/** Preserve a server-supplied time zone without changing ordinary browser Dates. */
export function copyScheduleDate(date: Date): Date {
  const construct = (date as Date & { [constructDateFrom]?: (value: Date) => Date })[constructDateFrom];
  return construct ? construct.call(date, date) : new Date(date);
}

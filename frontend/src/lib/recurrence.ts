function lastDayOfMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function occurrenceDateForMonth(
  eventDate: string,
  recurrenceMonths: number | null,
  recurrenceUntil: string | null,
  selectedMonth: string,
) {
  const [eventYear, eventMonth, eventDay] = eventDate.split("-").map(Number);
  const [selectedYear, selectedMonthNumber] = selectedMonth.split("-").map(Number);
  const offset = (selectedYear - eventYear) * 12 + selectedMonthNumber - eventMonth;
  if (offset < 0 || (offset > 0 && (!recurrenceMonths || offset % recurrenceMonths !== 0))) return null;

  const day = Math.min(eventDay, lastDayOfMonth(selectedYear, selectedMonthNumber - 1));
  const occurrence = `${selectedMonth}-${String(day).padStart(2, "0")}`;
  return recurrenceUntil && occurrence > recurrenceUntil ? null : occurrence;
}

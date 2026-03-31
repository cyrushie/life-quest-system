export const APP_TIMEZONE = "Asia/Manila";
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const WEEKDAY_ORDER = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

export type WeekdayKey = (typeof WEEKDAY_ORDER)[number];

export function getTodayDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function dateFromKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function isValidDateKey(dateKey: string) {
  return DATE_KEY_PATTERN.test(dateKey);
}

export function getPastDateKey(daysBack: number) {
  const baseDate = dateFromKey(getTodayDateKey());
  baseDate.setUTCDate(baseDate.getUTCDate() - daysBack);
  return getDateKey(baseDate);
}

export function getEditableWindowStartDateKey() {
  return getPastDateKey(6);
}

export function getAccountCreatedDateKey(createdAt: Date) {
  return getDateKey(createdAt);
}

export function getEditableWindowStartDateKeyForAccount(createdAt: Date) {
  const accountCreatedKey = getAccountCreatedDateKey(createdAt);
  const recentWindowStartKey = getEditableWindowStartDateKey();

  return accountCreatedKey > recentWindowStartKey ? accountCreatedKey : recentWindowStartKey;
}

export function isDateKeyEditable(dateKey: string) {
  if (!isValidDateKey(dateKey)) {
    return false;
  }

  const todayKey = getTodayDateKey();
  const earliestEditableKey = getEditableWindowStartDateKey();

  return dateKey >= earliestEditableKey && dateKey <= todayKey;
}

export function isDateKeyEditableForAccount(dateKey: string, createdAt: Date) {
  if (!isValidDateKey(dateKey)) {
    return false;
  }

  const todayKey = getTodayDateKey();
  const earliestEditableKey = getEditableWindowStartDateKeyForAccount(createdAt);

  return dateKey >= earliestEditableKey && dateKey <= todayKey;
}

export function formatDisplayDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: APP_TIMEZONE,
  }).format(date);
}

export function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: APP_TIMEZONE,
  }).format(date);
}

export function getWeekdayKey(date: Date): WeekdayKey {
  const weekdayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: APP_TIMEZONE,
  }).format(date);

  return weekdayLabel.toUpperCase() as WeekdayKey;
}

export function formatWeekdayLabel(weekday: WeekdayKey) {
  return `${weekday.slice(0, 1)}${weekday.slice(1).toLowerCase()}`;
}

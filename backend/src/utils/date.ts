/**
 * date.ts
 * The frontend's mock data (and its types/index.ts) represents dates as
 * plain "YYYY-MM-DD" strings, never JS Date objects or full ISO timestamps.
 * Prisma returns real Dates for @db.Date columns — every mapper converts
 * through here so the API keeps returning exactly the string shape the UI
 * already renders directly into tables and inputs.
 */
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

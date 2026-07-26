// ============================================================
// services/holidayService.js
//
// Fetches Singapore public holidays from the official data.gov.sg
// open-data API (Ministry of Manpower dataset). This call is made
// SERVER-SIDE (from our Express backend) rather than from the browser,
// so the third-party API is invoked by our own application.
//
// Dataset: "Singapore Public Holidays (consolidated)" — covers 2020
// onwards and is updated annually, so the resource id below does not
// need to change year to year.
//
// API shape (CKAN datastore_search action, plain GET, no auth key):
//   https://data.gov.sg/api/action/datastore_search?resource_id=<id>&limit=<n>
// Response: { result: { records: [ { date, holiday, day, ... }, ... ] } }
// ============================================================

const HOLIDAY_DATASET_ID = "d_8ef23381f9417e4d4254ee8b4dcdb176";
const BASE_URL = "https://data.gov.sg/api/action/datastore_search";

// Simple in-memory cache so we don't hit data.gov.sg on every page load.
// Holidays change at most once a year, so a long TTL is fine.
let cache = { data: null, fetchedAt: 0 };
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Different yearly datasets have used slightly different column names
// ("date" vs "Date", "holiday" vs "Name"). Normalise defensively so the
// rest of the app always sees { date, name, day }.
function normaliseRecord(r) {
  const date = r.date || r.Date || r.holiday_date || "";
  const name = r.holiday || r.Name || r.name || r.holiday_name || "";
  const day = r.day || r.Day || "";
  return { date, name, day };
}

// Fetches the full holiday list (all years in the consolidated dataset).
// Returns an array of { date, name, day }. Throws on network / API failure
// so the controller can translate it into a clean user-facing message.
async function fetchAllHolidays() {
  const now = Date.now();
  if (cache.data && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  const url = `${BASE_URL}?resource_id=${HOLIDAY_DATASET_ID}&limit=500`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`data.gov.sg responded with HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!payload?.success || !payload?.result?.records) {
    throw new Error("Unexpected response shape from data.gov.sg");
  }

  const holidays = payload.result.records
    .map(normaliseRecord)
    .filter((h) => h.date); // drop anything without a usable date

  cache = { data: holidays, fetchedAt: now };
  return holidays;
}

// Convenience: only holidays on or after today, sorted ascending.
// Used by the stallholder page to show what's coming up.
async function fetchUpcomingHolidays() {
  const all = await fetchAllHolidays();

  // Compare on date-only (midnight) so "today" itself is still included.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return all
    .filter((h) => {
      const d = new Date(h.date);
      return !isNaN(d) && d >= today;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

module.exports = { fetchAllHolidays, fetchUpcomingHolidays };

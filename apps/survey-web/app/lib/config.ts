// Shared API base for the survey web app. Kept in its own module so helpers
// can use it without importing `api.ts` (which imports them back).
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://myanmarbeer.boom.com.mm/api'

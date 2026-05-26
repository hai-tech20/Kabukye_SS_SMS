/** Public school website base URL (React app on port 3000 in dev). */
export function getWebsiteUrl(): string {
  return process.env.NEXT_PUBLIC_WEBSITE_URL || 'http://localhost:3000';
}

export function getWebsiteReportsUrl(): string {
  return `${getWebsiteUrl().replace(/\/$/, '')}/reports`;
}

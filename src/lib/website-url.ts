/** Public school website base URL (React app on port 3000 in dev). */
export function getWebsiteUrl(): string {
  return process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://kabukyesecondaryschool.com';
}

export function getWebsiteReportsUrl(): string {
  return `${getWebsiteUrl().replace(/\/$/, '')}/reports`;
}

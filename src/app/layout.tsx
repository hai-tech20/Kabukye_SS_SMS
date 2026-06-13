import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { QueryProvider } from '@/components/providers/QueryProvider';

export const metadata: Metadata = {
  title: "Kabukye Secondary School SMS",
  description: "School Management System",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          <Providers>{children}</Providers>
        </QueryProvider>
      </body>
    </html>
  );
}

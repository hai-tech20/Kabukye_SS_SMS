import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { QueryProvider } from '@/components/providers/QueryProvider';

export const metadata: Metadata = {
  title: "Kabukye Secondary School SMS",
  description: "School Management System",
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

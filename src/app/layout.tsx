import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppProviders } from "@/core/providers";
import "./globals.css";

// Inter ships a Vietnamese subset, so diacritics render in the same font.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "Portal",
  description: "Cổng thông tin nội bộ",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

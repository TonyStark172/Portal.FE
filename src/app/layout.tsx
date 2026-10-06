import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppProviders } from "@/core/providers";
import { themeScript } from "@/shared/theme/theme";
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
    // The theme script sets the `dark` class before the first paint, so React must not flag the difference.
    <html lang="vi" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

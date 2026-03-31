import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Life Quest System",
  description:
    "A gamified task tracking system that turns daily routines into quests, levels, streaks, and private journaled progress.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

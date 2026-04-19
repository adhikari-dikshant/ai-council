import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Council",
  description: "Round-table intelligence. Multiple AI perspectives deliberating on your decisions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://ragetyping.com"),
  title: "Rage Typing — messages that self-destruct",
  description:
    "Type your rage. Stop, and a brutally honest sentence burns it away — therapist or sarcastic mirror.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://ragetyping.com";

const DESCRIPTION =
  "Vent your anger into a page that fights back. Type, stop, and one brutally honest sentence burns it away. Nothing you type is ever stored.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Rage Typing: type your anger, watch it burn",
    template: "%s | Rage Typing",
  },
  description: DESCRIPTION,
  applicationName: "Rage Typing",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    siteName: "Rage Typing",
    locale: "en_US",
    url: "/",
    title: "Rage Typing: type your anger, watch it burn",
    description: DESCRIPTION,
    images: [{ url: "/api/og", width: 1200, height: 630, alt: "Rage Typing" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rage Typing: type your anger, watch it burn",
    description: DESCRIPTION,
    images: ["/api/og"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
  colorScheme: "dark",
};

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Rage Typing",
  url: SITE,
  description: DESCRIPTION,
  applicationCategory: "EntertainmentApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript",
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  creator: {
    "@type": "Organization",
    name: "Cyberdine Systems",
    url: "https://www.cyberdinesystems.be/",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <script
          type="application/ld+json"
          // Static object defined above, so there is no user input to escape.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
      </body>
    </html>
  );
}

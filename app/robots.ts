import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://ragetyping.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Receipts are one-off, personal and noindex anyway; keep them out of crawls.
      disallow: ["/api/", "/receipt", "/r/", "/pass/"],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}

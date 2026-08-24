import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://ragetyping.com";

// One public page, so the sitemap is one entry. Add routes here as they appear.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}

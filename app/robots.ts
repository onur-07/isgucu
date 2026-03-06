import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://isgucu-s7i1.vercel.app";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/messages", "/notifications", "/orders", "/wallet"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}


import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://isgucu-s7i1.vercel.app";
  const now = new Date();

  const routes = [
    "/",
    "/about",
    "/blog",
    "/careers",
    "/categories/all",
    "/contact",
    "/freelancers",
    "/help",
    "/jobs",
    "/privacy",
    "/rules",
  ];

  return routes.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));
}


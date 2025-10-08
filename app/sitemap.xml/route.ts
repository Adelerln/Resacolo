import type { MetadataRoute } from "next";

const baseUrl = "https://mosaicflow.io";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/", "/features", "/pricing", "/about", "/contact"];
  const now = new Date().toISOString();

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: route === "/" ? 1 : 0.6,
  }));
}

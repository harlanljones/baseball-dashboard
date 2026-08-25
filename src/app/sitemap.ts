import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://mlb.harlanljones.com/",
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: "https://mlb.harlanljones.com/glossary",
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}

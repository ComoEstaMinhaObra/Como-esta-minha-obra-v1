import type { MetadataRoute } from "next";
import { publicEnv } from "@/config/env";
import { listarPosts } from "@/lib/blog";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const agora = new Date();

  const estaticas: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: agora, changeFrequency: "weekly", priority: 1 },
    {
      url: `${base}/precos`,
      lastModified: agora,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${base}/blog`,
      lastModified: agora,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${base}/termos`,
      lastModified: agora,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/politica-de-privacidade`,
      lastModified: agora,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/entrar`,
      lastModified: agora,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];

  const posts = listarPosts().map((p) => ({
    url: `${base}/blog/${p.slug}`,
    lastModified: new Date(p.date),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...estaticas, ...posts];
}

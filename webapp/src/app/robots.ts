import type { MetadataRoute } from "next";
import { publicEnv } from "@/config/env";

export default function robots(): MetadataRoute.Robots {
  const base = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/obras", "/conta", "/cobranca", "/c/", "/api/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}

import type { NextConfig } from "next";

const firebaseExport = process.env.FIREBASE_EXPORT === "1";

const nextConfig: NextConfig = {
  transpilePackages: ["@sk-mobile/shared"],
  ...(firebaseExport
    ? {
        output: "export",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;

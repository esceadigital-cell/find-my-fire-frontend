import type { NextConfig } from "next";

// Where Strapi is, from .env.local. Next.js only optimises images from addresses listed here.
const strapi = new URL(process.env.STRAPI_URL ?? "http://localhost:1337");
const strapiIsLocal = ["localhost", "127.0.0.1"].includes(strapi.hostname);

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            // Images uploaded to your own Strapi, e.g. http://localhost:1337/uploads/...
            {
                protocol: strapi.protocol === "https:" ? "https" : "http",
                hostname: strapi.hostname,
                port: strapi.port,
                pathname: "/uploads/**",
            },
            // Strapi Cloud keeps its images on a separate address, e.g. https://xyz.media.strapiapp.com/...
            { protocol: "https", hostname: "**.media.strapiapp.com" },
        ],
        // Required from Next.js 16: the image qualities that may be used (75 is the default)
        qualities: [75],
        dangerouslyAllowLocalIP: strapiIsLocal,
    },
};

export default nextConfig;

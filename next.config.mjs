import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig = {};

if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}

export default nextConfig;

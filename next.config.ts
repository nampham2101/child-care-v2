import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Photos move to Supabase Storage at v0.3.0, which is when `images.remotePatterns`
  // is needed. Nothing to configure while every asset is local.
};

export default nextConfig;

import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Photos move to Supabase Storage at v0.3.0, which is when `images.remotePatterns`
  // is needed. Nothing to configure while every asset is local.
};

// Wires next-intl into the build. With no argument it reads `./i18n/request.ts`.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);

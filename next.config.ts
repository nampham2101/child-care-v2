import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Images arrive with the admin UI in v0.4.0 — a Storage bucket and uploads of the rooms
  // and outdoor space, which is when `images.remotePatterns` is needed. v0.3.0 shipped with
  // no images at all, and none of them will be photographs of people: staff are monograms
  // by decision (see docs/PLAN.md). Nothing to configure until that bucket exists.
};

// Wires next-intl into the build. With no argument it reads `./i18n/request.ts`.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);

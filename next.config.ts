import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

/**
 * The one host `next/image` may fetch from: this project's Supabase Storage, and only the
 * public prefix of the one bucket that holds photographs of the spaces (#78).
 *
 * `remotePatterns` is an allow-list, and a loose one is a genuine hazard rather than untidiness
 * — `next/image` will fetch and re-serve anything it matches, so a wildcard host turns the
 * site's own image endpoint into an open proxy someone else can put bytes through. Hence the
 * exact host, and a `pathname` narrowed to `/storage/v1/object/public/spaces/**` rather than the
 * whole origin.
 *
 * Derived from `NEXT_PUBLIC_SUPABASE_URL` rather than hardcoded, so a Deploy Preview pointed at
 * a different project does not silently fail to render every image. It is read directly here
 * rather than through `readSupabaseConfig()` because this file is evaluated by the Next config
 * loader, outside the app's module graph and its `@/` alias.
 *
 * **If the variable is absent the array is empty**, which makes `next/image` refuse every remote
 * URL. That is the right failure: the build stops on the image rather than quietly serving
 * whatever a mistyped host resolves to. It cannot happen in CI or on Netlify, where the variable
 * is required by `readSupabaseConfig()` long before this matters.
 */
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseOrigin
      ? [
          {
            protocol: "https",
            hostname: new URL(supabaseOrigin).hostname,
            pathname: "/storage/v1/object/public/spaces/**",
          },
        ]
      : [],
  },
};

// Wires next-intl into the build. With no argument it reads `./i18n/request.ts`.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);

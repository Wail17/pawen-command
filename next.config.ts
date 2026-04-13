import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SECURITY: never ship source maps in production — prevents reverse-engineering
  productionBrowserSourceMaps: false,

  // Security headers — applied to all routes
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        // Prevent clickjacking
        { key: 'X-Frame-Options', value: 'DENY' },
        // Block MIME-type sniffing
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        // Restrict referrer leakage
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        // Prevent XSS reflection (legacy browsers)
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        // DNS prefetch control
        { key: 'X-DNS-Prefetch-Control', value: 'off' },
        // Restrict browser features
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
        },
        // Strict Transport Security (1 year, include subdomains)
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains; preload',
        },
      ],
    },
    {
      // Extra headers on API routes — discourage automated scraping
      source: '/api/:path*',
      headers: [
        { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
      ],
    },
  ],

  // Turbopack — required in Next.js 16 when a webpack config exists
  turbopack: {},

  // Webpack customization — strip comments + console.log in prod (webpack fallback only)
  webpack: (config, { isServer }) => {
    if (!isServer && process.env.NODE_ENV === 'production') {
      // Minimize client bundle — strip comments, dead code
      const terserPlugin = config.optimization?.minimizer?.find(
        (p: { constructor?: { name?: string } }) => p?.constructor?.name === 'TerserPlugin',
      );
      if (terserPlugin && terserPlugin.options?.minimizer?.options) {
        terserPlugin.options.minimizer.options.compress = {
          ...terserPlugin.options.minimizer.options.compress,
          drop_console: true,  // strip console.log from client bundle
          passes: 2,
        };
      }
    }
    return config;
  },
};

export default nextConfig;

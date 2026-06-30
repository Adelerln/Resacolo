import path from 'node:path';
import { fileURLToPath } from 'node:url';

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const sparticuzChromiumBinIncludes = [
  'node_modules/@sparticuz/chromium/bin/**',
  'node_modules/@sparticuz/chromium/build/**',
  'node_modules/@sparticuz/chromium/package.json'
];
const playwrightRuntimeIncludes = [
  ...sparticuzChromiumBinIncludes,
  'node_modules/playwright-core/**',
  'node_modules/playwright-core/browsers.json'
];
const stayImportRouteTracing = {
  '/api/import-stay': playwrightRuntimeIncludes,
  '/api/import-stay/route': playwrightRuntimeIncludes,
  '/api/stay-drafts/[id]/run-import': playwrightRuntimeIncludes,
  '/api/stay-drafts/[id]/run-import/route': playwrightRuntimeIncludes
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? ''
  },
  transpilePackages: ['framer-motion'],
  serverExternalPackages: ['@sparticuz/chromium', 'playwright-core'],
  output: 'standalone',
  outputFileTracingRoot: projectRoot,
  outputFileTracingIncludes: stayImportRouteTracing,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com'
      },
      {
        protocol: 'http',
        hostname: 'www.thalie.eu'
      },
      {
        protocol: 'https',
        hostname: 'www.thalie.eu'
      },
      {
        protocol: 'http',
        hostname: 'thalie.eu'
      },
      {
        protocol: 'https',
        hostname: 'thalie.eu'
      },
      {
        protocol: 'https',
        hostname: 'resacolo.com'
      },
      {
        protocol: 'https',
        hostname: 'www.choisirsacolo.fr'
      },
      {
        protocol: 'https',
        hostname: 'www.cesl.fr'
      },
      {
        protocol: 'https',
        hostname: 'cesl.fr'
      },
      {
        protocol: 'http',
        hostname: 'www.zigotours.com'
      },
      {
        protocol: 'https',
        hostname: 'www.zigotours.com'
      },
      {
        protocol: 'http',
        hostname: 'zigotours.com'
      },
      {
        protocol: 'https',
        hostname: 'zigotours.com'
      },
      ...(supabaseHostname
        ? [
            {
              protocol: 'https',
              hostname: supabaseHostname
            }
          ]
        : [])
    ]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb'
    },
    turbopack: {
      root: projectRoot
    }
  }
};

export default nextConfig;

import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

export default function nextConfig(phase) {
  const isDevServer = phase === PHASE_DEVELOPMENT_SERVER;

  /** @type {import('next').NextConfig} */
  return {
    distDir: isDevServer ? '.next-dev' : '.next',
    output: 'standalone',
    images: {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'images.unsplash.com'
        },
        {
          protocol: 'https',
          hostname: 'resacolo.com'
        },
        {
          protocol: 'https',
          hostname: 'www.choisirsacolo.fr'
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
      }
    }
  };
}

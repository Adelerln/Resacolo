const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['framer-motion'],
  output: 'standalone',
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

export default nextConfig;

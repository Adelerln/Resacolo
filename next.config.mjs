const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

export default function nextConfig() {
  /** @type {import('next').NextConfig} */
  return {
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

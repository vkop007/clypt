import type { NextConfig } from 'next';

const basePath = process.env.BASE_PATH ?? '';

const nextConfig: NextConfig = {
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  serverExternalPackages: [],
  // Bundle the yt-dlp binary into every API route that spawns it.
  // Required for Vercel: file tracing must be explicit for non-JS assets.
  outputFileTracingIncludes: {
    '/api/videos/download': ['./bin/**'],
    '/api/videos/fetch': ['./bin/**'],
  },
  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: ['*.replit.dev', '*.pike.replit.dev', '*.repl.co'],
  }),
};

export default nextConfig;

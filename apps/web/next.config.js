/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    remotePatterns: [],
    unoptimized: true, // For local file serving
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    ONEC_URL: process.env.ONEC_URL,
    ONEC_USER: process.env.ONEC_USER,
    ONEC_PASSWORD: process.env.ONEC_PASSWORD,
    JWT_SECRET: process.env.JWT_SECRET,
    APP_URL: process.env.APP_URL,
    UPLOAD_DIR: process.env.UPLOAD_DIR || '/app/apps/web/uploads',
  },
};

module.exports = nextConfig;

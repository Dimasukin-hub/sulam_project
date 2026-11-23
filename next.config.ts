import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  reactCompiler: true,
  devIndicators: false,
  // Di VPS production, aset Next.js dilayani melalui reverse proxy subpath /sulam/_next/
  assetPrefix: isProd ? '/sulam' : undefined,
};

export default nextConfig;


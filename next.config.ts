import type { NextConfig } from "next";

const allowedDevOrigins = [
  'localhost',
  '127.0.0.1',
]

if (process.env.NEXT_DEV_ALLOWED_ORIGIN) {
  allowedDevOrigins.push(process.env.NEXT_DEV_ALLOWED_ORIGIN)
}

const nextConfig: NextConfig = {
  allowedDevOrigins,
};

export default nextConfig;

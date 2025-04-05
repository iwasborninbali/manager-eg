import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        // port: '', // Optional: Add port if needed
        // pathname: '/**', // Optional: Allow any path
      },
    ],
  },
};

export default nextConfig;

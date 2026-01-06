/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@prediction-club/chain',
    '@prediction-club/db',
    '@prediction-club/shared',
    '@prediction-club/ui',
  ],
};

module.exports = nextConfig;

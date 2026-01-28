/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@prediction-club/db', '@prediction-club/shared', '@prediction-club/ui'],
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push('pino-pretty', 'lokijs', 'encoding', '@react-native-async-storage/async-storage');
    return config;
  },
};

module.exports = nextConfig;

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.reuters.com' },
      { protocol: 'https', hostname: '*.bloomberg.com' },
      { protocol: 'https', hostname: '*.ft.com' },
      { protocol: 'https', hostname: '*.wsj.com' },
      { protocol: 'https', hostname: '*.apnews.com' },
      { protocol: 'https', hostname: '*.nytimes.com' },
      { protocol: 'https', hostname: '*.economist.com' },
      { protocol: 'https', hostname: '*.xinhuanet.com' },
      { protocol: 'https', hostname: '*.theguardian.com' },
      { protocol: 'https', hostname: '*.bbc.co.uk' },
      { protocol: 'https', hostname: '*.cnn.com' },
      { protocol: 'https', hostname: '*.aljazeera.com' },
      { protocol: 'https', hostname: 'news.google.com' },
    ],
  },
};

export default nextConfig;

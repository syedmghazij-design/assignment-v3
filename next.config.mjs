/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages (aur koi bhi static host) ke liye static export
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;

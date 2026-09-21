/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  distDir: 'out',
  // Static export cannot run the on-demand image optimizer, so the default
  // `/_next/image` loader 404s. Serve images as-is instead.
  images: { unoptimized: true },
}

export default nextConfig
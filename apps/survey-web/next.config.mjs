/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  // Do NOT set distDir here. With Next 16 the dev server writes its
  // workspace into <distDir>/dev, so distDir:'out' would litter the static
  // export with dev chunks/source maps and fail scripts/check-artifacts.mjs
  // whenever `next dev` is running. Build intermediates stay in .next and
  // `output: 'export'` still emits the site to out/.
  images: { unoptimized: true },
}

export default nextConfig
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@gf/shared"],
  output: "standalone"
};

module.exports = nextConfig;

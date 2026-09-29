import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Les erreurs de type bloquent le build (tsc --noEmit doit passer en local/CI).
  typescript: {
    ignoreBuildErrors: false,
  },
  // StrictMode : détecte les effets montés deux fois et les updaters impurs en développement.
  reactStrictMode: true,
};

export default nextConfig;

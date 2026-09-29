import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // La page /reset-password est ouverte avec un jeton à usage unique dans l'URL : aucun Referer (ni la
        // page elle-même, ni une ressource ou un lien externe chargé depuis elle) ne doit jamais le porter.
        source: "/reset-password",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;

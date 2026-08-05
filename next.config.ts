import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // evita que o Turbopack suba até C:\Users\Usuario por causa de um package-lock.json solto lá
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;

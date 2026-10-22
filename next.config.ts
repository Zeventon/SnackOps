import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  outputFileTracingIncludes: { "/*": ["./data/**/*.json", "./skills/**/*.md", "./src/lib/studio/engine.ts"] },
};
export default config;

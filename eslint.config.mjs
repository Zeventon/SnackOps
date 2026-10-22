import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([...nextVitals, ...nextTs,
  { files: ["src/lib/studio/**/*.ts", "src/components/studio/**/*.tsx", "src/app/studio/**/*.tsx", "src/app/api/studio/**/*.ts"], rules: { "@typescript-eslint/no-explicit-any": "off", "react-hooks/set-state-in-effect": "off" } },
  globalIgnores([".next/**", "next-env.d.ts", ".verification/**"])]);

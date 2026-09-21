// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// Explicitly populate process.env from .env file so Vite dev server handlers have access to server-side keys
const env = loadEnv("development", process.cwd(), "");
for (const [key, value] of Object.entries(env)) {
  if (!(key in process.env)) {
    process.env[key] = value;
  }
}

// Detect preset from environment:
// If building on Vercel (process.env.VERCEL is set) or NITRO_PRESET is specified, use that preset.
const preset = process.env.NITRO_PRESET || (process.env.VERCEL ? "vercel" : undefined);

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  ...(preset
    ? {
        nitro: {
          preset,
        },
      }
    : {}),
});


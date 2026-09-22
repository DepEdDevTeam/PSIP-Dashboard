import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
// This is intentionally a plain Vite/Vinext configuration so the app can be
// built by Vercel. Cloudflare/Wrangler bindings belong in a separate adapter.
export default defineConfig({
    css: { postcss: { plugins: [tailwindcss()] } },
    plugins: [vinext()],
});

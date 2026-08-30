import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// `webapp/public/{images,music,sounds}` are SYMLINKS to the folders of the same
// name at the repo root, so `npm run dev` serves `/images/...` at the same
// absolute paths the deployed site uses.
//
// On `build`, Vite would follow those symlinks and copy every file through into
// `dist/` — 41MB of images, music and sound effects duplicated next to the
// originals they point at, turning a ~2MB build into a 43MB one. In production
// those exact folders already sit at the domain root, so the copies would be
// shadowing themselves.
//
// `copyPublicDir: false` is the right lever, NOT `publicDir: false`. publicDir
// is also what RESOLVES a root-relative asset URL: a static `<img src="/images/
// logo.png">` in an SFC template is treated as an import, and turning publicDir
// off entirely makes the build fail to resolve it. This keeps the resolution
// and skips only the copy — the documented case where the public directory is
// deployed separately from the bundle.
export default defineConfig({
  plugins: [vue()],
  server: { port: 5174 },
  build: {
    outDir: 'dist',
    sourcemap: false,
    copyPublicDir: false
  }
})

// Copy the built frontend (frontend/dist) into backend/src/public so the
// Express server can serve it in production. Cross-platform (no shell cp).
const fs = require('fs')
const path = require('path')

const src = path.resolve(__dirname, '..', '..', 'frontend', 'dist')
const dest = path.resolve(__dirname, '..', 'src', 'public')

if (!fs.existsSync(src)) {
  console.error(`[copyClient] frontend build not found at ${src}. Run the frontend build first.`)
  process.exit(1)
}

// fs.cpSync (Node 16.7+) copies recursively and is available on all platforms.
fs.rmSync(dest, { recursive: true, force: true })
fs.cpSync(src, dest, { recursive: true })

console.log(`[copyClient] copied ${src} -> ${dest}`)

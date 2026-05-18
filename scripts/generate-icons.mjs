import sharp from '../node_modules/sharp/lib/index.js'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dirname, '../public')

function makeSVG(size) {
  const pad = Math.round(size * 0.15)
  const inner = size - pad * 2
  const radius = Math.round(size * 0.22)
  const fontSize = Math.round(size * 0.38)
  const letterSpacing = Math.round(size * 0.01)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f1623"/>
      <stop offset="100%" style="stop-color:#030712"/>
    </linearGradient>
    <linearGradient id="text" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#4ade80"/>
      <stop offset="100%" style="stop-color:#16a34a"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bg)"/>

  <!-- Subtle green glow circle -->
  <circle cx="${size / 2}" cy="${size / 2}" r="${Math.round(size * 0.35)}" fill="#22c55e" opacity="0.07"/>

  <!-- GB letters -->
  <text
    x="${size / 2}"
    y="${Math.round(size * 0.645)}"
    font-family="'Arial Black', 'Helvetica Neue', Arial, sans-serif"
    font-weight="900"
    font-size="${fontSize}"
    letter-spacing="${letterSpacing}"
    text-anchor="middle"
    fill="url(#text)"
  >GB</text>

  <!-- Small dot accent -->
  <circle cx="${Math.round(size * 0.72)}" cy="${Math.round(size * 0.3)}" r="${Math.round(size * 0.04)}" fill="#22c55e" opacity="0.8"/>
</svg>`
}

async function generate(size, filename) {
  const svg = Buffer.from(makeSVG(size))
  await sharp(svg).png().toFile(`${publicDir}/${filename}`)
  console.log(`✓ ${filename} (${size}x${size})`)
}

await generate(192, 'icon-192x192.png')
await generate(512, 'icon-512x512.png')
console.log('Icons written to public/')

import sharp from 'sharp'
import { NextResponse } from 'next/server'

const TARGET_WIDTH = 6000
const TARGET_HEIGHT = 8000

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('image') as File | null
    const format = (formData.get('format') as string) || 'png'

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    if (!['png', 'jpeg'].includes(format)) {
      return NextResponse.json({ error: 'Format must be png or jpeg' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const image = sharp(buffer)
    const meta = await image.metadata()

    const srcWidth = meta.width ?? 0
    const srcHeight = meta.height ?? 0

    if (srcWidth === 0 || srcHeight === 0) {
      return NextResponse.json({ error: 'Could not read image dimensions' }, { status: 400 })
    }

    // Determine resize dimensions that preserve aspect ratio and fit within target
    const srcRatio = srcWidth / srcHeight
    const targetRatio = TARGET_WIDTH / TARGET_HEIGHT

    let resizeWidth: number
    let resizeHeight: number

    if (srcRatio > targetRatio) {
      resizeWidth = TARGET_WIDTH
      resizeHeight = Math.round(TARGET_WIDTH / srcRatio)
    } else {
      resizeHeight = TARGET_HEIGHT
      resizeWidth = Math.round(TARGET_HEIGHT * srcRatio)
    }

    // Lanczos3 is the gold-standard for upscaling — no AI hallucination, pure math interpolation
    const resized = image.resize(resizeWidth, resizeHeight, {
      kernel: sharp.kernel.lanczos3,
      fit: 'fill',
      withoutEnlargement: false,
    })

    let outputBuffer: Buffer
    let contentType: string
    let ext: string

    if (format === 'jpeg') {
      outputBuffer = await resized.jpeg({ quality: 95, mozjpeg: true }).toBuffer()
      contentType = 'image/jpeg'
      ext = 'jpg'
    } else {
      outputBuffer = await resized.png({ compressionLevel: 6 }).toBuffer()
      contentType = 'image/png'
      ext = 'png'
    }

    return new Response(new Uint8Array(outputBuffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="upscaled-${resizeWidth}x${resizeHeight}.${ext}"`,
        'Content-Length': String(outputBuffer.byteLength),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Upscale error:', err)
    return NextResponse.json({ error: 'Failed to upscale image' }, { status: 500 })
  }
}

export const config = {
  api: { bodyParser: false },
}

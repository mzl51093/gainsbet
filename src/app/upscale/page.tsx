'use client'

import { useState, useRef, useCallback } from 'react'

const TARGET_WIDTH = 6000
const TARGET_HEIGHT = 8000

export default function UpscalePage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null)
  const [format, setFormat] = useState<'png' | 'jpeg'>('png')
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [outputDims, setOutputDims] = useState<{ w: number; h: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((f: File) => {
    setFile(f)
    setStatus('idle')
    setError(null)
    setOutputDims(null)

    const url = URL.createObjectURL(f)
    setPreview(url)

    const img = new Image()
    img.onload = () => {
      setDimensions({ w: img.naturalWidth, h: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.src = url
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const f = e.dataTransfer.files[0]
      if (f && f.type.startsWith('image/')) handleFile(f)
    },
    [handleFile],
  )

  const handleUpscale = async () => {
    if (!file) return
    setStatus('processing')
    setError(null)

    try {
      const body = new FormData()
      body.append('image', file)
      body.append('format', format)

      const res = await fetch('/api/upscale', { method: 'POST', body })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error || `Server error ${res.status}`)
      }

      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="upscaled-(\d+)x(\d+)/)
      if (match) setOutputDims({ w: parseInt(match[1]), h: parseInt(match[2]) })

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `upscaled-print.${format === 'jpeg' ? 'jpg' : 'png'}`
      a.click()
      URL.revokeObjectURL(url)
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  const srcRatio = dimensions ? dimensions.w / dimensions.h : null
  const targetRatio = TARGET_WIDTH / TARGET_HEIGHT
  const previewDims =
    srcRatio !== null
      ? srcRatio > targetRatio
        ? { w: TARGET_WIDTH, h: Math.round(TARGET_WIDTH / srcRatio) }
        : { w: Math.round(TARGET_HEIGHT * srcRatio), h: TARGET_HEIGHT }
      : null

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-xl space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Print Upscaler</h1>
          <p className="text-sm text-gray-400">
            Upscales to fit within {TARGET_WIDTH.toLocaleString()}×{TARGET_HEIGHT.toLocaleString()}px using Lanczos3
            resampling — no AI, no hallucination.
          </p>
        </div>

        {/* Drop zone */}
        <div
          className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer ${
            file ? 'border-gray-700 bg-gray-900' : 'border-gray-700 hover:border-gray-500 bg-gray-900/50'
          }`}
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          {preview && dimensions ? (
            <div className="p-4 space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Preview"
                className="w-full rounded-lg object-contain max-h-80"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>
                  Source: {dimensions.w.toLocaleString()}×{dimensions.h.toLocaleString()}px
                </span>
                {previewDims && (
                  <span>
                    Output: {previewDims.w.toLocaleString()}×{previewDims.h.toLocaleString()}px
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="py-16 flex flex-col items-center gap-3 text-gray-500">
              <svg
                className="w-10 h-10"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5V19a1.5 1.5 0 001.5 1.5h15A1.5 1.5 0 0021 19v-2.5M12 3v13m0 0l-4-4m4 4l4-4"
                />
              </svg>
              <span className="text-sm">Drop image here or click to browse</span>
              <span className="text-xs">JPEG, PNG, WebP, TIFF</span>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />
        </div>

        {/* Format selector */}
        {file && (
          <div className="flex gap-3">
            <button
              onClick={() => setFormat('png')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                format === 'png'
                  ? 'bg-white text-gray-950 border-white'
                  : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500'
              }`}
            >
              PNG — lossless
            </button>
            <button
              onClick={() => setFormat('jpeg')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                format === 'jpeg'
                  ? 'bg-white text-gray-950 border-white'
                  : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500'
              }`}
            >
              JPEG 95% — smaller file
            </button>
          </div>
        )}

        {/* Action */}
        {file && (
          <button
            onClick={handleUpscale}
            disabled={status === 'processing'}
            className="w-full py-3 rounded-xl bg-white text-gray-950 font-semibold text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'processing' ? 'Processing…' : 'Upscale & Download'}
          </button>
        )}

        {/* Status messages */}
        {status === 'done' && outputDims && (
          <p className="text-sm text-green-400 text-center">
            Download started — {outputDims.w.toLocaleString()}×{outputDims.h.toLocaleString()}px {format.toUpperCase()}
          </p>
        )}
        {status === 'error' && error && (
          <p className="text-sm text-red-400 text-center">{error}</p>
        )}

        {/* Info box */}
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-2 text-xs text-gray-400">
          <p className="font-medium text-gray-300">How it works</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Lanczos3 kernel — same algorithm used by professional print workflows</li>
            <li>No neural upscaling, no hallucinated details — pixel-perfect math only</li>
            <li>Aspect ratio preserved; longest edge fits the {TARGET_WIDTH.toLocaleString()}×{TARGET_HEIGHT.toLocaleString()} target</li>
            <li>PNG is lossless (ideal for further editing); JPEG 95% is smaller</li>
          </ul>
        </div>
      </div>
    </main>
  )
}

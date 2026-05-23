'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  proofUrl: string
  proofType: string | null
}

function parseProofPaths(proofUrl: string): string[] {
  try {
    const parsed = JSON.parse(proofUrl)
    if (Array.isArray(parsed)) return parsed
  } catch {}
  return [proofUrl]
}

export default function ProofViewer({ proofUrl, proofType }: Props) {
  const [signedUrls, setSignedUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [error, setError] = useState('')

  const paths = parseProofPaths(proofUrl)
  const isMulti = paths.length > 1

  async function handleView(startIndex = 0) {
    setActiveIndex(startIndex)
    if (signedUrls.length > 0) { setOpen(true); return }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const results = await Promise.all(
      paths.map(path =>
        supabase.storage.from('workout-proofs').createSignedUrl(path, 60 * 60)
      )
    )

    const urls = results.map(r => r.data?.signedUrl || '').filter(Boolean)
    if (urls.length === 0) {
      setError('Could not load proof')
      setLoading(false)
      return
    }

    setSignedUrls(urls)
    setOpen(true)
    setLoading(false)
  }

  const proofEmoji = proofType === 'whoop' ? '⌚' : proofType === 'screenshot' ? '📱' : '📸'

  return (
    <>
      {isMulti ? (
        <div className="flex items-center gap-2 flex-wrap">
          {paths.map((_, i) => (
            <button
              key={i}
              onClick={() => handleView(i)}
              disabled={loading}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <span>{proofEmoji}</span>
              <span>{loading ? 'Loading…' : `Photo ${i + 1}`}</span>
            </button>
          ))}
        </div>
      ) : (
        <button
          onClick={() => handleView(0)}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          <span>{proofEmoji}</span>
          <span>{loading ? 'Loading…' : 'View proof'}</span>
        </button>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Modal */}
      {open && signedUrls.length > 0 && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setOpen(false)}
              className="absolute -top-10 right-0 text-white text-2xl z-10"
            >
              ✕
            </button>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signedUrls[activeIndex]}
              alt={`Workout proof ${activeIndex + 1}`}
              className="w-full rounded-2xl object-contain max-h-[70vh]"
            />

            {/* Multi-photo navigation */}
            {signedUrls.length > 1 && (
              <div className="mt-4">
                {/* Prev / Next arrows */}
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setActiveIndex(i => Math.max(0, i - 1))}
                    disabled={activeIndex === 0}
                    className="text-white/70 hover:text-white disabled:opacity-30 text-2xl px-2"
                  >
                    ‹
                  </button>
                  <span className="text-gray-400 text-sm">
                    {activeIndex + 1} / {signedUrls.length}
                  </span>
                  <button
                    onClick={() => setActiveIndex(i => Math.min(signedUrls.length - 1, i + 1))}
                    disabled={activeIndex === signedUrls.length - 1}
                    className="text-white/70 hover:text-white disabled:opacity-30 text-2xl px-2"
                  >
                    ›
                  </button>
                </div>
                {/* Dot indicators */}
                <div className="flex justify-center gap-1.5">
                  {signedUrls.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveIndex(i)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        i === activeIndex ? 'bg-white' : 'bg-white/30'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            <p className="text-center text-gray-500 text-xs mt-3">Tap outside to close</p>
          </div>
        </div>
      )}
    </>
  )
}

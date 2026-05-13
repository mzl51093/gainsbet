'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  proofUrl: string
  proofType: string | null
}

export default function ProofViewer({ proofUrl, proofType }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  async function handleView() {
    if (signedUrl) { setOpen(true); return }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data, error } = await supabase.storage
      .from('workout-proofs')
      .createSignedUrl(proofUrl, 60 * 60) // 1 hour

    if (error || !data?.signedUrl) {
      setError('Could not load proof')
      setLoading(false)
      return
    }

    setSignedUrl(data.signedUrl)
    setOpen(true)
    setLoading(false)
  }

  const proofEmoji = proofType === 'whoop' ? '⌚' : proofType === 'screenshot' ? '📱' : '📸'

  return (
    <>
      <button
        onClick={handleView}
        disabled={loading}
        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
      >
        <span>{proofEmoji}</span>
        <span>{loading ? 'Loading...' : 'View proof'}</span>
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Modal */}
      {open && signedUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setOpen(false)}
              className="absolute -top-10 right-0 text-white text-2xl"
            >
              ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signedUrl}
              alt="Workout proof"
              className="w-full rounded-2xl object-contain max-h-[80vh]"
            />
            <p className="text-center text-gray-400 text-xs mt-3">
              Tap outside to close
            </p>
          </div>
        </div>
      )}
    </>
  )
}

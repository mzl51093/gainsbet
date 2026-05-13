import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md w-full">
        <div className="text-6xl mb-4">🏆</div>
        <h1 className="text-4xl font-bold text-white mb-2">GainsBet</h1>
        <p className="text-gray-400 text-lg mb-2">
          Compete. Prove it. Win or pay up.
        </p>
        <p className="text-gray-500 text-sm mb-10">
          The workout competition platform where the stakes are real.
        </p>

        <div className="space-y-3">
          <Link
            href="/auth"
            className="block w-full bg-green-500 hover:bg-green-400 text-black font-bold py-4 rounded-2xl text-lg transition-colors"
          >
            Get Started
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-3 gap-4 text-center">
          <div className="bg-gray-900 rounded-2xl p-4">
            <div className="text-2xl mb-1">💪</div>
            <div className="text-xs text-gray-400">Log workouts & earn points</div>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4">
            <div className="text-2xl mb-1">📸</div>
            <div className="text-xs text-gray-400">Prove it with photo proof</div>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4">
            <div className="text-2xl mb-1">💰</div>
            <div className="text-xs text-gray-400">Wager with real stakes</div>
          </div>
        </div>
      </div>
    </div>
  )
}

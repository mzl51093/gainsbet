import Link from 'next/link'

export const metadata = {
  title: 'How GainsBet Works — Rules, Scoring & FAQ',
  description: 'Everything you need to know: how points work, wager challenges, team drafts, and social features.',
}

function Section({ id, title, emoji, children }: { id: string; title: string; emoji: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{emoji}</span>
        <h2 className="text-white text-xl font-bold">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-gray-900 rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  )
}

function Q({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <div className="border-b border-gray-800 last:border-0 py-4 first:pt-0 last:pb-0">
      <p className="text-white font-semibold text-sm mb-1.5">{q}</p>
      <div className="text-gray-400 text-sm leading-relaxed">{a}</div>
    </div>
  )
}

export default function RulesPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 pt-12 pb-6">
        <div className="max-w-lg mx-auto">
          <Link href="/dashboard" className="text-gray-500 text-sm hover:text-gray-300 transition-colors">
            ← Back to app
          </Link>
          <h1 className="text-2xl font-black mt-3 mb-1">How GainsBet Works</h1>
          <p className="text-gray-500 text-sm">Rules, scoring, and everything in between.</p>

          {/* Jump links */}
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              ['#scoring', '🏅 Scoring'],
              ['#wagers', '💰 Wagers'],
              ['#drafts', '🏆 Drafts'],
              ['#social', '💬 Social'],
              ['#faq', '❓ FAQ'],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full transition-colors"
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-10">

        {/* ── SCORING ─────────────────────────────────────────── */}
        <Section id="scoring" emoji="🏅" title="Scoring">
          <div className="space-y-4">
            <Card>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                Points are based on <span className="text-white font-semibold">effort × duration</span>. Every workout type has a points-per-hour rate across 9 tiers. Log a harder workout for longer and you earn more — it's that simple.
              </p>
              <div className="bg-gray-800 rounded-xl p-4 font-mono text-sm text-center">
                <span className="text-green-400">Points</span>
                <span className="text-gray-500"> = </span>
                <span className="text-blue-400">Rate</span>
                <span className="text-gray-500"> × </span>
                <span className="text-yellow-400">Hours</span>
                <p className="text-gray-600 text-xs mt-1 font-sans">rounded to the nearest whole number</p>
              </div>
            </Card>

            {/* Rate table */}
            <Card>
              <h3 className="text-white font-semibold text-sm mb-3">Points Per Hour by Tier</h3>
              <div className="space-y-2">
                {[
                  { emoji: '🏅', label: 'Hyrox / Spartan Race / Max Effort', rate: 12 },
                  { emoji: '⚡', label: 'HIIT / CrossFit / OrangeTheory / Bootcamp', rate: 10 },
                  { emoji: '🏃', label: 'Running / Spin / Boxing / Circuit / Team Sports', rate: 8 },
                  { emoji: '🏋️', label: 'Strength Training / Cycling / Peloton', rate: 6 },
                  { emoji: '🚣', label: 'Jogging / Swimming / Rowing / Stairmaster', rate: 4 },
                  { emoji: '🚶', label: 'Brisk Walk / Hiking / Pilates / Barre', rate: 2 },
                  { emoji: '🐕', label: 'Easy Walk / Gentle Yoga / Driving Range', rate: 1 },
                  { emoji: '⛳', label: 'Golf (Cart) / Stretching / Light Recovery', rate: 0.5 },
                  { emoji: '🧘', label: 'Meditation / Sauna / Cold Plunge / Breathwork', rate: 0 },
                ].map(w => (
                  <div key={w.label} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
                    <div className="flex items-center gap-2">
                      <span>{w.emoji}</span>
                      <span className="text-gray-300 text-sm">{w.label}</span>
                    </div>
                    <span className="text-white font-bold text-sm w-14 text-right flex-shrink-0">{w.rate} pts</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Early bird */}
            <Card className="border border-yellow-700/30 bg-yellow-900/10">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🌅</span>
                <div>
                  <p className="text-yellow-400 font-semibold text-sm">Early Bird Bonus: 1.5×</p>
                  <p className="text-gray-400 text-sm mt-1">Log any workout between <span className="text-white">6 AM – 9 AM</span> local time and every point is multiplied by 1.5. No exceptions. Wake up.</p>
                </div>
              </div>
            </Card>

            {/* Examples */}
            <Card>
              <h3 className="text-white font-semibold text-sm mb-3">Examples</h3>
              <div className="space-y-3">
                {[
                  { emoji: '🏋️', desc: '45-min strength session', calc: '6 × 0.75', result: 5, note: null },
                  { emoji: '🏃', desc: '30-min run', calc: '8 × 0.5', result: 4, note: null },
                  { emoji: '⚡', desc: '20-min HIIT', calc: '10 × 0.33', result: 3, note: null },
                  { emoji: '🔥', desc: '1-hour spin class', calc: '8 × 1.0', result: 8, note: null },
                  { emoji: '🧘', desc: '60-min gentle yoga', calc: '1 × 1.0', result: 1, note: null },
                  { emoji: '⛳', desc: '4-hour golf (walking)', calc: '2 × 4.0', result: 8, note: null },
                ].map(ex => (
                  <div key={ex.desc} className="flex items-center justify-between bg-gray-800 rounded-xl px-3 py-2.5">
                    <div>
                      <p className="text-white text-sm">{ex.emoji} {ex.desc}</p>
                      <p className="text-gray-500 text-xs font-mono mt-0.5">{ex.calc} = {ex.result}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-bold">{ex.result} pts</p>
                      {ex.note && <p className="text-yellow-500 text-xs">{ex.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* AI scoring note */}
            <Card>
              <h3 className="text-white font-semibold text-sm mb-2">Quick Log & AI Scoring</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Use the <span className="text-white">Quick Log</span> tab to describe your workout in plain text
                (e.g. "did the Murph, took 55 minutes, absolutely died"). The AI reads your description and assigns
                an effort score based on actual intensity within the 9-tier system, not just the workout type.
                Brutal workouts get rated higher than easy ones — even within the same category.
              </p>
              <p className="text-gray-400 text-sm leading-relaxed mt-2">
                You can also <span className="text-white">scan a screenshot</span> from Whoop, Apple Watch,
                Strava, or Peloton and the app will auto-fill your workout details.
              </p>
            </Card>
          </div>
        </Section>

        {/* ── WAGER CHALLENGES ─────────────────────────────────── */}
        <Section id="wagers" emoji="💰" title="Wager Challenges">
          <div className="space-y-4">
            <Card>
              <p className="text-gray-400 text-sm leading-relaxed">
                A Wager Challenge is a bet between two sides: <span className="text-white font-semibold">Workers</span> (people who work out) and <span className="text-white font-semibold">Motivators</span> (people who watch and talk trash). Both sides put something on the line.
              </p>
            </Card>

            <Card>
              <h3 className="text-white font-semibold text-sm mb-3">The Two Roles</h3>
              <div className="space-y-3">
                <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-3">
                  <p className="text-green-400 font-semibold text-sm">🏋️ Workers</p>
                  <p className="text-gray-400 text-sm mt-1">Commit to hitting a point goal by a deadline. Log workouts to earn points. Hit the goal = Workers win. Miss it = Motivators win.</p>
                </div>
                <div className="bg-purple-900/20 border border-purple-700/30 rounded-xl p-3">
                  <p className="text-purple-400 font-semibold text-sm">👀 Motivators</p>
                  <p className="text-gray-400 text-sm mt-1">Bet that the Workers won't make it. Cheer, heckle, comment — you're invested either way. If Workers fail, Motivators collect.</p>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="text-white font-semibold text-sm mb-3">How It Works</h3>
              <div className="space-y-2">
                {[
                  ['1', 'One person proposes the wager — sets the point goal, deadline, and stakes.'],
                  ['2', 'Everyone invited must accept before the challenge goes live.'],
                  ['3', 'Workers log workouts. Points accumulate on a shared leaderboard.'],
                  ['4', 'When the deadline hits, the app calculates if the goal was met.'],
                  ['5', 'The losing side pays up. Venmo links built right in.'],
                ].map(([n, text]) => (
                  <div key={n} className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-gray-700 text-gray-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{n}</span>
                    <p className="text-gray-400 text-sm">{text}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="text-white font-semibold text-sm mb-2">Stakes</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Stakes are set when the wager is proposed — could be money, a meal, bragging rights, or anything else you agree on. The app records the terms and generates Venmo pay links when it's time to settle.
              </p>
            </Card>
          </div>
        </Section>

        {/* ── TEAM DRAFTS ──────────────────────────────────────── */}
        <Section id="drafts" emoji="🏆" title="Team Draft Competitions">
          <div className="space-y-4">
            <Card>
              <p className="text-gray-400 text-sm leading-relaxed">
                Team Drafts are full competitions: two teams, drafted like a fantasy league, racing to a point goal — but with a twist. <span className="text-white">Every player must personally contribute</span> a minimum percentage or their whole team is blocked from winning.
              </p>
            </Card>

            {/* Phase timeline */}
            <Card>
              <h3 className="text-white font-semibold text-sm mb-3">The 6 Phases</h3>
              <div className="space-y-3">
                {[
                  { emoji: '🤝', label: 'Recruiting', color: 'text-blue-400', desc: 'Players join the lobby. Organizer shares an invite link or tags people directly. Competition doesn\'t start until the lobby is full.' },
                  { emoji: '🗳️', label: 'Voting', color: 'text-purple-400', desc: 'Everyone votes for who they want as team captain. Top 2 vote-getters win. You can\'t vote for yourself.' },
                  { emoji: '🐍', label: 'Snake Draft', color: 'text-yellow-400', desc: 'Captains alternate picks: A picks 1st, B picks 2nd, B picks 3rd (back-to-back), A picks 4th, and so on. No excuses for a bad team.' },
                  { emoji: '⚙️', label: 'Configuring', color: 'text-orange-400', desc: 'Captains finalize the start date, end date, and what\'s at stake. Both must agree before going live.' },
                  { emoji: '🔥', label: 'Active', color: 'text-green-400', desc: 'Competition is live. Log workouts, get them approved by teammates, watch the scoreboard in real time.' },
                  { emoji: '🏁', label: 'Completed', color: 'text-gray-400', desc: 'Winner declared. Venmo pay links generated for the losing team. Settle up.' },
                ].map(phase => (
                  <div key={phase.label} className="flex gap-3">
                    <span className="text-xl flex-shrink-0">{phase.emoji}</span>
                    <div>
                      <p className={`font-semibold text-sm ${phase.color}`}>{phase.label}</p>
                      <p className="text-gray-400 text-sm mt-0.5">{phase.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border border-red-700/30 bg-red-900/10">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-red-400 font-semibold text-sm">The Min Contribution Rule</p>
                  <p className="text-gray-400 text-sm mt-1">
                    Every player must personally hit a minimum % of the team's point goal (set by captains, typically 25%). If even one teammate falls short, the whole team <span className="text-white">cannot win</span> — regardless of total points.
                  </p>
                  <p className="text-gray-500 text-xs mt-2">
                    Example: Goal is 200 pts, min is 25% (50 pts each). If one player only has 30 pts when the team hits 200, the team loses — even though they hit the number.
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="text-white font-semibold text-sm mb-2">Workout Validation</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                In an active draft, every workout you log must be <span className="text-white">approved by a teammate</span> before the points count. This keeps everyone honest — teammates can see your notes and proof, and approve or reject. You cannot validate your own workouts.
              </p>
            </Card>

            <Card>
              <h3 className="text-white font-semibold text-sm mb-2">Settling Up</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                When the competition ends, the app shows the final scores and generates Venmo deep-links so the losing team can pay winners directly. Set your Venmo username in your Profile so your teammates can find you.
              </p>
            </Card>
          </div>
        </Section>

        {/* ── SOCIAL FEATURES ──────────────────────────────────── */}
        <Section id="social" emoji="💬" title="Social & Interactive Features">
          <div className="space-y-4">
            <Card>
              <h3 className="text-white font-semibold text-sm mb-3">Activity Feed</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Your home feed shows workouts from people you follow and challenges you're part of. React, comment, and talk trash directly on anyone's workout.
              </p>
            </Card>

            <Card>
              <h3 className="text-white font-semibold text-sm mb-3">Reactions & Comments</h3>
              <div className="space-y-2 text-sm text-gray-400">
                <p>Tap any workout in the feed to leave a reaction (🔥💀😅🏆😤) or a comment. Comments are public to everyone in the challenge.</p>
                <p>The more you comment, the more your <span className="text-white">player persona</span> takes shape — regular trash talkers earn titles like "The Bully" or "The Hype Man."</p>
              </div>
            </Card>

            <Card>
              <h3 className="text-white font-semibold text-sm mb-3">Player Profiles</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Every player has a profile page showing their persona, trophies, stats, and full workout history. Tap anyone's name — in comments, the feed, or on challenge cards — to view their profile. You can also follow individual players to get their workouts in your feed.
              </p>
            </Card>

            <Card>
              <h3 className="text-white font-semibold text-sm mb-3">Draft Chat</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Every draft competition has a live <span className="text-white">Group Chat</span> for all participants — trash talk, announcements, whatever. Once teams are assigned, there's also a private <span className="text-white">Team Huddle</span> only your teammates can see. Use it for strategy. Or just complain about the other team.
              </p>
            </Card>

            <Card>
              <h3 className="text-white font-semibold text-sm mb-3">Notifications</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                The bell icon shows in-app alerts for: challenge invites, wager proposals, workout approvals, comments on your workouts, and more. Enable push notifications to get them on your lock screen.
              </p>
            </Card>

            <Card>
              <h3 className="text-white font-semibold text-sm mb-3">Following</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Follow people from the <span className="text-white">Explore → People</span> tab or directly from their profile. You can also follow individual wager challenges and draft competitions without joining them — so you can spectate and talk trash.
              </p>
            </Card>
          </div>
        </Section>

        {/* ── FAQ ──────────────────────────────────────────────── */}
        <Section id="faq" emoji="❓" title="FAQ">
          <Card>
            <div className="divide-y divide-gray-800">
              <Q
                q="Do I need to log proof of my workout?"
                a="Not required, but you can attach a screenshot from your fitness tracker (Whoop, Apple Watch, Strava, Peloton, etc.) when logging. In draft competitions, teammates decide whether to approve your workout — proof helps."
              />
              <Q
                q="What's the weekly goal?"
                a="The personal weekly goal shown on your home screen is 50 points. This is separate from any challenge goals."
              />
              <Q
                q="Can I be both a Worker and a Motivator?"
                a="Not in the same wager challenge — you pick a side when you join. But you can be a Worker in one challenge and a Motivator in another."
              />
              <Q
                q="What happens if a draft competition ends before anyone hits the goal?"
                a="Whichever team is closer to the goal at the end date wins — assuming both teams had everyone meet the minimum contribution. If neither team meets the min, it's a draw and the organizer decides how to handle stakes."
              />
              <Q
                q="How does the AI Quick Log work?"
                a="Type a natural description of your workout — length, what you did, how hard it was. The AI reads your description and assigns an effort-based score (0–12 pts/hr across 9 tiers). Describing a brutal workout accurately gets you more points than sandbagging."
              />
              <Q
                q="Can my workout get rejected in a draft competition?"
                a={<>Yes. Teammates can reject workouts that seem off — no notes, suspicious duration, etc. If rejected, those points don't count. Keep it honest and add notes.</>}
              />
              <Q
                q="How does Venmo settlement work?"
                a="When a competition ends, the app shows the winners and generates Venmo deep-links pre-filled with the amount and a note. You still have to actually send the money — the app just makes it one tap. Set your Venmo username in your Profile settings so others can pay you."
              />
              <Q
                q="What's the Early Bird bonus exactly?"
                a="Any workout logged between 6:00 AM and 8:59 AM in your local time zone earns 1.5× points. A 30-min run normally earns 6 pts — logged at 7 AM it earns 9 pts. The bonus applies automatically."
              />
              <Q
                q="How are player personas determined?"
                a="The app looks at your workout history, comment frequency, late-night sessions, consistency, and more to assign a persona like 'The Ghost,' 'The Early Bird,' or 'The Bully.' Personas update as your habits change."
              />
              <Q
                q="Can I invite friends who don't have an account?"
                a="Share the invite link from the draft recruiting page — anyone with the link can sign up and join. For in-app invites (tag by name), they need to already have an account."
              />
            </div>
          </Card>
        </Section>

        {/* Footer */}
        <div className="text-center pb-8">
          <p className="text-gray-700 text-xs">GainsBet — Compete, prove it, collect the glory.</p>
          <Link href="/dashboard" className="text-green-500 text-sm font-semibold mt-2 block">
            Open the app →
          </Link>
        </div>

      </div>
    </div>
  )
}

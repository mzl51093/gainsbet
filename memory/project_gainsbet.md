---
name: GainsBet Workout Competition App
description: Next.js + Supabase workout competition platform for 2 competitors + accountability partners (wives)
type: project
---

Building a workout competition web app called GainsBet. Located at `C:\Users\mzl51\OneDrive\Documents\Claude Code\workout-app`.

**Why:** User and a friend want to compete on weekly workout goals with their wives as accountability partners who can create wagers.

**Stack:** Next.js 14 (App Router), Tailwind CSS, Supabase (auth + DB + storage), Vercel hosting.

**How to apply:** When working on this app, assume the Supabase project still needs to be created by the user (schema is in `supabase-schema.sql`). The app is complete for Phase 1+2 — check SETUP.md for deployment steps.

**Key features built:**
- Magic link auth (passwordless email)
- Workout logging with points calculation
- Photo/screenshot/Whoop proof upload (Supabase Storage)
- Weekly leaderboard with progress bars
- Wager system (propose → accept → resolve)
- Activity feed
- Profile page with stats

**User roles:** competitor (logs workouts) | partner (accountability — creates wagers, views everything)

**Points system:** HIIT 12pts, Strength 10, Cardio 8, Sports 7, Other 6, Flexibility 5 — multiplied by duration (0.75x <30min, 1x 30-60, 1.25x 60-90, 1.5x 90+). Weekly goal = 50pts.

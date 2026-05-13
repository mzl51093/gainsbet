# GainsBet — Setup Guide

## Step 1: Create Supabase Project

1. Go to supabase.com → New Project
2. Name it "gainsbet", pick a region, set a DB password
3. Wait ~2 minutes for it to provision

## Step 2: Run the Database Schema

1. In Supabase dashboard → SQL Editor
2. Paste the entire contents of `supabase-schema.sql`
3. Click Run

## Step 3: Configure Auth

1. Supabase dashboard → Authentication → Email
2. Make sure "Enable Email Confirmations" is **ON**
3. Under URL Configuration, add your site URL:
   - For local dev: `http://localhost:3000`
   - For production: `https://your-vercel-domain.vercel.app`
4. Add redirect URL: `http://localhost:3000/auth/callback` (and your prod URL)

## Step 4: Get Your API Keys

1. Supabase dashboard → Project Settings → API
2. Copy "Project URL" and "anon public" key
3. Edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

## Step 5: Run Locally

```bash
npm run dev
```

Open http://localhost:3000

## Step 6: Invite Your Group (4 people)

Just share the URL — everyone signs in with their email via magic link.
On first login they'll set their name and role (competitor or accountability partner).

**Roles:**
- **Competitor** — logs workouts, earns points, competes
- **Accountability Partner** — views everything, creates wagers, keeps score

## Step 7: Deploy to Vercel (free)

```bash
npm install -g vercel
vercel
```

Follow prompts. Then add your env vars in the Vercel dashboard under Project → Settings → Environment Variables.

---

## Points System

| Workout | Base Points |
|---------|-------------|
| HIIT | 12 |
| Strength | 10 |
| Cardio | 8 |
| Sports | 7 |
| Other | 6 |
| Flexibility/Recovery | 5 |

**Duration Multipliers:**
- < 30 min → 0.75x
- 30–60 min → 1x
- 60–90 min → 1.25x
- 90+ min → 1.5x

**Weekly goal: 50 points** to "pass" the week.

---

## How Wagers Work

1. Anyone (competitor or partner) proposes a wager
2. Others accept it (or ignore it)
3. It activates once someone accepts
4. At end of week, the wager proposer manually resolves it (competitors won / partners won)
5. The result is displayed permanently

**Wager conditions:**
- Both fail → partners win
- Either fails → partners win
- One fails → that competitor pays
- Custom → describe your own

# Legal Pages (`/terms`, `/privacy`)

- `src/app/terms/page.tsx` and `src/app/privacy/page.tsx` are hand-written static documents (shared
  shell: `src/components/legal/LegalLayout.tsx`). They are **not** boilerplate — the privacy policy
  enumerates the actual collected fields and names every external processor (Supabase, Vercel,
  Google, Kakao) individually, and nothing links them to `supabase-schema.sql`. **When a schema
  change adds a personal-data field that a participant or organizer enters, or a new third-party
  service is integrated, update the policy in the same change.** No lint or test catches the drift;
  it's a remember-to-check convention like the additive-only schema rule.
- The policy's §6 and the terms' 제7조 exist specifically because organizers enter *other people's*
  names/gender/skill/age via `guest_participants` and `session_participant_overrides` — they place
  the consent-collection burden on the organizer who typed the data in. If that data-entry model
  changes, those two clauses are the ones to revisit.
- `src/app/auth/login/page.tsx` links both documents from its consent sentence, and login is treated
  as implied consent (no checkbox) — a deliberate choice for conversion, revisited only if
  under-14 verification or optional consent items appear. Keep both routes reachable: they were
  linked from that sentence for a while before the pages existed, which meant the app claimed to
  collect consent to documents that 404'd.

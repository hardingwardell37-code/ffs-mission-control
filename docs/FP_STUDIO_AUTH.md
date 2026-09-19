# F&P Studio authentication

Personal-studio auth for Wardell. Not a multi-tenant SaaS onboarding flow.

## Normal path (preferred)

1. Apply migrations `0001`, `0002`, then **`0004_studio_bootstrap.sql`**.
2. Set on Netlify / `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Create an account on `/login` (or sign in if one already exists).
4. After password auth, the app calls `public.ensure_studio_access()`:
   - upserts `profiles`
   - if no active membership, creates org `F&P Studio` with slug `fp-studio-<short>`
   - inserts owner/active `organization_memberships`
5. `requireContext()` re-selects membership; missing membership redirects to `/login?error=membership`.

`ensure_studio_access` is `SECURITY DEFINER` and granted to `authenticated` only. **No public anon insert RLS** is added for organizations or memberships.

## Temporary personal bypass

Use only until normal auth works. Env-gated and intended to be turned off.

| Variable | Role |
| --- | --- |
| `FP_STUDIO_PERSONAL_BYPASS=true` | Shows bypass control on `/login` and allows the bypass cookie |
| `FP_STUDIO_BYPASS_SECRET` | Optional. If set, bypass form must submit the matching secret. If unset, one-click bypass is allowed when bypass is true |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Used by bypass to find-or-create org `fp-studio-personal` and a synthetic operator |

Behavior:

1. Bypass server action sets httpOnly cookie `fp_studio_bypass=1`.
2. Middleware allows the request when bypass is enabled **and** the cookie is present (no Supabase session required).
3. `requireContext()` uses the service-role admin client, ensures org slug `fp-studio-personal`, ensures operator `wardell@fp-studio.local`, owner membership.
4. Missing service role → `/login?error=bypass_config`.
5. Sign out clears the bypass cookie.

Disable `FP_STUDIO_PERSONAL_BYPASS` (or set it to `false`) and remove `SUPABASE_SERVICE_ROLE_KEY` from the app when no longer needed.

## Login error query params

| `error` | Meaning |
| --- | --- |
| `credentials` | Bad email/password or missing fields |
| `configuration` | Public Supabase env missing |
| `confirm` | Signup succeeded but email confirmation required |
| `membership` | Auth OK but studio membership bootstrap failed |
| `signup` | Signup rejected (e.g. email already registered) |
| `bypass_config` | Bypass missing service role / URL |
| `bypass_secret` | Bypass secret mismatch |

## Netlify checklist for Wardell

Set these site env vars, then redeploy:

```
NEXT_PUBLIC_SUPABASE_URL=<project url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
FP_STUDIO_PERSONAL_BYPASS=true
FP_STUDIO_BYPASS_SECRET=<optional strong secret>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

Also run migration `0004` in the Supabase SQL editor (after `0001` and `0002`).

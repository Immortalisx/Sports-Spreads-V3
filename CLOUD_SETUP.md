# Sports Spreads — $0 cloud saving setup

Live website: https://sports-spreads.onrender.com/

**Status:** The browser cloud adapter and RLS SQL are implemented, but no Supabase project exists on the connected account yet. A plugin connection is not itself a database. Keep local-only saved tickets until this is configured.

## 1. Create the dedicated Free project

1. Open https://supabase.com/dashboard/projects or https://supabase.com/dashboard/new.
2. Choose the organization you want (the connected account currently has one organization). Select the **Free** tier and region nearest users (for U.S. East, `us-east-1`). Name the project **Sports Spreads**.
3. **Confirm the provider's quote is $0 before creating it.** Do not accept a paid plan, add compute, paid database branches, or usage upgrades.
4. The project may initialize before you can query it.

## 2. Create secure ticket storage

1. Open your project → SQL Editor → New query.
2. Paste and run `supabase/migrations/001_saved_ticket_history.sql` from this repository.
3. In Table Editor, verify `public.user_tickets` exists. In Security/Policies, confirm Row Level Security is enabled and there are *only two* user-facing policies: authenticated user selects their own `user_id`, and inserts only their own `user_id`.
4. Do not grant access to the `anon` role and never put any Supabase service-role or secret key in the website.

## 3. Enable passwordless sign-in

1. Supabase → Authentication → Providers → Email: confirm enabled, with magic link sign-in support.
2. Authentication → URL Configuration:
   - **Site URL:** `https://sports-spreads.onrender.com/`
   - **Redirect URLs:** `https://sports-spreads.onrender.com/` (exact match)
3. Built-in SMTP can have restrictive free-tier quotas. Verify a test email before inviting many Discord users; do not buy a mail service without reviewing the cost.

## 4. Link the public website to your project

1. Supabase → Project Settings / Connect → API: copy **Project URL** (`https://<project-ref>.supabase.co`) and the **publishable** key (`sb_publishable_…`). Both are designed for frontend configuration.
2. In GitHub `Immortalisx/Sports-Spreads-V3`, edit `index.html` near the top and set:

   ```html
   <script>window.SS_CLOUD_CONFIG={url:'https://YOUR_PROJECT.supabase.co',publishableKey:'sb_publishable_YOUR_KEY'};</script>
   ```

3. Commit the edit. Render will deploy a new version once GitHub integration is configured; otherwise deploy the latest commit from the Render dashboard. Never disclose a `service_role` or `sb_secret_…` key. **Only use `sb_publishable_…`.**

## 5. Test sync on two devices

1. Open the live site in a browser and go to **Saved → Cloud sync**.
2. Enter your email and open the magic link sent by Supabase. It must return to your Sports Spreads website.
3. In **Builder**, add a test selection, enter manual odds and a stake, then select **Save to cloud**.
4. Open the site on another device, sign in with the *same* email, and select **Saved → Refresh cloud history**.
5. Use a different email/user to verify that the original account's ticket **cannot** be read. That is the RLS privacy check. Test an expired session and a network error; local saving should still work.

## Limits and meaning

- This feature synchronizes **user-entered, unverified odds and immutable ticket snapshots**, not placed bets or actual sportsbook accounts.
- Cloud tickets are private to the signed-in user. The public Discord link does not reveal their history.
- Forecast weather inputs are a versioned **risk-context model**, not yet a calibrated win-probability adjustment. The original prediction engine and verified sportsbook prices are not connected.
- Supabase Free has usage limits; review the dashboard to ensure the project stays on Free. Open-Meteo's no-key API is for noncommercial use within its rate limits.
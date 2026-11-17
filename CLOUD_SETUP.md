# Sports Spreads — Cloud saving setup

**Status (November 17, 2026):** Supabase Free project has been created, private table `public.user_tickets` deployed, RLS verified, and the frontend in `index.html` configured with the project's public API URL and publishable key.

- Public website: https://sports-spreads.onrender.com/
- Supabase project: https://supabase.com/dashboard/project/nwspnepkmeoytlkbltfe
- Quoted project cost: **$0/month** (usage limits still apply)
- Database: authenticated users may read and insert their own ticket snapshots only; no anonymous read, update, or delete.
- Project credentials: publishable key only in the browser; never use a service_role or secret key.

## One remaining dashboard step: authorize sign-in redirect

In the Supabase dashboard, go to **Authentication → URL Configuration**:

- **Site URL:** `https://sports-spreads.onrender.com/`
- **Redirect URLs:** add `https://sports-spreads.onrender.com/**`
- If using the secondary preview domain, add `https://sports-spreads-v3.onrender.com/**` only if actually needed.

In **Authentication → Providers → Email**, leave the Email provider enabled. **Important free-tier email limit:** Supabase's built-in email sender only delivers to pre-authorized addresses on the project's team. Discord testers who are not team members cannot use email sign-in until you configure a separate SMTP sender or another OAuth sign-in provider. Keep the public site, ticket builder and local saving accessible without signing in. For a Discord community, consider free Discord OAuth later rather than paid email. Do not buy SMTP service without reviewing cost.

## Test the cloud flow

1. Open https://sports-spreads.onrender.com/ and choose **Saved → Cloud sync**.
2. Enter your email and follow the sign-in link. It should return to the site.
3. Choose **Builder**, add at least one leg with manually entered odds, and save the ticket to cloud.
4. On another browser or device, sign in with the same email, choose **Saved → Refresh cloud history**, and confirm the ticket is there.
5. Different users cannot read one another's private ticket history; RLS is enabled.

If a link redirects elsewhere or a request says "redirect_to is not allowed", review the Authentication URL Configuration above.

## Accuracy and safety

- Saved tickets are immutable snapshots of **manually entered, unverified** odds. They do not represent bets placed with a sportsbook.
- Weather risk affects matchup context only; win probabilities remain uncalibrated until the actual prediction engine is connected.
- This site is a community beta, not verified sportsbook odds or betting advice.
- Free plans can pause after inactivity and have usage caps. Review usage in Supabase and Render dashboards.

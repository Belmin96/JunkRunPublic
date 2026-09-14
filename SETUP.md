# JunkRun — Setup Guide

## 1. Google OAuth (Clerk)

Enable Google sign-in in 2 steps — no code change needed:

1. **Clerk Dashboard** → Your app → **User & Authentication** → **Social Connections** → **Google** → Toggle **Enable**
2. Add OAuth credentials from Google Cloud Console:
   - Create a project at console.cloud.google.com
   - Enable the **Google Identity API**
   - Create **OAuth 2.0 Client ID** (Web application)
   - Authorized redirect URI: `https://accounts.<your-clerk-domain>.com/v1/oauth_callback`
   - Paste the Client ID + Secret into Clerk

That's it. The sign-up flow will now show a "Continue with Google" button alongside the email/password form. The role the user selected on the picker screen is stored in `unsafeMetadata` and carried through the OAuth flow automatically.

---

## 2. Admin role

To promote a user to Admin:

**Option A — Admin panel (recommended)**
1. Sign in as an Owner account
2. Go to `/admin/users`
3. Find the user and change their role in the dropdown

**Option B — Clerk Dashboard**
1. Clerk Dashboard → Users → select the user
2. Edit **Public Metadata**: `{ "role": "ADMIN" }`
3. The DB syncs on next sign-in (or trigger the webhook manually)

> The `OWNER` role is the highest level and cannot be changed via the admin panel — set it directly in the DB: `UPDATE User SET role = 'OWNER' WHERE email = '...'`

---

## 3. Required environment variables

```env
# Database
DATABASE_URL="file:./dev.db"          # SQLite (dev); swap to postgres for production

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...        # From Clerk Dashboard → Webhooks

# Stripe (plug in when ready)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Web Push (optional)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

---

## 4. Clerk Webhook

The webhook at `/api/webhooks/clerk` must be registered in Clerk Dashboard → **Webhooks** → Add endpoint:

- URL: `https://your-domain.com/api/webhooks/clerk`
- Events: `user.created`, `user.updated`

This is what sets the role in Clerk's `publicMetadata` after sign-up (including Google OAuth sign-ups), which in turn gates the admin panel.

---

## 5. Run database migration (after pulling this update)

```bash
npx prisma migrate dev --name add-messages
```

This adds the `Message` table to your database.

---

## 6. New pages in this update

| Route | Who | What |
|-------|-----|------|
| `/sign-up` | Public | Role picker → Clerk SignUp (with Google button) |
| `/admin/messages` | Admin/Owner | Full message thread browser |
| `/admin/users` | Admin/Owner | User list with inline role changer |
| `/customer/jobs/[id]` | Customer | Now includes ChatPanel |
| `/hauler/jobs/[id]` | Hauler | Now includes ChatPanel |

# Set up sign-in (Microsoft Entra External ID)

Sylvia stays anonymous-first. Sign-in is optional and only syncs saved plants, the FireSmart checklist and alert
settings across devices. You create the identity tenant and app registration (Claude can't create accounts).
**No secrets are needed**: the app uses the browser sign-in flow (PKCE), so you only send back three IDs.

Time: about 15 minutes. Use the account that owns the Azure for Students subscription.

## 1. Create an external tenant
1. Go to <https://entra.microsoft.com> and sign in.
2. **Entra ID → Overview → Manage tenants → Create**.
3. Choose **External** → Continue.
4. Tenant name: `Sylvia`. Domain name: `sylviaapp` (or anything free; this becomes `sylviaapp.ciamlogin.com`).
   Location: **Canada**.
5. Subscription: **Azure for Students**, resource group `rg-sylvia-dev`. Create. Wait a few minutes.
6. Switch into the new tenant: top-right settings (gear) → **Directories + subscriptions** → switch to *Sylvia*.

## 2. Register the app
1. In the Sylvia tenant: **Entra ID → App registrations → New registration**.
2. Name: `Sylvia web`. Supported account types: **Accounts in this organizational directory only**.
3. Redirect URI: platform **Single-page application (SPA)**, URI:
   `https://ca-web-6x6suo5lxjc5o.icysmoke-e61b83ec.canadacentral.azurecontainerapps.io/auth`
4. Register. Then open **Authentication → Add URI** and also add `http://localhost:3000/auth`. Save.
5. On **Overview**, copy the **Application (client) ID** and the **Directory (tenant) ID**.

## 3. Create the sign-in flow
1. **Entra ID → External Identities → User flows → New user flow**.
2. Name: `signupsignin`. Identity providers: **Email one-time passcode** (no passwords to forget).
3. User attributes to collect: **Display Name** only. Create.
4. Open the flow → **Applications → Add application** → pick `Sylvia web`.

Google sign-in can be added later under **External Identities → All identity providers → Google**; it needs a
Google Cloud OAuth client, so skip it for now.

## 4. Send these to Claude
- Tenant domain prefix (for example `sylviaapp`)
- Directory (tenant) ID
- Application (client) ID

These are not secrets. They're visible to anyone who uses the sign-in page.

## What Sylvia stores when someone signs in
Only the account's object ID (a random identifier from Entra) to link their data, and the display name to greet
them. Email addresses stay in Entra and are not copied into Sylvia's database. Signing out keeps data on the
account; deleting the account in Profile removes it.

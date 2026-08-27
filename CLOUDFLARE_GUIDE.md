# Cloudflare Deployment Guide for Global Belongings (Swap Shop)

This guide provides step-by-step instructions for deploying the Global Belongings swap shop to Cloudflare.

---

## 1. Cloudflare Pages vs. Workers: Which is better?

**Cloudflare Pages is the best and recommended choice** for this application:

| Feature | Cloudflare Pages (Recommended) | Standalone Cloudflare Worker |
| :--- | :--- | :--- |
| **Asset Hosting** | Built-in high-speed static CDN for `public/` (HTML, CSS, JS, Phosphor fonts). | Requires bundling static files or separate KV asset binding. |
| **Backend API** | Automatic serverless API via `/functions` directory (Pages Functions). | Requires writing custom routing for both assets and API. |
| **Git Integration** | Automatic deployments on every `git push` to your GitHub repo. | Requires setting up GitHub Actions or manual Wrangler CLI. |
| **Cost** | 100% Free Tier (Unlimited bandwidth, 100k API requests/day). | Free tier with similar limits, but more manual setup. |

---

## 2. Cloudflare Dashboard Setup & Fixing Build Settings

### Recommended Build Configuration:
In the Cloudflare Pages setup (or under **Settings** ➔ **Builds & deployments**):
- **Framework preset**: `None`
- **Build command**: Leave completely **blank** (or set to `npm run build`)
  > ⚠️ **Important**: Do **not** enter `npx wrangler deploy` as the build command. Cloudflare Pages automatically handles asset and serverless function deployment without needing a manual deploy command!
- **Build output directory**: `public`

### Why the previous build log gave a warning:
```
Executing user deploy command: npx wrangler deploy
▲ [WARNING] It seems that you have run wrangler deploy on a Pages project
✘ [ERROR] Missing entry-point to Worker script or to assets directory
```
If `npx wrangler deploy` was entered in the Cloudflare build command field:
1. Cloudflare Pages tried to execute `wrangler deploy` instead of letting Pages deploy natively.
2. We added a build script to `package.json` and fixed `wrangler.toml` for Pages. **Do not add `[assets]` (or any other Workers section) to `wrangler.toml` on a Pages project:** Pages reads the file for build configuration and aborts the deployment with `Configuration file for Pages projects does not support "assets"`. A valid Pages `wrangler.toml` contains only `name`, `compatibility_date`, and `pages_build_output_dir` (plus optional `compatibility_flags`).
3. The cleanest fix in your Cloudflare Dashboard is simply to **clear the "Build command" field** so it is empty.

---

## 3. Persistent Database Setup (Cloudflare KV: `swapshop_kv`)

The backend (`functions/api/[[route]].js`) is pre-configured to automatically save inventory, categories, sessions, and transactions to **Cloudflare KV** using the namespace binding **`swapshop_kv`**.

### How to bind KV in 30 seconds:
1. In the Cloudflare Dashboard left menu, go to **Storage & Databases** ➔ **KV**.
2. Click **Create namespace**.
3. Enter the name: `swapshop_kv` and click **Add**.
4. Now, go to **Workers & Pages** ➔ click your project.
5. Click **Settings** ➔ select **Functions** from the left sub-menu.
6. Scroll down to **KV namespace bindings** and click **Add binding**:
   - **Variable name**: `swapshop_kv` *(must match exactly)*
   - **KV namespace**: select `swapshop_kv`
7. Click **Save**.
8. In **Deployments**, click **Retry deployment** (or push a commit) so the binding takes effect.

> **Zero-Setup Seeding**: The very first time the API runs on Cloudflare, it automatically detects if the KV database is empty and seeds all 37 generic items, categories, and settings automatically.

---

## 4. Setting up the Kiosk (`/`) vs. Admin (`/admin` or `admin.` subdomain)

### Approach A: Domain Path (Default, Zero-Config)
- **Visitor Mobile Kiosk**: `https://yourdomain.com/`  
  *Distraction-free, full-screen mobile chat assistant.*
- **Staff Admin Portal**: `https://yourdomain.com/admin`  
  *Password-protected staff management dashboard.*

### Approach B: Subdomain (`admin.yourdomain.com`)
If you want an `admin.` subdomain:
1. Go to your Pages project ➔ **Custom domains** ➔ click **Set up a custom domain**.
2. Add your main domain: `yourdomain.com` (routes to Kiosk `/`).
3. Under **Rules** in Cloudflare Dashboard:
   - Create a **Redirect Rule** or **Worker Route**:
   - When incoming host is `admin.yourdomain.com`, rewrite or redirect to `yourdomain.com/admin`.

---

## 5. Local Development & Testing with Wrangler CLI

If you want to test Cloudflare Pages Functions locally on your machine:
```bash
# Run local Cloudflare Pages preview with Functions and KV simulation
npx wrangler pages dev public --kv swapshop_kv
```

---

## 6. KV Not Persisting? Diagnose in 30 Seconds

If the site "works" but nothing survives a reload, the binding is not active **in the currently deployed deployment**. The code silently falls back to in-memory storage when the binding is missing, so the app still looks fine while every write is discarded. Confirm with:

```bash
curl https://<your-project>.pages.dev/api/kv-status
```

Reading the answer:

| Response | Meaning |
| :--- | :--- |
| `"kvBound": true, "roundTrip": "ok"` | Binding is active and writable. Persistence works. |
| `"kvBound": false` | This deployment has **no** KV binding. Add it (Section 3), then **redeploy**. |
| `"kvBound": true, "roundTrip": "error"` | Binding exists but writes fail (permissions on the namespace). |

Common causes for `kvBound: false` even though the namespace exists:

1. **The binding was added after the last deployment.** KV (and every other) binding is baked in at deploy time. Adding a binding does **not** update existing deployments — you must trigger a new one (Settings ➔ Deployments  **Retry deployment**, or push a commit).
2. **The binding was added to the wrong object.** The Pages project and any standalone Worker each have their own binding lists. A binding on the `swapshop-inventory` Worker does nothing for the Pages project (and vice versa). Check **both** Settings ➔ Functions pages.
3. **The namespace lives in a different Cloudflare account** than the Pages project. The namespace dropdown on the binding form only lists namespaces in the *same* account. If `swapshop_kv` does not appear in that dropdown, it was created under another account — recreate it there, or move the project.
4. **Organization account permissions.** On an org account, the account member performing the binding needs at least **KV: Edit** (and Pages: Edit). With fewer permissions the binding section may be missing or uneditable.
5. **The KV block in `wrangler.toml` is commented out and is not read by Pages auto-deploy anyway.** For a Git-connected Pages project, `wrangler.toml` does not configure bindings or the build; everything comes from the dashboard. Do not rely on that file.

Note on the two entry points in this repo: `functions/api/[[route]].js` is the backend used by **Pages** (the root-level `worker.js` is ignored by Pages and only applies if you deploy it as a separate Worker with `wrangler deploy`). The `/api/kv-status` endpoint exists in both, so the curl check above works whichever way the project is deployed.

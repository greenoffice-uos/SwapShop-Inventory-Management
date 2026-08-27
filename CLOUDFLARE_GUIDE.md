# Cloudflare Deployment Guide for EcoSwap

This guide provides step-by-step instructions for deploying the EcoSwap system to Cloudflare.

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
2. We have updated `wrangler.toml` with `[assets] directory = "./public"` and added `"build": "echo 'Static assets ready'"` to `package.json` to prevent this error.
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

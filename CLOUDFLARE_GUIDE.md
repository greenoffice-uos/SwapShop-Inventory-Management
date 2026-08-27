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

## 2. Cloudflare Dashboard Setup (Step-by-Step)

### Step 1: Connect your GitHub Repository
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the left navigation, click **Workers & Pages**.
3. Click **Create application** ➔ select the **Pages** tab.
4. Click **Connect to Git**.
5. Select your repository: `greenoffice-uos/SwapShop-Inventory-Management`.
6. Click **Begin setup**.

### Step 2: Configure Build Settings
In the setup screen:
- **Project name**: `ecoswap` (or whatever you prefer)
- **Production branch**: `main`
- **Framework preset**: `None`
- **Build command**: *(leave blank or type `echo 'Build complete'`)*
- **Build output directory**: `public`
- Click **Save and Deploy**.

Cloudflare Pages will build the site and provide you with a live URL (e.g. `https://ecoswap.pages.dev`).

---

## 3. Persistent Database Setup (Cloudflare KV)

The backend (`functions/api/[[route]].js`) is pre-configured to automatically save inventory, categories, sessions, and transactions to **Cloudflare KV**.

### How to bind KV in 30 seconds:
1. In the Cloudflare Dashboard left menu, go to **Storage & Databases** ➔ **KV**.
2. Click **Create namespace**.
3. Enter the name: `ECOSWAP_KV` and click **Add**.
4. Now, go back to **Workers & Pages** ➔ click your **ecoswap** project.
5. Click **Settings** ➔ select **Functions** from the sub-menu.
6. Scroll down to **KV namespace bindings** and click **Add binding**:
   - **Variable name**: `ECOSWAP_KV` *(must match exactly)*
   - **KV namespace**: select `ECOSWAP_KV`
7. Click **Save**.
8. Trigger a new deployment (or push a commit) so the binding takes effect.

> **Zero-Setup Seeding**: The very first time the API runs, it automatically detects an empty KV store and seeds all 37 generic items, categories, and settings automatically.

---

## 4. Setting up the Kiosk (`/`) vs. Admin (`/admin` or `admin.` subdomain)

### Approach A: Path-based (Easiest, zero-config)
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
# Install Wrangler
npm install -g wrangler

# Run local Cloudflare Pages preview with Functions and KV simulation
npx wrangler pages dev public --kv ECOSWAP_KV
```

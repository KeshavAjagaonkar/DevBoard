# DevBoard Deployment Guide

This guide provides step-by-step instructions to deploy the DevBoard application online. We will use **Railway** to host the backend API, its PostgreSQL database, and Redis cache, and **Vercel** to host the React/Vite dashboard frontend.

---

## Part 1: Deploying Backend & Services on Railway

Railway allows you to deploy a multi-service stack containing Node.js, PostgreSQL, and Redis in a single project.

### Step 1.1: Create a Railway Project
1. Log in to your [Railway Dashboard](https://railway.app/) and click **New Project** (or **+ New**).
2. Select **Provision PostgreSQL**. This will create your PostgreSQL database service.
3. Wait for PostgreSQL to initialize, then click the **+ Add** button in your Railway project workspace and select **Redis**. This will create your Redis cache service.

### Step 1.2: Deploy the Express API Service
1. Click the **+ Add** button in your Railway project workspace and select **GitHub Repo**.
2. Select your repository. If it's a monorepo containing multiple directories, select the main repo.
3. Once the service is added, click on it and navigate to its **Settings** tab.
4. Under **General**, set the **Root Directory** to `DevBoard API` (since the API resides in this subdirectory).
5. Scroll down to **Build & Deploy** and verify:
   - Railway should automatically detect the `Dockerfile` we created in `DevBoard API/Dockerfile` and use it to build. If not, make sure it is configured to use the Dockerfile.

### Step 1.3: Configure Backend Environment Variables
Go to the **Variables** tab of your API service on Railway and click **New Variable** (or **Raw Editor**) to add the following variables. (Railway automatically injects database and Redis credentials if they are in the same project, but you must map them to the environment variables your app expects):

| Variable Name | Value / Description | How to get on Railway |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enter manually |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Use Railway's reference syntax to map to the Postgres database. |
| `REDIS_URL` | `rediss://:${{Redis.REDISPASSWORD}}@${{Redis.REDISHOST}}:${{Redis.REDISPORT}}` | Use Railway's reference syntax to map to the secure Redis connection string. |
| `JWT_SECRET` | A secure, random string (at least 16 characters). | Generate using a password generator or run `openssl rand -hex 32`. |
| `ENCRYPTION_KEY` | A secure, random string (exactly 32 characters). | Used to encrypt users' IMAP email passwords. Ensure it's kept safe! |

*Note: The `rediss://` protocol (with double `s`) is used for encrypted Redis connections over TLS, which Railway supports.*

### Step 1.4: Database Startup & Synced Tables
We updated the backend `package.json` to run `npx prisma db push` on startup automatically. The very first time the API boots up on Railway, it will push the schema and create all tables (`User`, `Application`, `StatusLog`) automatically.

### Step 1.5: Set Up a Public Domain for the API
1. In your Railway API service dashboard, go to the **Settings** tab.
2. Under the **Networking** section, click **Generate Domain** (or set up a custom domain).
3. Copy this URL (e.g. `https://devboard-api-production.up.railway.app`). You will need this URL for the frontend and Chrome extension!

---

## Part 2: Deploying Frontend Dashboard on Vercel

Vercel is the ideal host for static React/Vite applications.

### Step 2.1: Import your Project to Vercel
1. Log in to your [Vercel Dashboard](https://vercel.com/) and click **Add New** -> **Project**.
2. Import your GitHub repository.
3. In the project configuration page, set:
   - **Framework Preset**: `Vite` (Vercel usually autodetects this).
   - **Root Directory**: `DevBoard Dashboard`.

### Step 2.2: Add Build Settings and Environment Variables
1. Under the **Build and Development Settings**, leave the default settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
2. Expand the **Environment Variables** section and add:
   - **Key**: `VITE_API_URL`
   - **Value**: Your deployed Railway API URL (e.g. `https://devboard-api-production.up.railway.app`). Make sure NOT to include a trailing slash.
3. Click **Deploy**.
4. Once completed, Vercel will give you a public URL (e.g., `https://devboard-dashboard.vercel.app`).

---

## Part 3: Deploying & Configuring the Chrome Extension (Tracker)

The Chrome extension needs to be built locally and loaded into Chrome.

### Step 3.1: Build the Extension Locally
1. Open a terminal in the project's root directory.
2. Navigate to `DevBoard Tracker`:
   ```bash
   cd "DevBoard Tracker"
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
   This will compile the TypeScript code and generate a compiled extension inside the `DevBoard Tracker/dist/` directory.

### Step 3.2: Load the Extension in Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle switch in the top right corner).
3. Click the **Load unpacked** button in the top left corner.
4. Select the `DevBoard Tracker/dist/` directory on your computer.
5. The DevBoard Tracker extension will now be active in your browser.

### Step 3.3: Configure the API URL
1. Click the extension icon in your browser toolbar to open the popup.
2. Click the gear icon (`⚙️`) in the header to open the settings view.
3. Enter your deployed Railway API URL (e.g. `https://devboard-api-production.up.railway.app`).
4. Click **Save**. The extension will now communicate with your production database online instead of `localhost:3001`!

# RSS Music Site Template

A Lightning Network-powered Value4Value music platform template for bands and artists with existing RSS feeds. Built with Next.js, featuring instant Bitcoin payments, Nostr integration, and Podcasting 2.0 support.

> **Note**: This is a GitHub template repository. Click the green **"Use this template"** button above to create your own copy.

## Live Demo

See this template in action with all features enabled:

- **🌐 Live Demo Site**: [trm-lightning.vercel.app](https://trm-lightning.vercel.app/)
- **📦 Repository**: [ChadFarrow/TRM-Lightning](https://github.com/ChadFarrow/TRM-Lightning)
- **🔗 Nostr**: Follow and interact with the demo site on Nostr: `npub1ada8z0wzef2wynrh59drnsx32wmajven69zggcnep3dtqc0a00nshja4wl`

## Deploy to Vercel

### Step 1: Create a GitHub Account (Free)

1. Go to [github.com](https://github.com) and click "Sign up"
2. Create a free account (no credit card required)
3. Verify your email address

### Step 2: Create Your Site from This Template

**Recommended: Use the Template Button (Easiest)**

1. **Click the green "Use this template" button** at the top of this repository page
2. **Select "Create a new repository"**
3. **Name your repository** (e.g., "my-music-site")
4. **Choose public or private** (your choice)
5. **Click "Create repository from template"**

### Step 3: Create a Vercel Account (Free)

1. Go to [vercel.com](https://vercel.com)
2. Click "Sign Up" and choose "Continue with GitHub"
3. Authorize Vercel to access your GitHub account
4. Complete the signup (no credit card required)

### Step 4: Deploy Your Site

1. **In Vercel dashboard:**
   - Click "Add New Project"
   - Select your GitHub repository
   - Vercel will automatically detect it's a Next.js project

2. **Add Environment Variables and Deploy:**
   - Click "Environment Variables" and add:
     ```bash
     NEXT_PUBLIC_SITE_NAME=Your Music Site Name
     ```
   - Click "Deploy"
   - Wait 2-3 minutes for the build to complete
   - Vercel will show you your site URL (e.g., `https://my-music-site-abc123.vercel.app`)
   - Go back to "Environment Variables" and add:
     ```bash
     NEXT_PUBLIC_SITE_URL=https://your-actual-vercel-url.vercel.app
     ```
     (Replace with your actual Vercel URL shown after deployment)
   - Vercel will automatically redeploy with the updated URL

### Step 5: Add Your RSS Feeds and Visual Assets

> **Note:** The template includes example files (`.example` extensions) and clean/empty data files. These are automatically generated/updated by the system when you add your feeds. You can see example file formats in `data/feeds.json.example`, `public/static-albums.json.example`, and `public/data/albums-with-colors.json.example`.

1. **Edit your feeds:**
   - Go to your GitHub repository
   - Edit `data/feeds.json` (the template starts with an empty array: `[]`)
   - Add your RSS feed URLs:
     ```json
     [
       "https://example.com/your-album-feed.xml"
     ]
     ```
   - Commit the changes
   
   **Note:** The system automatically processes and updates `feeds.json` with metadata (id, type, title, status, priority, etc.) that the site needs. After processing:
   - **Your original URLs are preserved** in the `originalUrl` field of each feed object
   - **Publisher feeds automatically discover album feeds**: When you add a publisher feed, the system finds and adds all album feeds from that publisher
   - **Identifying your feeds**: 
     - Manually added feeds have `"source": "manual"` and your original URL in the `originalUrl` field
     - Auto-discovered feeds have `"source": "recursive"` and show the publisher feed they came from in the `discoveredFrom` field
   - The file structure changes from a simple array to an object with a `feeds` array containing all the processed metadata

2. **Add your visual assets (background, logo, icons):**
   - Go to your GitHub repository
   - Navigate to the `public/` folder (this is where all static assets go)
   - Upload or replace these files directly in the `public/` folder:
     - **Background image**: Add `public/background.webp`, `public/background.png`, `public/background.jpg`, or `public/background.jpeg`
       - **Recommended format**: WebP (best compression) or PNG (if you need transparency)
       - **Recommended size**: 1920x1080px or larger (16:9 aspect ratio)
       - This image appears as the full-page background on the homepage
       - The code automatically tries formats in this order: `.webp` → `.png` → `.jpg` → `.jpeg`
       - If the file doesn't exist, the site will work but won't show a background image
     - **Favicon**: Add `public/favicon.ico` (32x32px or 16x16px)
       - This is the small icon that appears in browser tabs
       - Format: `.ico` (required for favicon)
     - **Logo**: Add `public/logo.webp`, `public/logo.png`, `public/logo.jpg`, or `public/logo.jpeg` (optional)
       - Displayed in the header next to the menu button (both mobile and desktop)
       - The code automatically tries formats in this order: `.webp` → `.png` → `.jpg` → `.jpeg`
       - If the file doesn't exist, the logo won't be displayed (site will work normally)
     - **PWA Icons** (for mobile app installation):
       - `public/icon-192x192.webp` or `public/icon-192x192.png` (192x192px)
       - `public/icon-512x512.webp` or `public/icon-512x512.png` (512x512px)
       - `public/icon-76x76.webp` or `public/icon-76x76.png` (76x76px)
       - The code tries WebP first, then falls back to PNG
     - **Placeholder Album Art** (optional fallback):
       - `public/placeholder-album-art.webp`, `public/placeholder-album-art.png`, `public/placeholder-album-art.jpg`, or `public/placeholder-album-art.jpeg`
       - Recommended: 1200x1200px (1:1 aspect ratio)
       - Used as fallback when track or publisher artwork is missing
   - Commit the changes

3. **Vercel will automatically redeploy and parse your feeds** when you push changes to GitHub

### That's It!

Your music site is now live and free! The free tier includes:
- ✅ 100GB bandwidth/month
- ✅ Unlimited requests
- ✅ Free SSL certificate
- ✅ Global CDN (automatic)
- ✅ Automatic deployments

**Cost:** $0/month - perfect for music sites!

## Features

- **RSS Feed Parsing**: Direct RSS XML parsing (no API keys required)
- **Audio Streaming**: Full-featured audio player
- **Publisher Feed System**: Dedicated pages for music publishers with artwork
- **Content Filtering**: Albums, EPs, Singles, and Publisher Feed views
- **Progressive Web App (PWA)**: Install on mobile devices
- **Responsive Design**: Optimized for all screen sizes

## RSS Feed Requirements

- Valid RSS feeds with audio enclosures (MP3 or supported formats)
- Just add your RSS feed URLs to `feeds.json` - the system handles everything automatically
- Feeds are automatically parsed during Vercel deployment
- The Artists tab groups albums by artist name from your feeds

**Note:** On Vercel, you must edit `feeds.json` in your GitHub repository and push the changes. RSS feeds are parsed automatically during each deployment.

## Optional Enhancements (Add After Site is Live)

### Lightning Network Payments

Lightning/Value4Value payments are **optional** but fully supported. To enable Lightning payments:

1. **Add Lightning info to your RSS feeds:**
   - Lightning payment information must be added to your RSS feed using Podcasting 2.0 `<podcast:value>` tags
   - **This cannot be done in this template** - you must add Lightning info to your RSS feed wherever it was created (your podcast hosting platform, feed generator, etc.)
   - The template will automatically parse and use Lightning payment info if it's present in your feeds

2. **Enable Lightning in Vercel:**
   Add to your Vercel environment variables:
   ```bash
   NEXT_PUBLIC_ENABLE_LIGHTNING=true
   ```

3. **Enable Lightning in the site:**
   - After deployment, users need to enable Lightning payments using the toggle in the side menu
   - The toggle is located in the hamburger menu (☰) on mobile or the sidebar on desktop
   - Once enabled, users can connect their Lightning wallet and send boosts/payments

**Supported Payment Methods:**
- WebLN: Browser extension wallets (Alby, Zeus, etc.)
- NWC (Nostr Wallet Connect): Alby Hub, Mutiny, and other NWC-compatible wallets
- Lightning Addresses: user@getalby.com, user@strike.me, etc.
- Node Pubkeys: Direct keysend to Lightning node addresses

### Nostr Integration

To give your site a permanent Nostr identity for posting boosts:

1. **Create a Nostr account for your site:**
   - Go to [nostrudel.ninja/signup](https://nostrudel.ninja/signup) to create a Nostr account
   - **This is a site account** (not personal) - it will be used to post all boosts from your site
   - Set up your site's profile with display name, profile picture, bio, and website link

2. **Export your Nostr key:**
   - After creating your account and setting up your profile, export your keys from nostrudel.ninja
   - You'll need your `nsec1...` (private key) - the public key (npub) will be automatically derived from it

3. **Add key to Vercel:**
   Add to your Vercel environment variables:
   ```bash
   NEXT_PUBLIC_SITE_NOSTR_NSEC=nsec1...
   ```
   - **Important:** Keep your `nsec1...` key safe and secure! This is your private key - anyone with it can post as your site's account
   - The public key (npub) is automatically derived from the nsec, so you don't need to add it separately

**Important:** The `/boosts` page (which shows recent boosts and replies from the Nostr network) only works if you set up a Nostr account for the site using the steps above. Without Nostr keys configured, the boosts page will show "Loading boosts from Nostr relays..." but won't display any boosts.

### Optional: Custom Domain

If you have your own domain:
1. Go to your Vercel project settings
2. Click "Domains"
3. Add your domain
4. Follow the DNS configuration instructions
5. Free SSL certificate is included automatically

## For Developers

If you want to run the site locally for development or testing:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   ```bash
   # For Lightning-enabled development (recommended)
   cp env.lightning.template .env.local
   
   # OR for basic music-only development
   cp env.basic.template .env.local
   ```

3. **Configure your site name:**
   Edit `.env.local` and set:
   ```bash
   NEXT_PUBLIC_SITE_NAME="Your Music Site Name"
   ```

4. **Add your RSS feeds:**
   Edit `data/feeds.json` and add your feed URLs:
   ```json
   [
     "https://example.com/your-album-feed.xml",
     "https://example.com/your-publisher-feed.xml"
   ]
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

6. **Open your browser:**
   Navigate to `http://localhost:3000`

**Note:** For production deployment, use the GitHub + Vercel workflow described above. Local development is optional and mainly for testing changes before deploying.

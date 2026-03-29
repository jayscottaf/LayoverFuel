# LayoverFuel Production Deployment Guide

Deploy LayoverFuel to production with **layoverfuel.com** using Vercel (frontend) + Railway (backend).

**Total Cost:** $5/month
**Setup Time:** ~30 minutes
**Domains:** `layoverfuel.com` (frontend) + `api.layoverfuel.com` (backend)

---

## Architecture Overview

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Vercel CDN    │ ───▶ │  Railway API     │ ───▶ │  Neon Database  │
│  (Frontend)     │      │  (Express)       │      │  (PostgreSQL)   │
└─────────────────┘      └──────────────────┘      └─────────────────┘
  layoverfuel.com       api.layoverfuel.com         Serverless DB
```

---

## Prerequisites

- ✅ GitHub account (repo already connected)
- ✅ Domain purchased: `layoverfuel.com`
- ✅ Neon database already set up (DATABASE_URL exists)
- ⬜ Vercel account (free - sign up at vercel.com)
- ⬜ Railway account (free trial, then $5/month - sign up at railway.app)

---

## Part 1: Deploy Backend to Railway (15 minutes)

### Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose `LayoverFuel` repository
5. Railway will auto-detect Node.js and use `railway.json` config

### Step 2: Set Environment Variables

In Railway dashboard → Variables tab, add:

```bash
DATABASE_URL=postgresql://[your-neon-connection-string]
OPENAI_API_KEY=sk-[your-openai-key]
SESSION_SECRET=[generate-random-string]
NODE_ENV=production
PORT=5000
```

**Get these values from:**
- `DATABASE_URL`: Neon dashboard → Connection string
- `OPENAI_API_KEY`: OpenAI dashboard → API keys
- `SESSION_SECRET`: Generate with: `openssl rand -hex 32`

### Step 3: Deploy & Verify

1. Railway auto-deploys on variable save
2. Wait for deploy to finish (~2 minutes)
3. Copy the Railway URL (looks like: `layoverfuel-production.up.railway.app`)
4. Test health check: `https://[railway-url]/api/health`
   - Should return: `{"status": "ok", "checks": {...}}`

### Step 4: Add Custom Domain

1. In Railway → Settings → Domains
2. Click "Add Domain"
3. Enter: `api.layoverfuel.com`
4. Railway shows DNS records to add:
   ```
   Type: CNAME
   Name: api
   Value: [railway-domain].railway.app
   ```
5. Go to your domain registrar (Namecheap, GoDaddy, etc.)
6. Add the CNAME record
7. Wait 5-60 minutes for DNS propagation
8. Verify: `https://api.layoverfuel.com/api/health`

---

## Part 2: Deploy Frontend to Vercel (10 minutes)

### Step 1: Create Vercel Project

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "Add New" → "Project"
3. Import `LayoverFuel` repository
4. Vercel auto-detects Vite and uses `vercel.json` config
5. **DON'T DEPLOY YET** - need to set env vars first

### Step 2: Set Environment Variables

In Vercel → Settings → Environment Variables, add:

```bash
VITE_API_URL=https://api.layoverfuel.com
```

**Important:** Vite needs `VITE_` prefix for client-side env vars.

### Step 3: Update API Client Configuration

Vercel will build the frontend with the API URL pointing to Railway.

**Verify in `client/src/lib/queryClient.ts`:**
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
```

If this line doesn't exist, add it before `apiRequest` function.

### Step 4: Deploy Frontend

1. Back in Vercel project page, click "Deploy"
2. Wait for build (~2 minutes)
3. Vercel gives you a URL: `layoverfuel.vercel.app`
4. Test it opens correctly

### Step 5: Add Custom Domain

1. In Vercel → Settings → Domains
2. Add domain: `layoverfuel.com`
3. Vercel shows DNS records:
   ```
   Type: A
   Name: @
   Value: 76.76.21.21

   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```
4. Go to domain registrar → Add DNS records
5. Wait 5-60 minutes for propagation
6. Verify: `https://layoverfuel.com`

---

## Part 3: Configure CORS for Production

Update `server/index.ts` to allow your Vercel domain:

```typescript
// Add to CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'https://layoverfuel.com',
    'https://www.layoverfuel.com',
    'https://layoverfuel.vercel.app', // Vercel preview URL
  ],
  credentials: true,
};

app.use(cors(corsOptions));
```

**Commit and push:**
```bash
git add server/index.ts
git commit -m "Add production CORS origins"
git push
```

Railway auto-deploys the backend update.

---

## Part 4: Test Everything

### Checklist

- [ ] Frontend loads: `https://layoverfuel.com`
- [ ] Backend health: `https://api.layoverfuel.com/api/health`
- [ ] Login works
- [ ] Registration works
- [ ] Snap to Log works (meal photo analysis)
- [ ] Dashboard shows data
- [ ] Offline queue works (test in DevTools → Network → Offline)

### Test Login Flow

1. Go to `https://layoverfuel.com`
2. Register new account
3. Complete onboarding
4. Upload meal photo
5. Check Daily Log tab - meal should appear

---

## Part 5: Update Environment Variables

### Local Development

Update `.env` (if you have one):
```bash
VITE_API_URL=http://localhost:5000
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
SESSION_SECRET=...
```

### Replit (if keeping for dev)

In Replit Secrets:
```bash
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
SESSION_SECRET=...
```

---

## Deployment Workflow (After Initial Setup)

```bash
# Make code changes
git add .
git commit -m "Add new feature"
git push

# Auto-deploys to:
✓ Railway (backend) - ~2 minutes
✓ Vercel (frontend) - ~2 minutes
```

**No manual steps needed!** Both platforms auto-deploy on git push.

---

## Monitoring & Logs

### Railway (Backend)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# View real-time logs
railway logs

# Check deployment status
railway status
```

**Web Dashboard:**
- Logs: Railway → Deployments → View logs
- Metrics: Railway → Metrics (CPU, memory, requests)
- Database queries: Neon dashboard

### Vercel (Frontend)

**Web Dashboard:**
- Build logs: Vercel → Deployments → View Function Logs
- Analytics: Vercel → Analytics
- Errors: Vercel → Logs

---

## Troubleshooting

### Issue: "CORS Error" in browser console

**Fix:** Check `server/index.ts` CORS origins include your Vercel domain.

```typescript
origin: ['https://layoverfuel.com', 'https://www.layoverfuel.com']
```

### Issue: API requests fail with 404

**Fix:** Verify `VITE_API_URL` in Vercel env vars:
1. Vercel → Settings → Environment Variables
2. Should be: `https://api.layoverfuel.com`
3. Redeploy after changing

### Issue: Database connection fails

**Fix:** Check Railway environment variable `DATABASE_URL`:
1. Railway → Variables
2. Copy connection string from Neon dashboard
3. Format: `postgresql://user:password@host/database?sslmode=require`

### Issue: Session not persisting

**Fix:** Check `SESSION_SECRET` is set in Railway:
1. Railway → Variables
2. Generate new: `openssl rand -hex 32`
3. Redeploy

### Issue: Cold start delays on Railway

**Note:** Railway Hobby ($5) has no cold starts. If you see delays:
1. Check Railway plan (should be Hobby, not Trial)
2. Verify service is running: Railway → Deployments → Status

---

## Scaling Guide

### Current Limits (Free/Cheap Tier)

| Resource | Limit | When to Upgrade |
|----------|-------|-----------------|
| Railway | 500MB RAM | Heavy traffic (1000+ concurrent) |
| Neon DB | 0.5GB storage | 10,000+ meal logs |
| Vercel | 100GB bandwidth | 50,000+ visitors/month |

### Upgrade Path

**100-1,000 users:**
- Railway: Stay on $5/month Hobby
- Neon: Stay on free tier
- Vercel: Stay on free tier
- **Total: $5/month**

**1,000-10,000 users:**
- Railway: Upgrade to $20/month (8GB RAM)
- Neon: Upgrade to $19/month (10GB storage)
- Vercel: Stay on free tier
- **Total: $39/month**

**10,000+ users:**
- Railway: $50/month (32GB RAM)
- Neon: $69/month (50GB storage)
- Vercel: Pro $20/month (advanced analytics)
- **Total: $139/month**

---

## iOS App Integration (Future)

Your backend is **already ready** for iOS app development:

**API Base URL:** `https://api.layoverfuel.com`

**Example Swift Code:**
```swift
let baseURL = "https://api.layoverfuel.com"

// Login endpoint
func login(email: String, password: String) async throws {
    let url = URL(string: "\(baseURL)/api/auth/login")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.addValue("application/json", forHTTPHeaderField: "Content-Type")

    let body = ["email": email, "password": password]
    request.httpBody = try JSONEncoder().encode(body)

    let (data, response) = try await URLSession.shared.data(for: request)
    // Handle response
}
```

**All existing endpoints work with iOS:**
- `/api/auth/login`
- `/api/auth/register`
- `/api/meal-analysis`
- `/api/dashboard`
- `/api/logs/nutrition`

---

## Cost Breakdown

### Monthly Costs

- **Railway Hobby:** $5/month (always-on backend)
- **Vercel Hobby:** $0/month (unlimited frontend deploys)
- **Neon Free:** $0/month (0.5GB database)
- **Domain:** $12/year (~$1/month)

**Total: ~$6/month**

Compare to:
- Replit Autoscale: $20-50/month
- AWS equivalent: $30-50/month (EC2 + RDS + CloudFront)

---

## Support Resources

- **Vercel Docs:** https://vercel.com/docs
- **Railway Docs:** https://docs.railway.app
- **Neon Docs:** https://neon.tech/docs
- **Vite Docs:** https://vitejs.dev
- **Express Docs:** https://expressjs.com

---

## Quick Reference

**Frontend URL:** https://layoverfuel.com
**Backend URL:** https://api.layoverfuel.com
**Health Check:** https://api.layoverfuel.com/api/health

**Deploy Command:** `git push` (auto-deploys both)

**View Logs:**
```bash
# Backend (Railway)
railway logs

# Frontend (Vercel)
# Check web dashboard → Logs
```

---

🚀 **You're Ready to Launch!**

After completing this guide, your production deployment will be:
- ✅ Live on custom domain
- ✅ Auto-deploying on git push
- ✅ Monitored with logs and metrics
- ✅ Ready to scale to 10,000+ users
- ✅ iOS app backend ready

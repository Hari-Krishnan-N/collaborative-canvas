# Deployment Guide

This guide covers deploying the Collaborative Drawing Canvas to various hosting platforms.

## 🚀 Quick Deploy Options

### Option 1: Railway (Recommended - Free Trial)

Railway offers the easiest deployment with automatic Node.js detection and WebSocket support.

#### Steps:

1. **Sign up at Railway**
   - Go to [railway.app](https://railway.app/)
   - Sign in with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your forked/cloned repository

3. **Configure Deployment**
   - Railway auto-detects Node.js
   - No additional configuration needed
   - WebSocket support is automatic

4. **Deploy**
   - Railway automatically builds and deploys
   - You'll get a URL like: `your-app.up.railway.app`
   - First deployment takes ~2-3 minutes

5. **Custom Domain (Optional)**
   - Go to Settings → Domains
   - Add your custom domain

#### Environment Variables

No environment variables required for basic deployment. The app uses:
- Default port: `8080` (Railway auto-assigns `PORT` env variable)
- WebSocket protocol auto-detects (ws:// or wss://)

---

### Option 2: Render (Free Tier Available)

Render provides reliable hosting with a generous free tier.

#### Steps:

1. **Sign up at Render**
   - Go to [render.com](https://render.com/)
   - Sign in with GitHub

2. **Create New Web Service**
   - Click "New" → "Web Service"
   - Connect your GitHub repository

3. **Configure Service**
   ```
   Name: collaborative-canvas
   Environment: Node
   Build Command: npm install
   Start Command: npm start
   ```

4. **Plan Selection**
   - Select "Free" tier
   - Note: Free tier spins down after 15 min of inactivity

5. **Deploy**
   - Click "Create Web Service"
   - Render builds and deploys automatically
   - URL format: `your-app.onrender.com`

#### Important Notes for Render:

- **Cold Starts**: Free tier has 30-60s spin-up time after inactivity
- **WebSocket Support**: Fully supported on all tiers
- **Persistent Connection**: Recommended to upgrade to paid tier for production

---

### Option 3: Heroku (Paid - $5/month minimum)

Heroku is reliable but no longer offers a free tier.

#### Steps:

1. **Install Heroku CLI**
   ```bash
   # macOS
   brew tap heroku/brew && brew install heroku

   # Windows
   # Download from https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Login to Heroku**
   ```bash
   heroku login
   ```

3. **Create Heroku App**
   ```bash
   cd collaborative-canvas
   heroku create your-app-name
   ```

4. **Deploy**
   ```bash
   git push heroku master
   ```

5. **Open App**
   ```bash
   heroku open
   ```

#### Heroku Configuration:

Create a `Procfile` in the root directory:
```
web: node server/server.js
```

---

## 🔧 Environment Configuration

### PORT Configuration

The app auto-detects the PORT from the environment:

```javascript
const PORT = process.env.PORT || 8080;
```

Most platforms (Railway, Render, Heroku) automatically set the `PORT` variable.

### WebSocket Protocol

The client auto-detects WebSocket protocol:

```javascript
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
```

- Local development: `ws://localhost:8080`
- Production (HTTPS): `wss://your-domain.com`

---

## 🧪 Testing Deployed App

After deployment, test the following:

### 1. Basic Connectivity
```bash
curl https://your-app-url.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "connectedClients": 0,
  "rooms": 0,
  "timestamp": 1234567890
}
```

### 2. WebSocket Connection

Open browser console and check:
```
✓ WebSocket connected
✓ Connected (User-XXXX)
```

### 3. Multi-User Test

1. Open app in 2+ browser tabs
2. Draw in one tab
3. Verify drawing appears in other tabs in real-time

---

## 🌐 Custom Domain Setup

### Railway

1. Go to your project → Settings → Domains
2. Click "Add Domain"
3. Follow DNS configuration instructions
4. Railway provides automatic SSL

### Render

1. Go to your service → Settings
2. Scroll to "Custom Domains"
3. Add your domain
4. Configure DNS records
5. SSL is automatic

---

## 📊 Monitoring

### Health Check Endpoint

```
GET /health
```

Returns:
- Server status
- Connected clients count
- Active rooms count
- Timestamp

### Stats Endpoint

```
GET /stats
```

Returns:
- Detailed room statistics
- Drawing operations count per room
- User count per room

---

## 🔥 Troubleshooting

### WebSocket Connection Fails

**Symptoms**: "Disconnected" status, can't see other users

**Solutions**:
1. Verify HTTPS is enabled (required for secure WebSocket)
2. Check if platform supports WebSocket (all mentioned platforms do)
3. Verify PORT environment variable is set correctly
4. Check firewall/proxy settings

### App Won't Start

**Symptoms**: Deployment succeeds but app crashes

**Solutions**:
1. Check build logs for errors
2. Verify `package.json` has correct start script:
   ```json
   "scripts": {
     "start": "node server/server.js"
   }
   ```
3. Ensure `type: "module"` is in `package.json` (for ES modules)
4. Check Node.js version (requires 14+)

### Cold Start Delays (Render Free Tier)

**Symptoms**: First request takes 30-60 seconds

**Solutions**:
1. Use Railway instead (no cold starts on free trial)
2. Upgrade to Render paid tier ($7/month)
3. Use an uptime monitor to keep app warm

### High Latency

**Symptoms**: Drawings lag or skip

**Solutions**:
1. Deploy to region closest to users
2. Check network latency: `/health` endpoint shows connection time
3. Upgrade to paid tier for better performance
4. Consider CDN for static assets

---

## 🎯 Recommended Platform Comparison

| Feature | Railway | Render (Free) | Render (Paid) | Heroku |
|---------|---------|---------------|---------------|--------|
| **Price** | Free trial | Free | $7/month | $5/month |
| **WebSocket** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Cold Starts** | ❌ No | ⚠️ Yes | ❌ No | ❌ No |
| **Auto-Deploy** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **SSL** | ✅ Free | ✅ Free | ✅ Free | ✅ Free |
| **Ease of Setup** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Best For** | Quick demos | Testing | Production | Enterprise |

### Recommendation:
- **For Submission/Demo**: Railway (easiest, no cold starts)
- **For Learning**: Render Free (generous limits)
- **For Production**: Render Paid or Railway Paid
- **For Enterprise**: Heroku

---

## 📝 Quick Checklist

Before deploying, ensure:

- [ ] `package.json` has `"type": "module"`
- [ ] `package.json` has correct start script
- [ ] `.gitignore` excludes `node_modules/`
- [ ] All dependencies are in `package.json`
- [ ] Code uses `process.env.PORT`
- [ ] WebSocket protocol auto-detects (ws/wss)
- [ ] Tested locally with `npm start`

After deploying:

- [ ] `/health` endpoint returns 200
- [ ] WebSocket connects successfully
- [ ] Multi-user drawing works
- [ ] All features functional (colors, undo, etc.)
- [ ] Mobile responsive (test on phone)

---

## 🆘 Support

If you encounter issues:

1. Check platform status page
   - Railway: [status.railway.app](https://status.railway.app/)
   - Render: [status.render.com](https://status.render.com/)

2. Review deployment logs in platform dashboard

3. Test locally first: `npm start`

4. Check WebSocket compatibility: [websocket.org/echo.html](https://websocket.org/echo.html)

---

**Ready to deploy? Start with Railway for the quickest setup!** 🚀

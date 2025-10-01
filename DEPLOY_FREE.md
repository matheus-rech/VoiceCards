# 🚀 FREE Deployment Guide for VoiceCards MCP Server

Deploy your MCP server for **$0/month** using these platforms. All include free SSL, auto-scaling, and GitHub integration.

## 📊 Platform Comparison

| Platform | Free Tier | Best For | Limits |
|----------|-----------|----------|---------|
| **Railway** | $5 credit/month | Quick deploy | ~500 hours/month |
| **Render** | 750 hours/month | Production apps | Spins down after 15min |
| **Vercel** | Unlimited | Serverless APIs | 10 sec timeout |
| **Fly.io** | 3 shared VMs | Always-on apps | Limited regions |
| **Replit** | Always free | Development | Public code only |

## 🎯 Option 1: Railway (Recommended - Easiest)

### One-Click Deploy
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/deploy?template=https://github.com/YOUR_USERNAME/voicecards)

### Manual Deploy
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Add environment variables
railway variables set SUPABASE_URL="your_url_here"
railway variables set SUPABASE_ANON_KEY="your_key_here"

# Deploy
railway up

# Get your URL
railway domain
```

**Your app**: `https://flashcard-mcp-server.up.railway.app`

## 🔧 Option 2: Render (Best Free Tier)

### One-Click Deploy
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/YOUR_USERNAME/voicecards)

### Manual Deploy
1. Push code to GitHub
2. Go to [render.com](https://render.com)
3. Click "New +" → "Web Service"
4. Connect GitHub repo
5. Use these settings:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node dist/index2.js`
   - **Plan**: Free
6. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
7. Click "Create Web Service"

**Your app**: `https://flashcard-mcp-server.onrender.com`

## ⚡ Option 3: Vercel (Serverless)

### One-Click Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/voicecards&env=SUPABASE_URL,SUPABASE_ANON_KEY)

### Manual Deploy
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Add secrets
vercel secrets add supabase-url "your_url_here"
vercel secrets add supabase-anon-key "your_key_here"

# Deploy to production
vercel --prod
```

**Your app**: `https://voicecards.vercel.app`

## 🦋 Option 4: Fly.io (Global Edge)

### Setup
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Sign up/Login
fly auth signup

# Launch app
fly launch

# Set secrets
fly secrets set SUPABASE_URL="your_url_here"
fly secrets set SUPABASE_ANON_KEY="your_key_here"

# Deploy
fly deploy
```

**Your app**: `https://flashcard-mcp-server.fly.dev`

## 🔄 Option 5: GitHub Actions + Pages (Serverless)

### Automatic Deployment
1. Fork/push to GitHub
2. Go to Settings → Secrets
3. Add:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. Enable GitHub Actions
5. Push to main branch

The included workflow will auto-deploy to your chosen platform!

## 🛠️ Quick Setup Script

```bash
#!/bin/bash
# Save as deploy.sh and run: bash deploy.sh

echo "🚀 VoiceCards MCP Deployment"
echo "Choose platform:"
echo "1) Railway (Easiest)"
echo "2) Render (Best free tier)"
echo "3) Vercel (Serverless)"
echo "4) Fly.io (Global)"
read -p "Enter choice (1-4): " choice

case $choice in
  1)
    npm install -g @railway/cli
    railway login
    railway init
    echo "Enter your Supabase URL:"
    read SUPABASE_URL
    echo "Enter your Supabase Anon Key:"
    read SUPABASE_ANON_KEY
    railway variables set SUPABASE_URL="$SUPABASE_URL"
    railway variables set SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
    railway up
    railway domain
    ;;
  2)
    echo "1. Push to GitHub"
    echo "2. Go to https://render.com"
    echo "3. Click 'New +' → 'Web Service'"
    echo "4. Connect your repo"
    echo "5. Add env variables in dashboard"
    ;;
  3)
    npm install -g vercel
    vercel
    ;;
  4)
    curl -L https://fly.io/install.sh | sh
    fly auth signup
    fly launch
    ;;
esac

echo "✅ Deployment initiated!"
```

## 🔐 Environment Variables

All platforms need these two variables:
```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
```

Get these from your Supabase dashboard:
1. Go to Settings → API
2. Copy "Project URL" and "anon public key"

## 🎉 Test Your Deployment

```bash
# Test the MCP server
curl https://your-app-url.com/health

# Test with MCP Inspector
npx @modelcontextprotocol/inspector https://your-app-url.com

# Test a tool call
curl -X POST https://your-app-url.com/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/list"
  }'
```

## 💡 Pro Tips

1. **Railway**: Best for quick testing, automatic deploys
2. **Render**: Best free tier, good for production
3. **Vercel**: Best for serverless, infinite scalability
4. **Fly.io**: Best for global distribution

## 🆘 Troubleshooting

**"Build failed"**
- Check `npm run build` works locally
- Ensure all TypeScript files compile

**"Cannot connect to Supabase"**
- Verify environment variables are set
- Check Supabase project is active

**"MCP tools not working"**
- Check logs in platform dashboard
- Verify `/api/mcp` endpoint responds

## 📈 Scaling Up

When you outgrow free tier:
- **Railway**: $5/month for hobby
- **Render**: $7/month for starter
- **Vercel**: $20/month for pro
- **Fly.io**: $1.94/month per VM

## 🎯 Next Steps

1. Choose a platform above
2. Deploy in 5 minutes
3. Test with voice client
4. Share your URL!

---

**Need help?** Most platforms have great free support. Railway and Render have active Discord communities!
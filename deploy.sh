#!/bin/bash

# VoiceCards MCP Server - Easy Deploy Script
# Run: chmod +x deploy.sh && ./deploy.sh

set -e

echo "🎯 VoiceCards MCP Server Deployment"
echo "===================================="
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install Node.js first."
    exit 1
fi

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ git is not installed. Please install git first."
    exit 1
fi

# Build the project first
echo "📦 Building project..."
npm install
npm run build
echo "✅ Build complete!"
echo ""

# Check for .env file
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating one..."
    echo "Enter your Supabase URL:"
    read -r SUPABASE_URL
    echo "Enter your Supabase Anon Key:"
    read -r SUPABASE_ANON_KEY
    echo "SUPABASE_URL=$SUPABASE_URL" > .env
    echo "SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" >> .env
    echo "✅ .env file created!"
fi

echo ""
echo "🚀 Choose your deployment platform:"
echo ""
echo "1) Railway     - $5 free credit/month, easiest setup"
echo "2) Render      - 750 free hours/month, auto-sleep"
echo "3) Vercel      - Unlimited requests, 10s timeout"
echo "4) Fly.io      - 3 free VMs, global deployment"
echo "5) Local only  - Just test locally"
echo ""
read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        echo ""
        echo "🚂 Deploying to Railway..."
        echo ""

        # Check if Railway CLI is installed
        if ! command -v railway &> /dev/null; then
            echo "Installing Railway CLI..."
            npm install -g @railway/cli
        fi

        echo "📝 Steps:"
        echo "1. Running 'railway login' - login with GitHub"
        railway login

        echo "2. Initializing new Railway project..."
        railway init

        echo "3. Setting environment variables..."
        source .env
        railway variables set SUPABASE_URL="$SUPABASE_URL"
        railway variables set SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"

        echo "4. Deploying to Railway..."
        railway up

        echo ""
        echo "✅ Deployed to Railway!"
        echo "🌐 Getting your URL..."
        railway domain
        ;;

    2)
        echo ""
        echo "🔧 Deploying to Render..."
        echo ""
        echo "📝 Manual steps required:"
        echo "1. Go to https://render.com and sign up/login"
        echo "2. Click 'New +' → 'Web Service'"
        echo "3. Connect this GitHub repo (push your code first)"
        echo "4. Use these settings:"
        echo "   - Build Command: npm install && npm run build"
        echo "   - Start Command: node dist/index2.js"
        echo "   - Environment: Node"
        echo "   - Plan: Free"
        echo "5. Add environment variables from your .env file"
        echo "6. Click 'Create Web Service'"
        echo ""
        echo "First, let's push your code to GitHub:"
        read -p "Enter your GitHub username: " github_user
        read -p "Enter repository name (e.g., voicecards): " repo_name

        git init
        git add .
        git commit -m "Initial commit: VoiceCards MCP Server"
        git branch -M main
        git remote add origin "https://github.com/$github_user/$repo_name.git"

        echo ""
        echo "📝 Now run: git push -u origin main"
        echo "Then follow the Render steps above!"
        ;;

    3)
        echo ""
        echo "⚡ Deploying to Vercel..."
        echo ""

        # Check if Vercel CLI is installed
        if ! command -v vercel &> /dev/null; then
            echo "Installing Vercel CLI..."
            npm install -g vercel
        fi

        echo "Running Vercel deployment..."
        vercel

        echo ""
        echo "📝 After deployment, add your secrets:"
        echo "vercel secrets add supabase-url 'your-url'"
        echo "vercel secrets add supabase-anon-key 'your-key'"
        ;;

    4)
        echo ""
        echo "🦋 Deploying to Fly.io..."
        echo ""

        # Check if Fly CLI is installed
        if ! command -v fly &> /dev/null; then
            echo "Installing Fly CLI..."
            curl -L https://fly.io/install.sh | sh
            export FLYCTL_INSTALL="/home/$USER/.fly"
            export PATH="$FLYCTL_INSTALL/bin:$PATH"
        fi

        echo "Authenticating with Fly.io..."
        fly auth signup

        echo "Launching app..."
        fly launch

        echo "Setting secrets..."
        source .env
        fly secrets set SUPABASE_URL="$SUPABASE_URL"
        fly secrets set SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"

        echo "Deploying..."
        fly deploy
        ;;

    5)
        echo ""
        echo "🏠 Running locally..."
        echo ""
        source .env
        export SUPABASE_URL
        export SUPABASE_ANON_KEY
        npm start
        ;;

    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📖 Next steps:"
echo "1. Test your MCP server with: npx @modelcontextprotocol/inspector"
echo "2. Connect a voice client (Alexa, ElevenLabs, or Web)"
echo "3. Start studying hands-free!"
echo ""
echo "Need help? Check DEPLOY_FREE.md for detailed instructions."
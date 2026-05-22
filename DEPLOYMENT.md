# SpendWise — Deployment Guide

## Prerequisites
- Node.js 18+
- Firebase account (free tier is fine)
- Vercel account (free tier)
- Git

---

## Step 1: Firebase Setup

### 1.1 Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Add project** → name it `spendwise` (or anything you like)
3. Disable Google Analytics (optional) → **Create project**

### 1.2 Enable Authentication
1. In Firebase Console → **Authentication** → **Get started**
2. Click **Sign-in method** tab → Enable **Google**
3. Add your project's domain to authorized domains after deploying

### 1.3 Create Firestore Database
1. **Firestore Database** → **Create database**
2. Choose **Start in production mode** (we have rules)
3. Select a region close to you (e.g., `asia-south1` for India)

### 1.4 Deploy Security Rules
In Firebase Console → Firestore → **Rules** tab, paste the contents of `firestore.rules`
OR install Firebase CLI and run:
```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # link to your project
firebase deploy --only firestore:rules,firestore:indexes
```

### 1.5 Get Firebase Config
1. Firebase Console → **Project Settings** (gear icon) → **Your apps**
2. Click **Add app** → Web → name it `spendwise-web`
3. Copy the `firebaseConfig` object values

---

## Step 2: Environment Variables

Create `.env.local` in the project root:
```bash
cp .env.local.example .env.local
```

Fill in values from the Firebase config:
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

---

## Step 3: Local Development

```bash
npm install
npm run dev
# Open http://localhost:3000
```

---

## Step 4: Deploy to Vercel

### Option A: Via Vercel CLI
```bash
npm install -g vercel
vercel login
vercel         # follow prompts
```

### Option B: Via GitHub (recommended)
1. Push to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial SpendWise app"
   git remote add origin https://github.com/YOUR_USERNAME/spendwise.git
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com) → **New Project** → import your GitHub repo

3. In Vercel project settings → **Environment Variables**, add all 6 `NEXT_PUBLIC_FIREBASE_*` vars

4. Click **Deploy** — Vercel auto-deploys on every push to main

### After Deploy
1. Copy your Vercel URL (e.g., `https://spendwise-xyz.vercel.app`)
2. In Firebase Console → **Authentication** → **Settings** → **Authorized domains**
3. Add your Vercel domain

---

## Firestore Schema

Collections created automatically:

```
/transactions/{id}
  userId: string
  type: 'income' | 'expense'
  amount: number
  category: string
  date: string (YYYY-MM-DD)
  notes: string
  createdAt: string (ISO)
  projectId?: string

/budgets/{userId_month_category}
  userId: string
  month: string (YYYY-MM)
  category: string
  planned: number
  createdAt: string

/projects/{id}
  userId: string
  name: string
  description: string
  totalBudget: number
  paid: number
  startDate: string
  endDate?: string
  status: 'active' | 'completed' | 'paused'
  createdAt: string

/borrowings/{id}
  userId: string
  type: 'borrowed' | 'lent'
  amount: number
  person: string
  description: string
  date: string
  dueDate?: string
  repaidAmount: number
  status: 'pending' | 'partial' | 'repaid'
  createdAt: string

/emergencyFunds/{userId}
  userId: string
  targetAmount: number
  currentBalance: number
  usedAmount: number
  lastUpdated: string

/userSettings/{userId}
  userId: string
  financialMode: 'normal' | 'high-expense'
  weeklyBudget: number
  monthlyIncomeTarget: number
  emergencyFundTarget: number
  createdAt: string
  updatedAt: string
```

---

## Backup & Restore

- **Export**: Settings page → "Export Backup" → downloads JSON
- **Import**: Settings page → "Import Backup" → upload JSON file
- **Recommendation**: Export monthly and store in Google Drive / iCloud

---

## Costs

All Firebase free-tier limits are more than sufficient for personal use:
- Firestore: 1GB storage, 50K reads/day, 20K writes/day (free)
- Auth: unlimited Google sign-ins (free)
- Vercel: unlimited personal projects (free)

**Total cost: ₹0/month**

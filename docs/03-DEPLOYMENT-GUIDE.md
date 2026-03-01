# 🚀 Deployment Guide - Final Year Portal

**Last Updated:** October 22, 2025  
**Status:** Production-ready deployment guide

---

## 📋 Quick Navigation

- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Firestore Rules Deployment](#firestore-rules-deployment)
- [Application Deployment](#application-deployment)
- [Post-Deployment Testing](#post-deployment-testing)
- [Troubleshooting](#troubleshooting)

---

## ✅ Pre-Deployment Checklist

### Code Quality
- [ ] All tests passing (18/18 automated checks)
- [ ] No console errors or warnings
- [ ] Mobile responsive design verified
- [ ] Loading states implemented everywhere
- [ ] Error handling complete
- [ ] Code reviewed and approved

### Firebase Setup
- [ ] Firebase project created
- [ ] Firestore database enabled
- [ ] Firebase Authentication enabled
- [ ] Environment variables configured
- [ ] Backup of current Firestore rules

### Testing
- [ ] Tested with admin account
- [ ] Tested with faculty account
- [ ] Tested with student account
- [ ] CSV imports verified
- [ ] Real-time updates working
- [ ] Evaluation workflow tested
- [ ] Mobile device testing complete

---

## 🔐 Firestore Rules Deployment

### Quick Fix (5 Minutes)

**If you're getting permission errors in SystemValidator**, you need to deploy updated Firestore rules.

#### Step 1: Copy the Rules
Open: `firestore.rules` file in your project root

#### Step 2: Deploy to Firebase Console

1. **Open Firebase Console**
   - URL: https://console.firebase.google.com
   - Select project: "final-year-portal"

2. **Navigate to Rules**
   ```
   Firestore Database (left sidebar) → Rules tab
   ```

3. **Replace Rules**
   - Select ALL existing rules (Ctrl+A)
   - Delete
   - Copy ENTIRE content from `firestore.rules`
   - Paste into Firebase Console (Ctrl+V)

4. **Publish**
   - Click "Publish" button (top-right)
   - Wait for "Rules published successfully" message

5. **Verify & Test**
   - Wait 2-3 minutes for propagation
   - Hard refresh browser (Ctrl+Shift+R)
   - Run SystemValidator again
   - Should see: ✅ 18/18 checks passed

---

### What Gets Fixed

**Before Deployment:**
```
❌ Meeting Scheduling:     0/4 Fail - Permission denied
❌ Panel Evaluation:        0/4 Fail - Permission denied
❌ Extension System:        0/4 Fail - Permission denied
```

**After Deployment:**
```
✅ Meeting Scheduling:      4/4 Pass
✅ Panel Evaluation:        4/4 Pass
✅ Extension System:        4/4 Pass
✅ Meeting Requirements:    4/4 Pass
✅ Marks Visibility:        2/2 Pass

Total: 18/18 checks passed ✅
```

---

### Detailed Firestore Rules Guide

#### What Was Added

**1. Meetings Collection Rules**
```javascript
match /meetings/{meetingId} {
  allow read: if isAuthenticated();
  allow create: if isFaculty() || isAdmin();
  allow update: if isAdmin() || 
                (isFaculty() && resource.data.facultyId == request.auth.uid);
  allow delete: if isAdmin() || 
                (isFaculty() && resource.data.facultyId == request.auth.uid);
}
```

**Permissions:**
- **Read**: All authenticated users
- **Create**: Faculty and Admin only
- **Update**: Faculty (their own meetings) and Admin
- **Delete**: Faculty (their own meetings) and Admin

---

**2. Panel Evaluations Collection Rules**
```javascript
match /panelEvaluations/{evaluationId} {
  allow read: if isAuthenticated() && (
    isAdmin() || isFaculty() ||
    (isStudent() && [team member check])
  );
  allow create: if isFaculty() || isAdmin();
  allow update: if isAdmin() || 
                (isFaculty() && request.auth.uid in resource.data.evaluatedBy);
  allow delete: if isAdmin();
}
```

**Permissions:**
- **Read**: Admin, Faculty, Students (their own team only)
- **Create**: Faculty and Admin only
- **Update**: Faculty (if they're an evaluator) and Admin
- **Delete**: Admin only

---

**3. Extensions Collection Rules**
```javascript
match /extensions/{extensionId} {
  allow read: if isAuthenticated();
  allow create: if isAdmin();
  allow update: if isAdmin();
  allow delete: if isAdmin();
}
```

**Permissions:**
- **Read**: All authenticated users
- **Create**: Admin only (extensions are privileged operations)
- **Update**: Admin only
- **Delete**: Admin only

---

### Alternative: Firebase CLI Deployment

**Prerequisites:**
```powershell
# Install Firebase CLI (if not installed)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize (if not initialized)
firebase init firestore
# Select: Use existing project → final-year-portal
# Firestore rules: firestore.rules
# Firestore indexes: firestore.indexes.json
```

**Deploy Rules:**
```powershell
# Navigate to project directory
cd E:\Final_Year_Project\final-year-portal

# Deploy rules only
firebase deploy --only firestore:rules

# Expected output:
# ✔  Deploy complete!
```

---

### Verify Rules Deployment

#### Method 1: Firebase Console
1. Go to: Firestore Database → Rules
2. Look for these sections:
   - `match /meetings/{meetingId}`
   - `match /panelEvaluations/{evaluationId}`
   - `match /extensions/{extensionId}`
3. Check "Last deployed" timestamp is recent

#### Method 2: Rules Playground
1. Firebase Console → Firestore → Rules
2. Click "Rules Playground" at bottom
3. Test a query:
   ```
   Location: /meetings/test-meeting-123
   Action: get
   Authenticated: Yes
   ```
4. Should show: ✅ **Allowed**

#### Method 3: SystemValidator
1. Login as admin
2. Dashboard → Testing tab
3. Run All Validations
4. Verify: 18/18 checks passed

---

## 🌐 Application Deployment

### Environment Variables

Create `.env.local` (never commit this file):

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

**Where to find these values:**
1. Firebase Console → Project Settings (gear icon)
2. Scroll to "Your apps" section
3. Click on your web app
4. Copy configuration values

---

### Vercel Deployment (Recommended)

#### Step 1: Prepare Repository
```bash
# Ensure latest code is committed
git add .
git commit -m "Ready for deployment"
git push origin main
```

#### Step 2: Connect to Vercel
1. Go to: https://vercel.com
2. Click "Import Project"
3. Select your GitHub repository
4. Configure project:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

#### Step 3: Add Environment Variables
In Vercel dashboard:
1. Go to Project Settings → Environment Variables
2. Add each variable from `.env.local`:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
3. Select environments: Production, Preview, Development

#### Step 4: Deploy
1. Click "Deploy"
2. Wait for build to complete (3-5 minutes)
3. Get deployment URL: `https://your-project.vercel.app`

#### Step 5: Configure Custom Domain (Optional)
1. Vercel Dashboard → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Wait for SSL certificate (automatic)

---

### Alternative: Firebase Hosting

#### Step 1: Build Application
```powershell
npm run build
```

#### Step 2: Deploy to Firebase
```powershell
firebase deploy --only hosting

# Expected output:
# ✔  Deploy complete!
# Hosting URL: https://your-project.web.app
```

---

### Alternative: Manual Deployment

#### Step 1: Build
```powershell
npm run build
```

#### Step 2: Test Production Build Locally
```powershell
npm run start

# Open: http://localhost:3000
# Verify everything works
```

#### Step 3: Deploy to Your Server
```powershell
# Copy these folders to your server:
# - .next/
# - public/
# - package.json
# - next.config.mjs

# On server, install dependencies:
npm install --production

# Start application:
npm run start

# Or use PM2 for process management:
pm2 start npm --name "final-year-portal" -- start
```

---

## 🧪 Post-Deployment Testing

### Critical Tests (10 Minutes)

#### 1. Authentication (2 min)
- [ ] Can access login page
- [ ] Can login as admin
- [ ] Can login as faculty
- [ ] Can login as student
- [ ] Redirects work correctly
- [ ] Logout works

#### 2. Dashboard Access (2 min)
- [ ] Admin dashboard loads
- [ ] Faculty dashboard loads
- [ ] Student dashboard loads
- [ ] Role-specific content displays
- [ ] Navigation works

#### 3. Real-time Features (3 min)
- [ ] Create a meeting (faculty)
- [ ] Verify appears in student dashboard
- [ ] Grant extension (admin)
- [ ] Verify student sees amber alert
- [ ] Toggle marks visibility
- [ ] Verify student view updates

#### 4. Data Operations (3 min)
- [ ] Can create teams
- [ ] Can create phases
- [ ] Can create panels
- [ ] Can submit evaluations
- [ ] Can view grades
- [ ] All CRUD operations work

---

### Run SystemValidator

1. Login as admin
2. Navigate to Testing tab
3. Click "Run All Validations"
4. **Expected Result:** 18/18 checks passed

**If tests fail:**
- Check Firestore rules deployed
- Verify environment variables
- Check browser console errors
- Review [Troubleshooting](#troubleshooting) section

---

### Performance Check

Use browser DevTools (F12):

1. **Network Tab**
   - Check load times < 3 seconds
   - Verify no failed requests
   - Check bundle sizes reasonable

2. **Console Tab**
   - No error messages
   - No warning messages
   - No permission denied errors

3. **Application Tab**
   - Verify Firebase connection
   - Check local storage
   - Verify session tokens

---

### Mobile Testing

Test on actual devices or use Chrome DevTools:

1. **Responsive Design**
   ```
   F12 → Toggle device toolbar (Ctrl+Shift+M)
   Test: iPhone SE, iPhone 12 Pro, iPad, Responsive
   ```

2. **Key Features**
   - [ ] Navigation menu works
   - [ ] Forms are usable
   - [ ] Tables scroll horizontally
   - [ ] Buttons are tappable
   - [ ] Text is readable

3. **Performance**
   - [ ] Pages load quickly
   - [ ] Smooth scrolling
   - [ ] No layout shifts

---

## 🐛 Troubleshooting

### Issue 1: Deployment Build Fails

**Error:** `Build failed with exit code 1`

**Common Causes:**
1. ESLint errors
2. TypeScript errors
3. Missing dependencies
4. Environment variables not set

**Solutions:**
```powershell
# Check for errors locally
npm run lint
npm run build

# Fix any errors shown
# Commit and redeploy
```

---

### Issue 2: Application Loads But Shows Errors

**Error:** Firebase initialization errors

**Solutions:**
1. Verify all environment variables set correctly
2. Check Firebase project ID matches
3. Verify API key is valid
4. Check Firebase project billing enabled

---

### Issue 3: Firestore Rules Not Working

**Error:** Permission denied errors

**Solutions:**
1. Verify rules deployed successfully
2. Wait 2-3 minutes for propagation
3. Check "Last deployed" timestamp in console
4. Re-deploy rules if needed
5. Clear browser cache

---

### Issue 4: Real-time Updates Not Working

**Error:** Data doesn't update without refresh

**Solutions:**
1. Check Firestore connection in Network tab
2. Verify WebSocket connections established
3. Check for JavaScript errors in console
4. Verify user is authenticated
5. Check Firestore rules allow read access

---

### Issue 5: Performance Issues

**Symptoms:** Slow page loads, laggy UI

**Solutions:**
1. Check bundle size: `npm run build` shows sizes
2. Optimize images (compress, use WebP)
3. Enable caching in vercel.json or next.config
4. Check Firestore query performance
5. Consider adding pagination for large lists

---

### Issue 6: Environment Variables Not Loading

**Error:** `undefined` for Firebase config

**Solutions:**

**For Vercel:**
1. Check variables in Vercel dashboard
2. Verify variable names match exactly (case-sensitive)
3. Ensure selected for correct environment
4. Redeploy after adding variables

**For Local:**
1. Check `.env.local` exists
2. Restart dev server after changes
3. Verify variable names start with `NEXT_PUBLIC_`

---

### Issue 7: 404 Errors on Routes

**Error:** Direct URLs return 404

**Solutions:**

**For Vercel:**
- Automatically handled by Next.js

**For Firebase Hosting:**
Add to `firebase.json`:
```json
{
  "hosting": {
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

**For Custom Server:**
Configure server to serve Next.js app

---

## 🔄 Rollback Plan

### If Deployment Fails

**Vercel:**
1. Go to Deployments tab
2. Find previous successful deployment
3. Click "..." → "Promote to Production"

**Firebase Hosting:**
```powershell
firebase hosting:rollback
```

**Custom Server:**
```powershell
# Revert to previous build
git checkout <previous-commit>
npm run build
pm2 restart final-year-portal
```

---

### If Firestore Rules Cause Issues

1. Go to Firebase Console → Firestore → Rules
2. Copy backup rules from text file
3. Paste and publish
4. Wait 2-3 minutes
5. Test application

---

## 📊 Deployment Checklist Summary

### Before Deployment
- [ ] All tests passing
- [ ] Code reviewed
- [ ] Environment variables ready
- [ ] Firestore rules backed up
- [ ] Database backup created

### During Deployment
- [ ] Deploy Firestore rules first
- [ ] Wait for rules propagation (2-3 min)
- [ ] Deploy application
- [ ] Verify environment variables
- [ ] Monitor build logs

### After Deployment
- [ ] Run SystemValidator (18/18 pass)
- [ ] Test critical workflows
- [ ] Check performance
- [ ] Test on mobile
- [ ] Verify real-time updates
- [ ] Monitor error logs
- [ ] Update documentation

---

## 🎯 Success Criteria

Deployment is successful when:

1. ✅ **Build succeeds** without errors
2. ✅ **Application loads** on production URL
3. ✅ **Authentication works** for all roles
4. ✅ **SystemValidator passes** (18/18 checks)
5. ✅ **Real-time updates** function correctly
6. ✅ **No console errors** in production
7. ✅ **Mobile responsive** design works
8. ✅ **Performance acceptable** (< 3s load)

---

## 📞 Need Help?

**Quick Fixes:**
- Permission errors → Re-deploy Firestore rules
- Build errors → Check `npm run lint` and `npm run build` locally
- Environment variables → Verify in deployment platform dashboard
- Real-time issues → Check Firestore connection and rules

**Documentation:**
- [TESTING.md](TESTING.md) - Test deployed application
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues
- [README.md](README.md) - Project overview

**Commands:**
```powershell
# Check build locally
npm run build

# Test production build
npm run start

# Deploy Firestore rules only
firebase deploy --only firestore:rules

# Deploy to Vercel
vercel --prod
```

---

**Deployment Time:** 15-30 minutes  
**Difficulty:** Medium  
**Prerequisites:** Firebase project, hosting platform account  
**Support:** Check troubleshooting section or [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

**Ready to deploy? Start with [Firestore Rules](#firestore-rules-deployment)! 🚀**

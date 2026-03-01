# 🔧 Troubleshooting Guide - Final Year Portal

**Last Updated:** October 22, 2025

---

## � Quick Navigation

**Recent Fixes (2025-10-22):**
- [Phase Creation Error](#issue-1-phase-creation-error) → Fixed validation
- [CORS Errors](#issue-2-cors-errors-with-firestore) → 6 solutions
- [Team Info Display](#issue-3-team-info-showing-unknown) → Email vs UID fix
- [Mentorship Status](#issue-4-mentorship-status-not-updating) → Value mismatch fix

**Common Issues:**
- [Firebase Connection](#issue-5-firebase-initialization-failed)
- [Authentication Problems](#issue-6-authentication-issues)
- [Real-time Updates Not Working](#issue-7-real-time-updates-not-working)
- [Import CSV Errors](#issue-8-csv-import-errors)
- [Deployment Issues](#deployment-issues)

**For More:**
- See [CHANGELOG.md](CHANGELOG.md) for detailed fix history
- See [DEPLOYMENT.md](DEPLOYMENT.md#troubleshooting) for deployment-specific issues

---

## �🐛 Common Issues & Solutions

### Issue 1: Phase Creation Error

**Status:** ✅ **FIXED** (Oct 22, 2025)

### Issue 1: Phase Creation - "Evaluator role must be either mentor or panel"

**Status:** ✅ **FIXED**

**Error Message:**
```
Error evaluator role must be either mentor or panel
```

**Root Cause:**
Validation in `phaseSchema.js` was checking for `evaluatorRole` or `evaluationMode`, but the component was sending `phaseType`.

**Fix Applied:**
Updated `src/lib/phaseSchema.js` line 141 to:
```javascript
const evaluatorRole = phaseData.phaseType || phaseData.evaluatorRole || phaseData.evaluationMode;
```

**How to Verify:**
1. Go to Admin Dashboard → Phases tab
2. Click "Add Phase"
3. Fill in the form with `phaseType: mentor` or `phaseType: panel`
4. Submit
5. ✅ Should create successfully

**See Also:** [CHANGELOG.md - Phase Creation Fix](CHANGELOG.md#fixed)

---

### Issue 2: CORS Errors with Firestore

**Status:** ⚠️ **NEEDS ATTENTION**

**Error Messages:**
```
Cross-Origin Request Blocked: The Same Origin Policy disallows reading 
the remote resource at https://firestore.googleapis.com/...
(Reason: CORS request did not succeed). Status code: (null).

WebChannelConnection RPC 'Listen' stream transport errored.
```

**Possible Causes:**
1. **Network/Firewall Issues** (Most Common)
2. **VPN or Proxy Blocking**
3. **Browser Extensions**
4. **Antivirus Software**
5. **Firebase Configuration**
6. **localhost vs 127.0.0.1**

---

## 🔍 CORS Issue - Diagnostic Steps

### Step 1: Check Network Connection

**Test Firebase Connectivity:**
```powershell
# Test if you can reach Firebase
curl https://firestore.googleapis.com

# Test if you can reach your Firebase project
# Replace with your project ID
curl https://final-year-portal.firebaseio.com/.json
```

**Expected:** Should return data, not connection error

---

### Step 2: Check Browser Extensions

**Disable Extensions:**
1. Open browser in **Incognito/Private Mode**
2. Test the application
3. If it works → An extension is blocking requests

**Common Culprits:**
- Ad blockers (uBlock Origin, AdBlock)
- Privacy extensions (Privacy Badger)
- Script blockers (NoScript)
- VPN extensions

**Solution:**
- Whitelist `firestore.googleapis.com` in extensions
- Or disable extensions for localhost

---

### Step 3: Check Antivirus/Firewall

**Windows Firewall:**
```powershell
# Check if firewall is blocking
netsh advfirewall show currentprofile

# Temporarily disable (TESTING ONLY)
netsh advfirewall set allprofiles state off

# Re-enable after testing
netsh advfirewall set allprofiles state on
```

**Common Antivirus Issues:**
- Kaspersky - Blocks WebSocket connections
- Avast - Blocks certain API calls
- Norton - Intercepts HTTPS traffic

**Solution:**
- Add exception for `firestore.googleapis.com`
- Add exception for `localhost:3000`
- Temporarily disable to test

---

### Step 4: Check VPN/Proxy

**If using VPN:**
1. Disconnect VPN
2. Test application
3. If it works → VPN is blocking Firebase

**If using Corporate Network:**
- Firewall may block WebSocket connections
- Proxy may intercept requests
- Contact IT department

**Solution:**
- Use mobile hotspot for testing
- Request firewall exception from IT
- Use personal network

---

### Step 5: Check Firebase Configuration

**Verify `firebase.js` Settings:**

```javascript
// src/lib/firebase.js
const firebaseConfig = {
  apiKey: "AIzaSyA-J_Ni9d6asHp-NI8fNuATC7nwooUSdfA", // Check this is correct
  authDomain: "final-year-portal.firebaseapp.com",
  projectId: "final-year-portal",
  storageBucket: "final-year-portal.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

**Verify in Firebase Console:**
1. Go to https://console.firebase.google.com
2. Select your project
3. Go to Project Settings → General
4. Check config matches your code

---

### Step 6: Check Authorized Domains

**In Firebase Console:**
1. Go to Authentication → Settings → Authorized domains
2. Make sure these are listed:
   - `localhost`
   - `final-year-portal.firebaseapp.com`
   - Your custom domain (if any)

**Add localhost if missing:**
```
localhost
```

---

### Step 7: Use 127.0.0.1 Instead of localhost

**Sometimes localhost causes CORS issues**

**Change your URL from:**
```
http://localhost:3000
```

**To:**
```
http://127.0.0.1:3000
```

**In Firebase Console, add authorized domain:**
```
127.0.0.1
```

---

### Step 8: Check Browser Console for Detailed Errors

**Open Developer Tools (F12):**

1. **Console Tab** - Check for errors
2. **Network Tab** - Check failed requests
3. **Look for:**
   - Failed requests (red)
   - Status codes
   - Error messages

**Common Patterns:**

**If you see ERR_BLOCKED_BY_CLIENT:**
- Browser extension is blocking
- Solution: Disable extensions

**If you see ERR_CONNECTION_REFUSED:**
- Firewall/Antivirus blocking
- Solution: Add exception

**If you see ERR_NAME_NOT_RESOLVED:**
- DNS issue
- Solution: Flush DNS cache

---

## 🔧 Quick Fixes to Try

### Fix 1: Clear Browser Cache

```
1. Open DevTools (F12)
2. Right-click Refresh button
3. Select "Empty Cache and Hard Reload"
```

---

### Fix 2: Flush DNS Cache

**Windows:**
```powershell
ipconfig /flushdns
```

**Mac:**
```bash
sudo dscacheutil -flushcache
```

**Linux:**
```bash
sudo systemd-resolve --flush-caches
```

---

### Fix 3: Use Different Browser

**Test in multiple browsers:**
- Chrome
- Firefox
- Edge
- Safari

If works in one but not another → Browser-specific issue

---

### Fix 4: Update Firebase SDK

**Check your package.json:**
```json
"firebase": "^12.3.0"
```

**Update if outdated:**
```powershell
npm update firebase
```

---

### Fix 5: Add Persistence Settings

**In `src/lib/firebase.js`, add:**

```javascript
import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
    console.log('Multiple tabs open, persistence enabled in one tab only');
  } else if (err.code == 'unimplemented') {
    console.log('Browser does not support persistence');
  }
});
```

---

## 🚨 Emergency Workarounds

### Workaround 1: Use Firebase Emulator (Development Only)

**Install Firebase Tools:**
```powershell
npm install -g firebase-tools
```

**Initialize Emulator:**
```powershell
firebase init emulators
```

**Start Emulator:**
```powershell
firebase emulators:start
```

**Update `firebase.js` to use emulator:**
```javascript
if (process.env.NODE_ENV === 'development') {
  connectFirestoreEmulator(db, 'localhost', 8080);
}
```

---

### Workaround 2: Use Mobile Hotspot

**If corporate network blocking:**
1. Connect laptop to mobile hotspot
2. Test application
3. If works → Network is the issue

---

### Workaround 3: Check Windows Hosts File

**Sometimes localhost is misconfigured**

**Location:** `C:\Windows\System32\drivers\etc\hosts`

**Should contain:**
```
127.0.0.1       localhost
::1             localhost
```

**Edit as Administrator if incorrect**

---

## 📊 Diagnostic Checklist

Run through this checklist:

- [ ] Tested in Incognito mode
- [ ] Disabled browser extensions
- [ ] Temporarily disabled antivirus
- [ ] Disconnected VPN
- [ ] Tried different browser
- [ ] Flushed DNS cache
- [ ] Cleared browser cache
- [ ] Verified Firebase config
- [ ] Checked authorized domains
- [ ] Tried 127.0.0.1 instead of localhost
- [ ] Checked network connectivity
- [ ] Reviewed browser console errors
- [ ] Updated Firebase SDK
- [ ] Tested on different network

---

## 🎯 Most Likely Solutions (Ordered by Probability)

### 1. Browser Extension (40% of cases)
**Solution:** Test in Incognito mode

### 2. Antivirus/Firewall (30% of cases)
**Solution:** Add firestore.googleapis.com to exceptions

### 3. VPN/Proxy (15% of cases)
**Solution:** Disconnect VPN and test

### 4. Network Issue (10% of cases)
**Solution:** Try different network/mobile hotspot

### 5. Firebase Config (5% of cases)
**Solution:** Verify config in Firebase Console

---

## 💡 Prevention Tips

**To avoid CORS issues in future:**

1. **Keep Firebase SDK updated**
2. **Use authorized domains correctly**
3. **Document network requirements for team**
4. **Use Firebase Emulator for development**
5. **Test on multiple networks**

---

## 📞 Getting Help

**If none of these work:**

1. **Check Firebase Status:**
   - https://status.firebase.google.com

2. **Review Firebase Docs:**
   - https://firebase.google.com/docs/web/setup

3. **Stack Overflow:**
   - Search: "Firebase CORS error localhost"

4. **Firebase Support:**
   - https://firebase.google.com/support

5. **Copy Error Details:**
   - Full error message from console
   - Browser version
   - Operating system
   - Network type (home/corporate)
   - Antivirus/VPN being used

---

## 🔍 Additional Debugging

### Check Firebase Project Status

1. Go to Firebase Console
2. Check if project is active
3. Check if billing is enabled (if required)
4. Check if APIs are enabled

### Check Browser Developer Tools

**Network Tab:**
```
1. Open DevTools (F12)
2. Go to Network tab
3. Filter: "firestore"
4. Look for failed requests
5. Check headers and response
```

**Console Tab:**
```
1. Look for error stack traces
2. Note error codes
3. Check for auth errors
```

---

## ✅ Verification Steps

**After applying fixes:**

1. **Restart Development Server**
   ```powershell
   # Stop server (Ctrl+C)
   npm run dev
   ```

2. **Hard Refresh Browser**
   ```
   Ctrl + Shift + R (Windows/Linux)
   Cmd + Shift + R (Mac)
   ```

3. **Test Basic Firestore Operations**
   - Create a phase
   - View phases list
   - Update a phase
   - Check real-time updates

4. **Check Console for Errors**
   - Should see no CORS errors
   - Should see successful Firestore connections

---

### Issue 3: Team Info Showing "Unknown"

**Status:** ✅ **FIXED** (Oct 21, 2025)

**Symptoms:**
- Faculty dashboard shows "Unknown" for Team Leader
- "Not assigned" appears for Mentor even though data exists
- Team detail pages don't show leader/mentor names

**Root Cause - CRITICAL ARCHITECTURE ISSUE:**

Components were using **UID** as document ID to fetch users, but **users are keyed by EMAIL in Firestore**.

```javascript
// ❌ WRONG - Does NOT work
const leaderRef = doc(db, 'users', teamData.leaderId);  // leaderId is UID

// ✅ CORRECT - Works
const leaderRef = doc(db, 'users', teamData.leaderEmail);  // Email
```

**Architecture Rule:**
- **UID fields** (`leaderId`, `mentorId`) → Authentication/authorization checks only
- **Email fields** (`leaderEmail`, `mentorEmail`, `members`) → Firestore document lookups

**Files Fixed:**
1. `src/components/dashboard/faculty/TeamsListView.jsx` (Lines 48-66, 126-145)
2. `src/app/dashboard/teams/[teamId]/page.jsx` (Lines 100-118)
3. `src/components/dashboard/faculty/TeamInfoTab.jsx` (Lines 181, 301)

**How to Verify:**
1. Go to Faculty Dashboard → Teams tab
2. Team leader names should display (not "Unknown")
3. Mentor names should display (not "Not assigned")
4. Open team detail page
5. Leader badge should be on correct member

**Pattern to Follow:**
```javascript
// ✅ CORRECT PATTERN

// 1. Use UID for authentication checks
if (userData.uid === team.leaderId) {
  // User is the team leader
}

// 2. Use email for Firestore lookups
const userDoc = await getDoc(doc(db, 'users', team.leaderEmail));

// 3. Members array contains emails
const memberPromises = team.members.map(email =>
  getDoc(doc(db, 'users', email))
);
```

**See Also:** [CHANGELOG.md - Team Info Display Fix](CHANGELOG.md#team-info-display-issues)

---

### Issue 4: Mentorship Status Not Updating

**Status:** ✅ **FIXED** (Oct 21, 2025)

**Symptoms:**
- Faculty accepts mentorship request
- Status still shows "Pending Review"
- Request doesn't move to "Recent Activity" section
- Green "Approved" badge never appears

**Root Cause:**
Service was setting status to `'accepted'`, but UI expected `'approved'`.

```javascript
// Service (WRONG):
status: 'accepted'

// UI Badge Config (CORRECT):
approved: { label: 'Approved', className: '...', icon: CheckCircle }
```

**Files Fixed:**
1. `src/services/mentorshipService.js` (Line 195)
   ```javascript
   // Before
   status: 'accepted',
   
   // After
   status: 'approved',
   ```

2. `firestore.rules` (Line 128)
   ```javascript
   // Before
   request.resource.data.status in ['accepted', 'rejected']
   
   // After
   request.resource.data.status in ['approved', 'rejected', 'revisions_requested']
   ```

**Status Flow:**
```
pending → approved (faculty accepts)
        → rejected (faculty declines)
        → revisions_requested (faculty asks for changes)
        → cancelled (student cancels)
        → auto_rejected (team accepted another mentor)
```

**UI Badge Mappings:**
| Status | Badge Label | Color | Icon |
|--------|-------------|-------|------|
| `pending` | Pending Review | Orange | Clock |
| `approved` | Approved | Green | CheckCircle |
| `rejected` | Declined | Red | XCircle |
| `revisions_requested` | Revisions Requested | Blue | MessageSquare |

**How to Verify:**
1. Student sends mentorship request
2. Faculty goes to Dashboard → Requests tab
3. Faculty clicks "Accept & Mentor"
4. Status updates to 'approved'
5. Badge shows green "Approved"
6. Request moves to "Recent Activity" section

**See Also:** [CHANGELOG.md - Mentorship Status Fix](CHANGELOG.md#mentorship-status-value-mismatch)

---

### Issue 5: Faculty Can't Access Mentorship Requests

**Status:** ✅ **FIXED** (Oct 21, 2025)

**Symptoms:**
- Faculty can't find mentorship request review page
- "Requests" tab missing from faculty dashboard
- Quick action buttons don't navigate

**Root Cause:**
`MentorshipRequests.jsx` component existed but wasn't integrated into `FacultyDashboard.jsx`.

**Fix Applied:**
1. Added "Requests" tab to faculty dashboard
2. Imported `MentorshipRequests` component
3. Added `MessageSquare` icon
4. Updated valid tabs array
5. Made quick action buttons functional

**Files Modified:**
- `src/components/dashboard/faculty/FacultyDashboard.jsx`
- `src/components/dashboard/faculty/FacultyQuickActions.jsx`

**How to Verify:**
1. Login as faculty
2. Go to Dashboard
3. Click "Requests" tab (should be visible)
4. Should see pending mentorship requests
5. Quick action buttons should navigate to respective tabs

**See Also:** [CHANGELOG.md - Mentorship Request Navigation Fix](CHANGELOG.md#mentorship-request-page-navigation)

---

### Issue 6: Firebase Initialization Failed

**Symptoms:**
- App doesn't load
- Console shows "Firebase app not initialized"
- Blank screen or infinite loading

**Possible Causes:**
1. Missing `.env.local` file
2. Invalid Firebase credentials
3. Firebase quota exceeded
4. Network connectivity issues

**Solution:**

**1. Check `.env.local` exists:**
```bash
# Should be in project root
ls .env.local
```

**2. Verify credentials:**
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

**3. Restart dev server:**
```powershell
# Stop (Ctrl+C)
npm run dev
```

**4. Clear cache:**
```powershell
rm -rf .next
npm run dev
```

---

### Issue 7: Real-time Updates Not Working

**Symptoms:**
- Data doesn't update automatically
- Need to refresh page to see changes
- Other users' changes not visible

**Root Cause:**
Component using `getDoc` instead of `onSnapshot`.

**Solution:**

**❌ WRONG - No real-time:**
```javascript
const teamDoc = await getDoc(doc(db, 'teams', teamId));
setTeam(teamDoc.data());
```

**✅ CORRECT - Real-time:**
```javascript
useEffect(() => {
  const unsubscribe = onSnapshot(
    doc(db, 'teams', teamId),
    (snap) => {
      setTeam({ id: snap.id, ...snap.data() });
    }
  );
  
  return () => unsubscribe();  // MUST cleanup
}, [teamId]);
```

**CRITICAL:** Always return cleanup function to prevent memory leaks.

**See Also:** [CONTRIBUTING.md - Real-time Data Pattern](CONTRIBUTING.md#3-real-time-data-required)

---

### Issue 8: CSV Import Errors

**Symptoms:**
- CSV import fails with parsing errors
- Data with commas gets split incorrectly
- Team members not imported correctly

**Common Issues:**

**1. Quoted values with commas:**
```csv
# ❌ WRONG
teamName,projectName
AI Team,Chatbot System, Voice UI

# ✅ CORRECT
teamName,projectName
"AI Team","Chatbot System, Voice UI"
```

**2. Semicolon-separated member IDs:**
```csv
# ✅ CORRECT
leaderID,memberIDs
s1@gehu.ac.in,"s2@gehu.ac.in;s3@gehu.ac.in;s4@gehu.ac.in"
```

**3. Missing headers:**
```csv
# ❌ WRONG (no header row)
John Doe,s1@gehu.ac.in,student

# ✅ CORRECT
name,email,role
John Doe,s1@gehu.ac.in,student
```

**Solution:**

**Use `parseCSVLine()` helper:**
```javascript
// In ManageTeams.jsx (Lines 84-106)
const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};
```

**NEVER use `.split(',')` - it breaks on quoted values.**

**See Also:**
- `sample-users-import.csv` (example format)
- `sample-teams-import.csv` (example format)
- [CHANGELOG.md - CSV Import](CHANGELOG.md#csv-import-rules)

---

## 📝 Reporting Issues

**When reporting CORS issues, include:**

1. **Error Message** (full text from console)
2. **Browser** (Chrome 118, Firefox 120, etc.)
3. **OS** (Windows 11, macOS 14, etc.)
4. **Network** (Home/Corporate/VPN)
5. **Antivirus** (Name and version)
6. **Extensions** (List of active extensions)
7. **What you tried** (From checklist above)

---

**Last Updated:** October 22, 2025  
**Status:** Active Troubleshooting Guide

---

*Most CORS issues are resolved by testing in Incognito mode or temporarily disabling antivirus. Start there first!*

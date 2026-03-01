# Final Year Portal - AI Agent Instructions

Next.js 15 + Firebase portal for managing CSE final year projects with role-based access (students, faculty, admin, external evaluators).

## Architecture Overview

**Core Tech:** Next.js 15 (App Router, Turbopack), Firebase (Firestore + Auth), ShadCN/UI (22+ components), Sonner toasts, React Context

**Data Model:** Session-scoped architecture where all operational data (teams, phases, panels) belongs to an academic year (`sessionId`). Every query MUST filter by active session or data will leak across years.

**Key Constraint:** Faculty cannot evaluate teams they mentor - enforced at 3 layers: Firestore rules, service layer (`PanelService.checkMentorConflict`), and UI filtering.

**User Roles:** 4 roles with distinct dashboards - `student` (team management, submissions), `faculty` (mentor + panel evaluator), `admin` (system configuration, analytics), `external_evaluator` (phase-based team evaluation).

**Firebase Initialization:** Uses `initializeFirestore` with `persistentLocalCache` and `persistentMultipleTabManager` to avoid deprecated enableMultiTabIndexedDbPersistence. See [firebase.js](src/lib/firebase.js) lines 36-47 for CRITICAL pattern - must set cache BEFORE first Firestore call or will fail.

## Environment Variables

**Required for Firebase:**
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_recaptcha_key  # Optional
```
**CRITICAL:** All Firebase config vars MUST have `NEXT_PUBLIC_` prefix to be accessible in client-side code. Missing env vars will cause Firebase initialization to fail silently.

## Critical Patterns

### 1. Dual Authentication State (Email vs UID)
```javascript
const { user, userData, loading } = useAuth();
// user = Firebase Auth object (uid, email)  
// userData = Firestore /users/{email} doc (role, teamId, projectNumber)
```
**CRITICAL:** User docs keyed by **email** (not UID) in Firestore for role-based security rules. Team leadership uses `uid`, membership uses `email`. Normalize emails to lowercase when querying users collection.

### 2. Real-time Data (REQUIRED Pattern)
```javascript
useEffect(() => {
  if (!userData?.teamId) return; // Guard clause
  const unsubscribe = onSnapshot(doc(db, 'teams', userData.teamId), (snap) => {
    setTeam({ id: snap.id, ...snap.data() }); // MUST include doc ID
  });
  return () => unsubscribe(); // MUST cleanup or memory leak
}, [userData?.teamId]);
```
**Never use `getDoc`/`getDocs` for UI data** - always `onSnapshot` for real-time reactivity. See [useTeamData.js](src/hooks/useTeamData.js) for template with proper error handling and nested async operations.

**Error handling in listeners:** Always handle `unavailable` error code (network loss) and `permission-denied` (logout) gracefully - keep current data for unavailable, clear for permission-denied:
```javascript
(error) => {
  if (error.code === 'unavailable') {
    logger.warn('⚠️ Network unavailable, will retry automatically');
    // Don't clear data - Firebase will auto-reconnect
  } else if (error.code === 'permission-denied') {
    setData(null); // Clear on logout
  }
}
```

### 3. Atomic Counters (Transactions)
Auto-incrementing fields (`projectNumber`, `panelNumber`) use `runTransaction`:
```javascript
await runTransaction(db, async (transaction) => {
  const counterRef = doc(db, 'counters', 'projectNumber');
  const counterDoc = await transaction.get(counterRef);
  const nextValue = (counterDoc.data()?.value || 0) + 1;
  transaction.update(counterRef, { value: nextValue });
  return nextValue;
});
```
See `CreateTeam.jsx` lines 42-82 for complete pattern. **Never use regular `updateDoc` for counters.**

### 4. Multi-Document Updates (Batches)
```javascript
const batch = writeBatch(db);
teams.forEach(team => batch.update(doc(db, 'teams', team.id), { panelId }));
await batch.commit(); // Max 500 ops/batch
```
Use batches for parallel updates without reading values. Use transactions when reading then writing (e.g., counters).

### 5. Logging (Production-Safe)
Use `logger` from `@/lib/logger` - automatically strips sensitive data in production:
```javascript
import { logger } from '@/lib/logger';
logger.log('Info');       // Dev only
logger.warn('Warning');   // Dev only
logger.error('Error');    // Always (sanitized in prod)
logger.debug('Debug');    // Dev only
logger.info('Critical');  // Always (use sparingly)
```
**NEVER use `console.log` directly** - it leaks emails and tokens in production.

## Service Layer Philosophy

Services return `{ success: boolean, error?: string }` objects - **never throw exceptions**. Example:
```javascript
await MentorshipService.sendRequest({ teamId, mentorId, projectTitle, ... });
// Returns { success, requestId?, error? }
```
**CRITICAL:** Services handle `toast.success()` and `toast.error()` internally - **don't wrap service calls in try/catch just for toasts**. Components should check `result.success` for conditional logic. See [mentorshipService.js](src/services/mentorshipService.js) lines 40-160 for pattern.

## Session Management

**ALWAYS filter by active session:**
```javascript
const { activeSession } = useSession(); // Wait 500ms after auth for token propagation
query(collection(db, 'teams'), where('sessionId', '==', activeSession.id))
```
**Why 500ms delay?** Firebase Auth token must propagate before Firestore rules can validate permissions. See `SessionContext.js` lines 40-50.

## Phase Management System

**Sequential phases:** Projects progress through ordered phases (Synopsis, Phase 1, Phase 2, Final, External) with deadlines and submission requirements.

**Phase schema:** Defined in `src/lib/phaseSchema.js` with helpers:
- `getPhaseStatus(phase)` - Returns 'upcoming', 'active', 'completed', or 'missed'
- `canEvaluateTeam(phase, userData, team)` - Enforces mentor conflict rules
- `canEditEvaluation(phase, userData)` - Controls evaluation editing permissions

**Submission versioning:** Each submission stores `versionNumber` with automatic incrementing. History tracked in `submissions` collection with `submittedAt` timestamps.

## CSV Import (CRITICAL Pattern)

**User import (must precede team import):**
```csv
name,email,role,uid
John Doe,s1@gehu.ac.in,student,uid_123
```

**Team import (supports quoted values with commas):**
```csv
teamName,leaderID,memberIDs,projectName,mentorID
"AI Team",s1@gehu.ac.in,"s2@gehu.ac.in;s3@gehu.ac.in","Chatbot System",f1@gehu.ac.in
```
**CRITICAL:** Use `parseCSVLine()` helper in `ManageTeams.jsx` (lines 84-106) - handles quoted values with embedded commas. **Never use `.split(',')`** or you'll break on project names with commas.

## Component Conventions

- **File extensions:** `.jsx` for components, `.js` for hooks/contexts/services
- **Client directive:** ALL components need `"use client";` at top (app is client-rendered, not server components)
- **ShadCN imports:** `@/components/ui/*` - use `cn()` from `@/lib/utils` for className merging
- **Path aliases:** `@/*` maps to `src/*` (see `jsconfig.json`)

## Context Provider Order (IMMUTABLE)
```jsx
<AuthProvider>        {/* Outermost - provides user/userData */}
  <SessionProvider>   {/* Depends on auth - waits 500ms for token */}
    <TooltipProvider> {/* ShadCN requirement */}
```
See `src/app/layout.js`. **Never reorder** or auth breaks.

## Notification System

Two patterns for user feedback:
1. **Immediate feedback:** `toast.success()`, `toast.error()` from `sonner` (ephemeral, 3-5 sec duration)
2. **Persistent notifications:** `NotificationService.sendNotification()` (stored in Firestore, accessible via bell icon)

**When to use each:**
- Toasts: Action confirmations (save, delete), validation errors, API responses
- Persistent: Cross-session messages (new team member joined, mentor approved abstract, deadline reminders)

## Google Drive Integration

**Link validation:** Use `validateGoogleDriveLink()` from `@/lib/googleDriveValidator` - supports 4 URL formats:
- File view: `https://drive.google.com/file/d/FILE_ID/view`
- Open link: `https://drive.google.com/open?id=FILE_ID`
- Google Docs/Sheets: `https://docs.google.com/document/d/FILE_ID`
- Folder: `https://drive.google.com/drive/folders/FOLDER_ID`

Returns `{ valid: boolean, error: string|null, fileId: string|null }`. Always validate before saving to Firestore.

## Testing & Debugging

```bash
npm run dev              # Dev server with Turbopack (localhost:3000)
npm run build            # Production build with Turbopack
npm start                # Serve production build
npm run lint             # ESLint check
npm run panel:verify     # Verify panel assignment logic (custom script)
```

**Don't add `--turbopack` manually** - already in package.json scripts.

**SystemValidator:** Admin dashboard → Settings → System Validator runs 18+ automated checks:
- Meeting scheduling conflicts
- Panel assignment integrity  
- Submission versioning
- Phase deadline validation
- Extension approval workflow
- Evaluation aggregation logic

Run after Firestore rule changes or major feature updates. See [TESTING-GUIDE.md](docs/02-TESTING-GUIDE.md) for 100+ manual test checklist.

## Common Mistakes & Gotchas

1. **Email vs UID confusion:** User docs = email keys, `team.leaderId` = uid, `team.members` = emails
2. **Missing cleanups:** Every `onSnapshot` needs `return () => unsubscribe()` or memory leak
3. **Transaction vs Batch:** Transactions for counters (read-modify-write), batches for parallel updates
4. **Session checks:** Always verify `activeSession` exists before queries (prevents null reference errors)
5. **CSV parsing:** Use `parseCSVLine()`, **never** `.split(',')` (breaks on quoted values)
6. **Panel immutability:** Don't re-randomize panels after teams assigned (breaks existing evaluations)
7. **Email normalization:** Always `.toLowerCase()` when querying users collection
8. **Missing doc ID:** Always spread `{ id: snap.id, ...snap.data() }` in onSnapshot handlers

## Firestore Security

- **Users collection:** Email-keyed (`/users/{email}`) for efficient role-based rules
- **Counters:** Writable by authenticated users (validated server-side, not security risk)
- **Conflict detection:** Firestore rules prevent mentor evaluating own teams (see `firestore.rules` lines 1-100)
- **Helper functions:** Rules use `getUserData()`, `isAdmin()`, `isFaculty()` etc. - see firestore.rules lines 28-80 for safe null-checking patterns

**Deploy rules:** Firebase Console → Firestore Database → Rules → Publish (wait 2-3 min for propagation)

## Network Resilience

**Auto-reconnection:** Firebase SDK automatically reconnects on network loss. Built-in monitoring in [firebase.js](src/lib/firebase.js) lines 95-165:
- `onSnapshotsInSync()` detects successful reconnection
- Window online/offline listeners trigger manual `enableNetwork()`/`disableNetwork()`
- Exponential backoff (max 5 attempts) for stubborn connection issues
- `FirestoreConnectionMonitor` component shows status indicator in UI

**NEVER manually refresh or reload on network errors** - listeners will auto-resume with current data.

## Reference Files (MUST READ for new patterns)

- `src/context/AuthContext.js` - Dual auth pattern with real-time user doc listener
- `src/context/SessionContext.js` - 500ms auth token delay pattern
- `src/services/panelService.js` - Conflict detection (`checkMentorConflict`, `balanceExpertiseAcrossPanels`)
- `src/components/dashboard/student/CreateTeam.jsx` - Transaction pattern for auto-incrementing
- `src/hooks/useTeamData.js` - Custom hook template with proper cleanup
- `src/components/dashboard/admin/ManageTeams.jsx` - CSV parsing with `parseCSVLine()` helper
- `firestore.rules` - Role-based security with helper functions

## Documentation Hub

- [README.md](README.md) - Project overview, quick start, tech stack (974 lines)
- [00-DOCUMENTATION-INDEX.md](docs/00-DOCUMENTATION-INDEX.md) - Complete navigation hub
- [01-CONTRIBUTING-GUIDE.md](docs/01-CONTRIBUTING-GUIDE.md) - Code standards, PR process
- [02-TESTING-GUIDE.md](docs/02-TESTING-GUIDE.md) - 100+ test checklist, SystemValidator (10-40 min)
- [03-DEPLOYMENT-GUIDE.md](docs/03-DEPLOYMENT-GUIDE.md) - Firestore rules, env vars (5-30 min)
- [04-TROUBLESHOOTING-GUIDE.md](docs/04-TROUBLESHOOTING-GUIDE.md) - Common issues
- [05-CHANGELOG.md](docs/05-CHANGELOG.md) - Version history
- [06-ADMIN-GUIDE-CSV-IMPORT.md](docs/06-ADMIN-GUIDE-CSV-IMPORT.md) - Bulk import workflows
- [07-FEATURE-PHASE-SUBMISSIONS.md](docs/07-FEATURE-PHASE-SUBMISSIONS.md) - Submission system
- [08-FEATURE-ANNOUNCEMENTS.md](docs/08-FEATURE-ANNOUNCEMENTS.md) - Notifications
- [09-ARCHITECTURE-GUIDE.md](docs/09-ARCHITECTURE-GUIDE.md) - Technical deep-dive (717 lines)
- [10-FACULTY-USER-GUIDE.md](docs/10-FACULTY-USER-GUIDE.md) - Faculty workflows
- [10-FIRESTORE-CONNECTION-TROUBLESHOOTING.md](docs/10-FIRESTORE-CONNECTION-TROUBLESHOOTING.md) - Network issues

## Quick Start for New Contributors

1. **Setup:** Clone \u2192 `npm i` \u2192 Create `.env.local` with Firebase vars \u2192 `npm run dev`
2. **First reads:** This file \u2192 [09-ARCHITECTURE-GUIDE.md](docs/09-ARCHITECTURE-GUIDE.md) \u2192 [01-CONTRIBUTING-GUIDE.md](docs/01-CONTRIBUTING-GUIDE.md)
3. **Key patterns:** Study [AuthContext.js](src/context/AuthContext.js), [SessionContext.js](src/context/SessionContext.js), [useTeamData.js](src/hooks/useTeamData.js)
4. **Test changes:** Use SystemValidator in admin dashboard before committing
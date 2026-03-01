# 🏗️ Architecture Guide - Final Year Portal

**Comprehensive technical architecture reference**  
**Last Updated:** January 8, 2026

---

## 📋 Table of Contents

- [System Overview](#system-overview)
- [Tech Stack](#tech-stack)
- [Data Architecture](#data-architecture)
- [Authentication Flow](#authentication-flow)
- [Critical Design Patterns](#critical-design-patterns)
- [Service Layer](#service-layer)
- [Component Architecture](#component-architecture)
- [Real-time Data Flow](#real-time-data-flow)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT (Browser)                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │          Next.js 15 App (Turbopack)                  │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │  │
│  │  │  Student   │  │  Faculty   │  │   Admin    │     │  │
│  │  │ Dashboard  │  │ Dashboard  │  │ Dashboard  │     │  │
│  │  └────────────┘  └────────────┘  └────────────┘     │  │
│  │                                                        │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │         React Context Providers                │  │  │
│  │  │  • AuthContext (user, userData)               │  │  │
│  │  │  • SessionContext (activeSession)             │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Firebase SDK
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   FIREBASE BACKEND                           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Firestore  │  │    Auth      │  │   Storage    │       │
│  │  (NoSQL DB) │  │ (Email/Pass) │  │ (Files)      │       │
│  └─────────────┘  └──────────────┘  └──────────────┘       │
│                                                               │
│  Security Rules • Indexes • Functions (Future)               │
└───────────────────────────────────────────────────────────────┘
```

### Request Flow

```
User Action (Click/Submit)
    ↓
Component Handler
    ↓
Service Layer (Business Logic)
    ↓
Firebase SDK (Network Request)
    ↓
Firestore Security Rules (Validation)
    ↓
Database Operation
    ↓
onSnapshot Listener (Real-time Update)
    ↓
Component Re-render
```

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 15.5.9 | React framework with App Router |
| **React** | 19.1.1 | UI library |
| **Turbopack** | Built-in | Fast bundler (dev & build) |
| **Tailwind CSS** | 4.x | Utility-first styling |
| **ShadCN/UI** | Latest | Component library (22+ components) |
| **Lucide React** | 0.544.0 | Icon library |
| **Sonner** | 2.0.7 | Toast notifications |
| **Recharts** | 3.2.1 | Analytics charts |

### Backend & Database

| Technology | Purpose |
|------------|---------|
| **Firebase Firestore** | NoSQL database with real-time sync |
| **Firebase Auth** | Email/password authentication |
| **Firebase Storage** | File storage (future use) |
| **Firebase Security Rules** | Server-side authorization |

### Development Tools

```bash
npm run dev              # Turbopack dev server (pre-configured)
npm run build            # Production build with Turbopack
npm run lint             # ESLint validation
npm run panel:verify     # Panel assignment logic verification
```

---

## Data Architecture

### Session-Scoped Model

**KEY CONCEPT:** All operational data belongs to an academic year (`sessionId`).

```javascript
// ALWAYS filter by active session
const { activeSession } = useSession();
const teamsQuery = query(
  collection(db, 'teams'),
  where('sessionId', '==', activeSession.id)
);
```

### Firestore Collections

```
final-year-portal (Firebase Project)
│
├── users (Document ID = email)
│   ├── s1@gehu.ac.in
│   │   ├── name: "John Doe"
│   │   ├── role: "student"
│   │   ├── uid: "auth_uid_123"
│   │   ├── teamId: "team_1"
│   │   ├── sessionId: "session_2024"
│   │   └── projectNumber: 1
│   │
│   └── f1@gehu.ac.in
│       ├── name: "Dr. Smith"
│       ├── role: "faculty"
│       ├── expertise: ["AI", "ML"]
│       └── sessionId: "session_2024"
│
├── sessions
│   └── session_2024
│       ├── name: "2024-2025"
│       ├── isActive: true
│       ├── startDate: Timestamp
│       └── endDate: Timestamp
│
├── teams
│   └── team_1
│       ├── name: "AI Research Team"
│       ├── projectNumber: 1
│       ├── projectTitle: "Chatbot System"
│       ├── leaderId: "auth_uid_123" (UID!)
│       ├── members: ["s1@gehu.ac.in", "s2@gehu.ac.in"] (Emails!)
│       ├── mentorId: "faculty_uid_456" (UID!)
│       ├── panelId: "panel_1"
│       └── sessionId: "session_2024"
│
├── panels
│   └── panel_1
│       ├── panelNumber: 1
│       ├── facultyIds: ["uid1", "uid2", "uid3"]
│       ├── teamIds: ["team_1", "team_2"]
│       └── sessionId: "session_2024"
│
├── phases
│   └── phase_1
│       ├── name: "Abstract Submission"
│       ├── deadline: Timestamp
│       ├── evaluatorType: "mentor" | "panel" | "external"
│       ├── maxMarks: 10
│       └── sessionId: "session_2024"
│
├── submissions
│   └── submission_1
│       ├── teamId: "team_1"
│       ├── phaseId: "phase_1"
│       ├── driveLink: "https://drive.google.com/..."
│       ├── version: 1
│       ├── status: "submitted"
│       └── submittedAt: Timestamp
│
├── evaluations
│   └── evaluation_1
│       ├── teamId: "team_1"
│       ├── phaseId: "phase_1"
│       ├── evaluatorId: "faculty_uid"
│       ├── marks: { student1: 8, student2: 9 }
│       └── feedback: "Good work"
│
├── mentorship_requests
│   └── request_1
│       ├── teamId: "team_1"
│       ├── mentorId: "faculty_uid"
│       ├── projectAbstract: "..."
│       ├── status: "pending" | "accepted" | "rejected"
│       └── createdAt: Timestamp
│
├── notifications
│   └── notification_1
│       ├── recipientEmail: "s1@gehu.ac.in"
│       ├── type: "mentor_accepted"
│       ├── read: false
│       └── createdAt: Timestamp
│
└── counters (Atomic increments)
    ├── projectNumber
    │   └── value: 42
    └── panel_session_2024
        └── currentValue: 5
```

### Email vs UID Convention (CRITICAL!)

```javascript
// USER DOCUMENTS: Keyed by EMAIL (for Firestore rules efficiency)
const userRef = doc(db, 'users', user.email);

// TEAM LEADERSHIP: Uses UID (from Firebase Auth)
team.leaderId = userData.uid;

// TEAM MEMBERSHIP: Uses EMAIL ARRAY
team.members = ['s1@gehu.ac.in', 's2@gehu.ac.in'];

// MENTORSHIP: Uses UID
team.mentorId = facultyUser.uid;

// ALWAYS NORMALIZE EMAILS TO LOWERCASE
const normalizedEmail = email.toLowerCase();
```

---

## Authentication Flow

### Dual Authentication State

The app maintains TWO distinct authentication objects:

```javascript
const { user, userData, loading } = useAuth();

// user = Firebase Auth user object
//   - uid: string
//   - email: string
//   - emailVerified: boolean

// userData = Firestore document from /users/{email}
//   - role: 'student' | 'faculty' | 'admin' | 'external'
//   - teamId: string (students only)
//   - projectNumber: number (students only)
//   - expertise: string[] (faculty only)
//   - sessionId: string
```

### Login Flow

```
1. User enters email/password
   ↓
2. Firebase Auth validates credentials
   ↓
3. AuthContext receives Firebase user object
   ↓
4. Fetch Firestore document: /users/{user.email}
   ↓
5. Set userData in context
   ↓
6. Route user based on userData.role
   ↓
7. Dashboard renders
```

### Session Initialization (500ms Delay!)

```javascript
// SessionContext waits for Firebase Auth token propagation
useEffect(() => {
  if (!authReady || !currentUser) return;
  
  // CRITICAL: 500ms delay for token propagation
  const timer = setTimeout(() => {
    const q = query(
      collection(db, 'sessions'),
      where('isActive', '==', true)
    );
    // ... setup listener
  }, 500);
  
  return () => clearTimeout(timer);
}, [authReady, currentUser]);
```

**Why 500ms?** Firebase Auth token must propagate to Firestore backend before security rules can validate permissions.

---

## Critical Design Patterns

### 1. Real-time Data with onSnapshot (REQUIRED)

```javascript
// ✅ CORRECT: Real-time updates
useEffect(() => {
  if (!userData?.teamId) return; // Guard clause
  
  const unsubscribe = onSnapshot(
    doc(db, 'teams', userData.teamId),
    (snapshot) => {
      setTeam({
        id: snapshot.id, // MUST include doc ID
        ...snapshot.data()
      });
    }
  );
  
  return () => unsubscribe(); // MUST cleanup or memory leak
}, [userData?.teamId]);

// ❌ WRONG: No real-time updates
const teamDoc = await getDoc(doc(db, 'teams', teamId));
```

### 2. Atomic Counters with Transactions

```javascript
// ✅ CORRECT: Prevents race conditions
await runTransaction(db, async (transaction) => {
  const counterRef = doc(db, 'counters', 'projectNumber');
  const counterDoc = await transaction.get(counterRef);
  
  const nextValue = (counterDoc.data()?.value || 0) + 1;
  
  if (counterDoc.exists()) {
    transaction.update(counterRef, { value: nextValue });
  } else {
    transaction.set(counterRef, { value: nextValue });
  }
  
  return nextValue;
});

// ❌ WRONG: Race condition possible
const counterDoc = await getDoc(counterRef);
const nextValue = counterDoc.data().value + 1;
await updateDoc(counterRef, { value: nextValue });
```

### 3. Batch Operations for Multi-Document Updates

```javascript
// ✅ CORRECT: Atomic multi-document update
const batch = writeBatch(db);

teams.forEach(team => {
  const teamRef = doc(db, 'teams', team.id);
  batch.update(teamRef, { panelId: assignedPanel.id });
});

await batch.commit(); // Max 500 operations per batch

// ❌ WRONG: Non-atomic, fails partway through
for (const team of teams) {
  await updateDoc(doc(db, 'teams', team.id), { panelId });
}
```

### 4. Service Layer Error Handling

```javascript
// ✅ CORRECT: Services return success objects
export class MentorshipService {
  static async sendRequest(data) {
    try {
      // ... business logic
      return { success: true, requestId: newRequest.id };
    } catch (error) {
      console.error('Error:', error);
      return { success: false, error: error.message };
    }
  }
}

// Usage
const result = await MentorshipService.sendRequest(data);
if (result.success) {
  toast.success('Request sent!');
} else {
  toast.error(result.error);
}

// ❌ WRONG: Throwing exceptions
throw new Error('Failed to send request');
```

---

## Service Layer

### Architecture

```
src/services/
├── mentorshipService.js       # Mentorship workflow
├── notificationService.js     # Notification dispatch
├── panelService.js            # Panel algorithms
├── submissionService.js       # Phase submissions
├── teamInvitationService.js   # Team invites
├── extensionService.js        # Deadline extensions
├── meetingService.js          # Meeting scheduling
└── facultyService.js          # Faculty-specific logic
```

### Service Pattern

```javascript
export class ServiceName {
  // Static methods only (no instantiation needed)
  static async actionName(params) {
    try {
      // 1. Validate inputs
      if (!params.required) {
        return { success: false, error: 'Missing required field' };
      }
      
      // 2. Perform Firestore operations
      const result = await someFirestoreOperation();
      
      // 3. Send notifications (if needed)
      await NotificationService.sendNotification(...);
      
      // 4. Return success with data
      return { success: true, data: result };
      
    } catch (error) {
      console.error('Service error:', error);
      return { success: false, error: error.message };
    }
  }
}
```

### Key Services

#### PanelService

```javascript
// Conflict detection
const conflict = await PanelService.checkMentorConflict(teamId, panelId);
// Returns: { hasConflict: boolean, reason?: string }

// Balance expertise across panels
const panels = PanelService.balanceExpertiseAcrossPanels(faculty, panelSize);

// Assign teams to panels
await PanelService.assignTeamsToPanel(panelId, teamIds);
```

#### NotificationService

```javascript
// Single notification
await NotificationService.sendNotification(
  email,
  NotificationTypes.MENTOR_ACCEPTED,
  { teamName, mentorName },
  sessionId
);

// Bulk notifications
await NotificationService.sendBulkNotifications(
  emailArray,
  NotificationTypes.DEADLINE_REMINDER,
  { phaseName, deadline },
  sessionId
);
```

---

## Component Architecture

### Context Provider Hierarchy (IMMUTABLE ORDER!)

```jsx
// src/app/layout.js
<AuthProvider>           {/* MUST be outermost */}
  <SessionProvider>      {/* Depends on AuthContext */}
    <TooltipProvider>    {/* ShadCN requirement */}
      {children}
    </TooltipProvider>
  </SessionProvider>
</AuthProvider>
```

**Why this order?**
- AuthProvider must wrap SessionProvider (session queries need auth)
- SessionProvider waits 500ms for auth token propagation
- Changing order breaks authentication flow

### Component Conventions

```javascript
// ✅ REQUIRED: All components need "use client" directive
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button'; // Path alias
import { cn } from '@/lib/utils'; // className merging

export function MyComponent() {
  // ... component logic
}
```

### File Extension Rules

- `.jsx` for React components (per `components.json`)
- `.js` for hooks, contexts, services, utilities
- No `.tsx` or `.ts` (project uses JavaScript, not TypeScript)

---

## Real-time Data Flow

### onSnapshot Lifecycle

```
Component Mount
    ↓
useEffect runs
    ↓
Check dependencies (userData?.teamId)
    ↓
Setup onSnapshot listener
    ↓
┌──────────────────────────────────┐
│  Firestore Document Changes      │
│  (from ANY source)                │
│  - Same user's update             │
│  - Other user's update            │
│  - Admin bulk operation           │
└──────────┬───────────────────────┘
           ↓
Snapshot callback fires
    ↓
Update component state
    ↓
Component re-renders
    ↓
(Listener stays active)
    ↓
Component Unmount
    ↓
Cleanup function runs: unsubscribe()
    ↓
Listener removed
```

### Memory Leak Prevention

```javascript
// ✅ CORRECT: Cleanup function
useEffect(() => {
  const unsubscribe = onSnapshot(docRef, callback);
  return () => unsubscribe(); // CRITICAL
}, [dependencies]);

// ❌ WRONG: No cleanup - memory leak!
useEffect(() => {
  onSnapshot(docRef, callback);
  // Missing cleanup function
}, [dependencies]);
```

---

## Performance Considerations

### Query Optimization

```javascript
// ✅ GOOD: Specific query with indexes
query(
  collection(db, 'teams'),
  where('sessionId', '==', activeSession.id),
  where('mentorId', '==', userData.uid),
  orderBy('createdAt', 'desc'),
  limit(50)
);

// ❌ BAD: Fetching everything and filtering client-side
const allTeams = await getDocs(collection(db, 'teams'));
const filtered = allTeams.filter(t => t.data().sessionId === activeSession.id);
```

### Batch Size Limits

```javascript
// Firestore limits
const MAX_BATCH_SIZE = 500; // Operations per batch
const MAX_IN_QUERY = 10;    // Items in 'in' operator

// ✅ GOOD: Chunked batch operations
const chunks = chunkArray(items, 500);
for (const chunk of chunks) {
  const batch = writeBatch(db);
  chunk.forEach(item => {
    batch.update(doc(db, 'collection', item.id), item.data);
  });
  await batch.commit();
}
```

### Caching Strategy

```javascript
// FacultyService uses in-memory caching
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map();

static async getTeams() {
  const cacheKey = 'teams';
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await fetchFromFirestore();
  cache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}
```

---

## Security Architecture

### Firestore Rules Pattern

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.token.email)).data;
    }
    
    function isAdmin() {
      return isAuthenticated() && 
             getUserData().role == 'admin';
    }
    
    // Collection rules
    match /teams/{teamId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin() || 
                      isTeamMember(resource.data);
    }
  }
}
```

### Three-Layer Enforcement

**Example: Faculty cannot evaluate teams they mentor**

1. **Firestore Rules:** Block at database level
2. **Service Layer:** `PanelService.checkMentorConflict()`
3. **UI Layer:** Filter out conflicted teams from lists

---

## Development Checklist

When adding new features:

- [ ] Use `onSnapshot` for real-time data (not `getDoc`)
- [ ] Include cleanup function in `useEffect`
- [ ] Filter queries by `sessionId`
- [ ] Use transactions for counters
- [ ] Use batches for multi-document updates
- [ ] Return `{ success, error }` from services
- [ ] Add "use client" directive to components
- [ ] Update Firestore rules if new collections added
- [ ] Test with all three roles (student, faculty, admin)
- [ ] Check mobile responsiveness

---

## Related Documentation

- [Developer Guide](01-CONTRIBUTING-GUIDE.md) - Code standards and patterns
- [Testing Guide](02-TESTING-GUIDE.md) - Testing workflows
- [Deployment Guide](03-DEPLOYMENT-GUIDE.md) - Production deployment
- [API Reference](#) - Services, hooks, and utilities

---

**Last Updated:** January 8, 2026  
**Maintainer:** Development Team

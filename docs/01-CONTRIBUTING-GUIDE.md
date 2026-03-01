# 🤝 Contributing to Final Year Portal

Thank you for your interest in contributing! This guide will help you understand our development workflow, code standards, and best practices.

---

## 📋 Quick Navigation

1. [Getting Started](#getting-started)
2. [Development Workflow](#development-workflow)
3. [Code Standards](#code-standards)
4. [Architecture Guidelines](#architecture-guidelines)
5. [Testing Requirements](#testing-requirements)
6. [Pull Request Process](#pull-request-process)
7. [Review Checklist](#review-checklist)

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (for Next.js 15)
- npm 9+ or yarn 1.22+
- Firebase CLI (optional, for rules deployment)
- Git for version control

### Setup Development Environment

1. **Clone repository:**
   ```bash
   git clone https://github.com/adityav2131/final-year-portal.git
   cd final-year-portal
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Firebase:**
   Create `.env.local` with Firebase credentials:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

5. **Verify setup:**
   ```bash
   npm run lint
   ```

---

## 🔄 Development Workflow

### Branch Strategy

```
main
  ├── develop (primary development branch)
  │   ├── feature/new-feature
  │   ├── fix/bug-description
  │   └── refactor/component-name
```

**Branch Naming:**
- Feature: `feature/panel-evaluation`
- Bug fix: `fix/team-info-display`
- Refactor: `refactor/auth-context`
- Hotfix: `hotfix/critical-security-issue`

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactor (no feature change)
- `docs`: Documentation only
- `style`: Formatting (no code change)
- `test`: Adding/updating tests
- `chore`: Build process, dependencies

**Examples:**
```bash
feat(panels): add conflict detection for mentor-team assignments

- Implemented checkMentorConflict in PanelService
- Added Firestore security rules for mentor validation
- Created conflict warning alerts in UI

Closes #123

---

fix(teams): resolve "Unknown" display for team leader names

Root cause was using UID instead of email for Firestore lookups.
Changed all user doc references to use leaderEmail/mentorEmail.

Fixes #456
```

### Development Cycle

1. **Create feature branch:**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature
   ```

2. **Make changes:**
   - Write code following [Code Standards](#code-standards)
   - Test locally (see [TESTING.md](TESTING.md))
   - Update documentation if needed

3. **Commit frequently:**
   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

4. **Keep branch updated:**
   ```bash
   git fetch origin
   git rebase origin/develop
   ```

5. **Push and create PR:**
   ```bash
   git push origin feature/your-feature
   # Create Pull Request on GitHub
   ```

---

## 📝 Code Standards

### File Organization

```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.js          # Root layout (providers)
│   ├── page.js            # Homepage
│   └── dashboard/         # Role-based dashboards
├── components/            # React components
│   ├── dashboard/         # Dashboard-specific
│   │   ├── admin/        # Admin components
│   │   ├── faculty/      # Faculty components
│   │   ├── student/      # Student components
│   │   └── shared/       # Shared across roles
│   └── ui/               # ShadCN UI primitives
├── context/              # React Context providers
├── hooks/                # Custom React hooks
├── services/             # Business logic layer
└── lib/                  # Utilities & Firebase
```

### Naming Conventions

**Files:**
- Components: `PascalCase.jsx` (e.g., `CreateTeam.jsx`)
- Hooks: `camelCase.js` with `use` prefix (e.g., `useTeamData.js`)
- Services: `camelCase.js` with `Service` suffix (e.g., `panelService.js`)
- Context: `PascalCase.js` with `Context` suffix (e.g., `AuthContext.js`)

**Variables & Functions:**
- Variables: `camelCase` (e.g., `teamData`, `activeSession`)
- Functions: `camelCase` (e.g., `handleSubmit`, `fetchTeamData`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_TEAM_SIZE`)
- Components: `PascalCase` (e.g., `CreateTeamForm`)

**React Patterns:**
```javascript
// ✅ CORRECT
const CreateTeam = () => {
  const [teamName, setTeamName] = useState('');
  const { user, userData } = useAuth();
  const { activeSession } = useSession();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    // ...
  };
  
  return <form onSubmit={handleSubmit}>...</form>;
};

// ❌ AVOID
const createTeam = () => { ... }  // Component name should be PascalCase
function CreateTeam() { ... }     // Use arrow functions for consistency
```

### Component Structure

**Required order:**
```javascript
"use client";  // Always first line (all components are client-rendered)

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const ComponentName = ({ prop1, prop2 }) => {
  // 1. Hooks (in order: React, Next.js, custom, third-party)
  const router = useRouter();
  const { user, userData } = useAuth();
  const [state, setState] = useState(initialValue);
  
  // 2. useEffect (grouped by concern)
  useEffect(() => {
    // Fetch data
    return () => cleanup();  // ALWAYS cleanup listeners
  }, [dependencies]);
  
  // 3. Event handlers
  const handleClick = async () => {
    try {
      // Business logic
      toast.success('Success message');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message);
    }
  };
  
  // 4. Derived state / computed values
  const isValid = state.length > 0;
  
  // 5. Conditional rendering (early returns)
  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error} />;
  
  // 6. JSX
  return (
    <div className="container">
      {/* Component UI */}
    </div>
  );
};

export default ComponentName;
```

### Import Organization

**Order:**
1. React core
2. Next.js
3. Third-party libraries
4. UI components (`@/components/ui/*`)
5. Custom components
6. Context/Hooks
7. Services/Utils
8. Types/Constants

**Example:**
```javascript
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onSnapshot, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import CreateTeamForm from '@/components/dashboard/student/CreateTeamForm';
import { useAuth } from '@/context/AuthContext';
import { useSession } from '@/context/SessionContext';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
```

---

## 🏗️ Architecture Guidelines

### Critical Patterns (MUST FOLLOW)

#### 1. Dual Authentication State

**ALWAYS use both `user` and `userData`:**
```javascript
const { user, userData, loading } = useAuth();

// user = Firebase Auth object (uid, email, displayName)
// userData = Firestore /users/{email} doc (role, teamId, projectNumber)
```

**Why:** User doc contains role-based data needed for authorization.

**Example:**
```javascript
useEffect(() => {
  if (!userData?.role) return;  // Wait for userData
  
  if (userData.role === 'student') {
    // Student-specific logic
  }
}, [userData]);
```

#### 2. Email vs UID (CRITICAL)

**Firestore Convention:**
- User documents: **Keyed by EMAIL** (`/users/{email}`)
- Team leadership: Uses **UID** (`team.leaderId`)
- Team membership: Uses **EMAIL** (`team.members[]`)

**Rules:**
```javascript
// ✅ CORRECT - User document lookup
const userRef = doc(db, 'users', 'student@gehu.ac.in');  // EMAIL
const userDoc = await getDoc(userRef);

// ✅ CORRECT - Team leader check (UID)
if (userData.uid === team.leaderId) {
  // User is team leader
}

// ✅ CORRECT - User info lookup (EMAIL)
const leaderRef = doc(db, 'users', team.leaderEmail);
const leaderDoc = await getDoc(leaderRef);

// ❌ WRONG - Using UID for user lookup
const userRef = doc(db, 'users', userData.uid);  // FAILS
```

**When to use what:**
| Field | Purpose | Type |
|-------|---------|------|
| `team.leaderId` | Authorization checks | UID |
| `team.leaderEmail` | Firestore user lookup | Email |
| `team.mentorId` | Authorization checks | UID |
| `team.mentorEmail` | Firestore user lookup | Email |
| `team.members[]` | Array of team members | Email array |

#### 3. Real-time Data (REQUIRED)

**NEVER use `getDoc` for UI data - ALWAYS use `onSnapshot`:**

```javascript
// ✅ CORRECT - Real-time updates
useEffect(() => {
  if (!userData?.teamId) return;
  
  const unsubscribe = onSnapshot(
    doc(db, 'teams', userData.teamId),
    (snap) => {
      if (snap.exists()) {
        setTeam({ id: snap.id, ...snap.data() });
      }
    },
    (error) => {
      console.error('Error:', error);
      toast.error('Failed to load team data');
    }
  );
  
  return () => unsubscribe();  // MUST cleanup
}, [userData?.teamId]);

// ❌ WRONG - No real-time updates
useEffect(() => {
  const fetchTeam = async () => {
    const teamDoc = await getDoc(doc(db, 'teams', userData.teamId));
    setTeam(teamDoc.data());
  };
  fetchTeam();
}, [userData?.teamId]);
```

**Benefits:**
- Instant updates when data changes
- Multiple users see same state
- No manual refresh needed

#### 4. Session Filtering (REQUIRED)

**ALWAYS filter by `sessionId`:**

```javascript
const { activeSession } = useSession();

useEffect(() => {
  if (!activeSession?.id) return;
  
  const q = query(
    collection(db, 'teams'),
    where('sessionId', '==', activeSession.id)
  );
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const teams = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setTeams(teams);
  });
  
  return () => unsubscribe();
}, [activeSession?.id]);
```

**Why:** All operational data belongs to an academic year.

#### 5. Atomic Counters (Transactions)

**Use `runTransaction` for auto-incrementing fields:**

```javascript
const getNextProjectNumber = async () => {
  const counterRef = doc(db, 'counters', 'projectNumber');
  
  return await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    const currentValue = counterDoc.exists() ? counterDoc.data().value : 0;
    const nextValue = currentValue + 1;
    
    transaction.update(counterRef, { value: nextValue });
    return nextValue;
  });
};
```

**Fields using transactions:**
- `projectNumber` (teams)
- `panelNumber` (panels)

#### 6. Multi-Document Updates (Batches)

**Use `writeBatch` for parallel updates:**

```javascript
const assignTeamsToPanel = async (teamIds, panelId) => {
  const batch = writeBatch(db);
  
  teamIds.forEach(teamId => {
    const teamRef = doc(db, 'teams', teamId);
    batch.update(teamRef, { panelId, assignedAt: new Date() });
  });
  
  await batch.commit();  // Max 500 operations per batch
  toast.success(`${teamIds.length} teams assigned to panel`);
};
```

**When to use:**
- Assigning teams to panels
- Bulk status updates
- Deleting related documents

---

### Service Layer Best Practices

**Pattern:**
```javascript
// services/exampleService.js
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export const ExampleService = {
  /**
   * Does something important
   * @param {Object} params - Parameters
   * @param {string} params.teamId - Team ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  doSomething: async ({ teamId }) => {
    try {
      // Validation
      if (!teamId) {
        return { success: false, error: 'Team ID required' };
      }
      
      // Business logic
      await updateDoc(doc(db, 'teams', teamId), {
        status: 'updated'
      });
      
      return { success: true };
    } catch (error) {
      console.error('ExampleService.doSomething error:', error);
      return { success: false, error: error.message };
    }
  }
};
```

**Rules:**
1. **Never throw errors** - Return `{ success, error }` objects
2. **JSDoc comments** for all exported functions
3. **Validation first** before database operations
4. **Descriptive error messages** for users
5. **Console.error** for debugging

**Usage in components:**
```javascript
const handleAction = async () => {
  const result = await ExampleService.doSomething({ teamId });
  
  if (result.success) {
    toast.success('Action completed');
  } else {
    toast.error(result.error || 'Action failed');
  }
};
```

---

### State Management

**Prefer React Context over prop drilling:**

```javascript
// context/ExampleContext.js
"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';

const ExampleContext = createContext();

export const ExampleProvider = ({ children }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Fetch/subscribe to data
    setLoading(false);
  }, []);
  
  return (
    <ExampleContext.Provider value={{ data, loading }}>
      {children}
    </ExampleContext.Provider>
  );
};

export const useExample = () => {
  const context = useContext(ExampleContext);
  if (!context) {
    throw new Error('useExample must be used within ExampleProvider');
  }
  return context;
};
```

**Context Provider Order (IMMUTABLE):**
```jsx
// app/layout.js
<AuthProvider>        {/* Outermost */}
  <SessionProvider>   {/* Depends on auth */}
    <TooltipProvider> {/* ShadCN requirement */}
      {children}
    </TooltipProvider>
  </SessionProvider>
</AuthProvider>
```

---

### UI Component Patterns

**ShadCN Usage:**
```javascript
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';  // For className merging

<Button 
  variant="default"  // or outline, ghost, destructive
  size="default"     // or sm, lg, icon
  onClick={handleClick}
  disabled={loading}
>
  {loading ? 'Loading...' : 'Submit'}
</Button>

<Card className={cn("custom-class", isActive && "border-primary")}>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

**Toast Notifications (Sonner):**
```javascript
import { toast } from 'sonner';

// Success
toast.success('Team created successfully!');

// Error
toast.error('Failed to create team: ' + error.message);

// Warning
toast.warning('This action requires mentor approval');

// Info
toast.info('Deadline extended by 2 days');

// Loading (with promise)
toast.promise(
  createTeam(),
  {
    loading: 'Creating team...',
    success: 'Team created!',
    error: 'Failed to create team'
  }
);
```

---

### Error Handling

**Pattern:**
```javascript
const handleAction = async () => {
  try {
    // Guard clauses
    if (!userData?.teamId) {
      toast.error('You must be in a team');
      return;
    }
    
    // Business logic
    const result = await SomeService.doSomething({ teamId: userData.teamId });
    
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    
    // Success
    toast.success('Action completed');
    
  } catch (error) {
    console.error('handleAction error:', error);
    toast.error('An unexpected error occurred');
  }
};
```

**Firestore Error Handling:**
```javascript
useEffect(() => {
  const unsubscribe = onSnapshot(
    doc(db, 'teams', teamId),
    (snap) => {
      if (!snap.exists()) {
        setError('Team not found');
        return;
      }
      setTeam({ id: snap.id, ...snap.data() });
      setError(null);
    },
    (error) => {
      console.error('Firestore error:', error);
      setError(error.message);
      toast.error('Failed to load team data');
    }
  );
  
  return () => unsubscribe();
}, [teamId]);
```

---

## 🧪 Testing Requirements

### Before Submitting PR

**1. Automated Validation:**
```bash
npm run lint
```

**2. SystemValidator Check:**
- Login as admin
- Navigate to Admin Dashboard → Analytics tab
- Run SystemValidator
- Fix any Critical/High priority issues

**3. Manual Testing:**
See [TESTING.md](TESTING.md) for comprehensive checklist.

**Minimum tests required:**
- ✅ Component renders without errors
- ✅ Loading states display correctly
- ✅ Error states handle gracefully
- ✅ Success flows work end-to-end
- ✅ Real-time updates function
- ✅ Auth checks prevent unauthorized access

### Test Data Setup

**Use sample CSVs:**
```bash
# Import users first
sample-users-import.csv
# Then import teams
sample-teams-import.csv
```

**Create test scenarios:**
1. Student with team
2. Student without team
3. Faculty with mentees
4. Faculty on panel
5. Admin user
6. External evaluator

---

## 📥 Pull Request Process

### PR Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Documentation update

## Related Issues
Closes #123
Fixes #456

## Changes Made
- Added X feature
- Fixed Y bug
- Refactored Z component

## Testing Done
- [ ] Automated tests pass (npm run lint)
- [ ] SystemValidator passes (Critical/High issues resolved)
- [ ] Manual testing completed (see [TESTING.md](TESTING.md))
- [ ] Tested on Chrome/Firefox/Safari
- [ ] Tested mobile responsiveness

## Screenshots (if applicable)
Before:
[Screenshot]

After:
[Screenshot]

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings in console
- [ ] Real-time listeners have cleanup
- [ ] Session filtering applied to queries
- [ ] Email/UID convention followed

## Additional Notes
Any additional context for reviewers.
```

### Review Process

1. **Automated checks** (GitHub Actions):
   - ESLint passes
   - Build succeeds
   - No TypeScript errors

2. **Code review** by maintainer:
   - Follows architecture guidelines
   - Proper error handling
   - Real-time patterns used
   - Session filtering applied

3. **Testing verification:**
   - Manual testing done
   - SystemValidator passes
   - No breaking changes

4. **Approval and merge:**
   - Squash and merge preferred
   - Update CHANGELOG.md
   - Delete feature branch

---

## ✅ Review Checklist

### Code Quality

**Architecture:**
- [ ] Uses `onSnapshot` for real-time data (not `getDoc`)
- [ ] Includes cleanup for all listeners (`return () => unsubscribe()`)
- [ ] Filters by `sessionId` in all queries
- [ ] Uses EMAIL for Firestore user lookups (not UID)
- [ ] Uses UID for authorization checks
- [ ] Transactions for counters, batches for bulk updates

**React Patterns:**
- [ ] `"use client";` directive present
- [ ] Hooks in correct order (React → Next.js → Custom → Third-party)
- [ ] Dependencies array correct in `useEffect`
- [ ] Loading/error states handled
- [ ] Early returns for conditional rendering

**Error Handling:**
- [ ] Try-catch blocks around async operations
- [ ] Toast notifications for user feedback
- [ ] Console.error for debugging
- [ ] Guard clauses for null checks
- [ ] Firestore error callbacks implemented

**Services:**
- [ ] Returns `{ success, error }` objects
- [ ] JSDoc comments present
- [ ] Validation before database operations
- [ ] Descriptive error messages

**State Management:**
- [ ] Context used over prop drilling
- [ ] Context has proper error boundaries
- [ ] Loading states managed
- [ ] Optimistic updates where appropriate

**UI/UX:**
- [ ] ShadCN components used correctly
- [ ] `cn()` utility for className merging
- [ ] Responsive design (mobile-first)
- [ ] Accessible (ARIA labels, keyboard navigation)
- [ ] Loading skeletons for async content

**Performance:**
- [ ] No unnecessary re-renders
- [ ] Memoization used where appropriate (`useMemo`, `useCallback`)
- [ ] Images optimized (Next.js Image component)
- [ ] Firestore queries optimized (indexed fields)

**Security:**
- [ ] Authorization checks before sensitive operations
- [ ] Firestore rules updated if needed
- [ ] No sensitive data in client code
- [ ] Input validation on client and server

### Testing

- [ ] ESLint passes (`npm run lint`)
- [ ] Component renders without errors
- [ ] Loading states work
- [ ] Error states work
- [ ] Success flows work end-to-end
- [ ] Real-time updates function
- [ ] Auth checks prevent unauthorized access
- [ ] SystemValidator passes (Critical/High fixed)
- [ ] Manual testing completed
- [ ] No console errors/warnings

### Documentation

- [ ] README.md updated if needed
- [ ] CHANGELOG.md entry added
- [ ] JSDoc comments for new functions
- [ ] Complex logic commented
- [ ] PR description complete

### Git Hygiene

- [ ] Branch name follows convention
- [ ] Commit messages follow Conventional Commits
- [ ] No merge commits (use rebase)
- [ ] No unnecessary files committed
- [ ] `.gitignore` updated if needed

---

## 📚 Additional Resources

- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [ShadCN UI Components](https://ui.shadcn.com/)
- [React Best Practices](https://react.dev/learn)
- [Conventional Commits](https://www.conventionalcommits.org/)

### Project-Specific Docs

- [README.md](README.md) - Project overview
- [TESTING.md](TESTING.md) - Testing guide
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment instructions
- [CHANGELOG.md](CHANGELOG.md) - Version history
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues
- `.github/copilot-instructions.md` - AI assistant instructions

---

## 🐛 Reporting Issues

### Bug Reports

**Template:**
```markdown
## Bug Description
Clear description of the bug.

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Screenshots
If applicable.

## Environment
- Browser: Chrome 120
- OS: Windows 11
- Role: Student
- Session: 2024-2025

## Additional Context
Any other relevant information.
```

### Feature Requests

**Template:**
```markdown
## Feature Description
Clear description of the feature.

## Use Case
Who needs this and why?

## Proposed Solution
How should it work?

## Alternatives Considered
Other approaches you've thought about.

## Additional Context
Mockups, references, etc.
```

---

## 💬 Communication

### Questions?

- **General:** Open a GitHub Discussion
- **Bugs:** Create an issue with bug template
- **Features:** Create an issue with feature template
- **Security:** Email maintainers directly (DO NOT open public issue)

### Code of Conduct

- Be respectful and inclusive
- Constructive feedback only
- No harassment or discrimination
- Follow project guidelines

---

## 🎓 Learning Resources

### For New Contributors

1. **Next.js Fundamentals:**
   - App Router vs Pages Router
   - Server vs Client Components
   - Data Fetching Patterns

2. **Firebase Basics:**
   - Firestore CRUD operations
   - Real-time listeners (`onSnapshot`)
   - Security rules
   - Authentication

3. **React Patterns:**
   - Hooks (useState, useEffect, useContext)
   - Context API
   - Custom hooks
   - Performance optimization

4. **Project Architecture:**
   - Read `.github/copilot-instructions.md` (CRITICAL)
   - Review existing components
   - Understand service layer
   - Study context providers

---

## 🏆 Recognition

Contributors will be:
- Listed in CHANGELOG.md for their contributions
- Mentioned in release notes
- Given credit in project documentation

---

**Thank you for contributing to Final Year Portal!** 🎉

Your contributions help improve the project management experience for students, faculty, and administrators.

---

**Maintained by:** CSE Department Development Team  
**Last Updated:** October 22, 2025  
**Questions?** Open a GitHub Discussion

---

*This guide follows [Contributor Covenant](https://www.contributor-covenant.org/) principles.*

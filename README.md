# 🎓 Final Year Portal

> A Next.js 15 + Firebase platform for managing CSE final year projects with role-based access, real-time collaboration, and conflict-free evaluations.

[![Next.js](https://img.shields.io/badge/Next.js-15.5.9-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.1.1-blue?logo=react)](https://react.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-12.3.0-orange?logo=firebase)](https://firebase.google.com/)

---

## 🎯 Project Vision

Transform final year project management from fragmented chaos (emails, spreadsheets, documents) to structured efficiency through:

- **🎓 Academic Integrity** - Faculty cannot evaluate teams they mentor (enforced at 3 layers)
- **⚖️ Fair Distribution** - Automated panel assignment with workload balancing
- **🔍 Transparency** - Real-time progress tracking for all stakeholders
- **⚡ Automation** - Bulk imports, notifications, and deadline management

### 📊 Feature Summary

| Category | Features Count | Status |
|----------|---------------|--------|
| **Student Features** | 15+ | ✅ Complete |
| **Faculty Features** | 20+ | ✅ Complete |
| **Admin Features** | 25+ | ✅ Complete |
| **External Evaluator** | 5+ | ✅ Complete |
| **Real-time Systems** | 10+ | ✅ Active |
| **Documentation Pages** | 11 | 📝 Comprehensive |

**Key Metrics:**
- 🎯 4 user roles with distinct dashboards
- 📱 60+ React components (22+ ShadCN/UI)
- 🔧 12+ service modules
- 🧪 18+ automated validation checks
- 📄 5,500+ lines of feature code
- 🔒 3-layer conflict prevention system

---

## ✨ Key Features

### 👨‍🎓 For Students
- **Team Management**
  - Create/join teams (max 4 members) with automatic project numbering
  - Team invitation system with accept/decline functionality
  - Add members with email validation (max 4 members enforced)
- **Mentorship**
  - Browse faculty by expertise areas
  - Send mentorship requests with project details
  - Track request status (pending, approved, revisions requested)
  - Receive feedback on project proposals
- **Phase Submissions**
  - Unified submission modal for all project phases
  - Version control with complete submission history
  - Google Drive integration (files and folder links)
  - Resubmission support with automatic history archival
  - Deadline tracking with extension alerts
- **Grades & Feedback**
  - Real-time grade updates with visibility controls
  - Panel and mentor evaluation aggregation
  - Phase-wise performance tracking
  - Detailed individual and team marks
- **Meetings & Communication**
  - Meeting announcements banner with upcoming schedules
  - "My Meetings" tab with Google Meet integration
  - Real-time notifications for important updates
  - Announcement system with 7-day auto-cleanup

### 👨‍🏫 For Faculty
- **Dual Role System** (Conflict-Free)
  - Mentor teams AND evaluate others independently
  - System enforces: cannot evaluate teams you mentor
  - Separate tabs for mentored vs panel teams
- **Mentorship Management**
  - Review mentorship requests from students
  - Accept, request revisions, or decline proposals
  - Revision history tracking with version numbers
  - Quick actions for team navigation
- **Abstract & Proposal Review**
  - 5 sub-tabs for abstracts (All, Pending, Approved, Rejected, Revisions)
  - Approve/reject with detailed feedback
  - Real-time status updates
- **Team Evaluation**
  - Collapsible inline marking interface (no modals needed)
  - Individual student grading within teams
  - Team-level feedback and average calculation
  - Pre-population of existing evaluations
  - Meeting requirement validation before grading
- **Meeting Scheduling**
  - Schedule meetings with multiple teams
  - Online (Google Meet) and offline modes
  - Conflict detection prevents double-booking
  - Automatic email notifications (integrated)
- **Phase Management**
  - Dynamic phase tabs for each evaluation cycle
  - Teams table per phase with status tracking
  - Filter by mentor/panel assignments
  - Real-time evaluation progress

### 👨‍💼 For Administrators
- **Session Management**
  - Create academic year sessions
  - Automatic phase initialization
  - Session switching and archival
- **User Management**
  - Bulk CSV import for users (name, email, role, uid)
  - Bulk CSV import for teams with validation
  - CSV export for all data (users, teams, panels, evaluations)
  - Role assignment (student, faculty, admin, external_evaluator)
  - Email normalization and duplicate detection
- **Panel Management**
  - Automated panel creation with workload balancing
  - Manual team-to-panel assignment
  - CSV-based panel assignment (bulk import)
  - CSV export of panel configurations
  - Conflict detection (mentor cannot evaluate their teams)
  - Expertise-based balancing across panels
  - Panel statistics and analytics
- **Phase Configuration**
  - Create phases with custom deadlines
  - Set max marks and evaluator roles (mentor/panel)
  - Toggle grade visibility (Eye/EyeOff icons)
  - Phase status tracking (upcoming, active, completed, missed)
- **Deadline Extensions**
  - Bulk grant to multiple teams with reasons
  - Active extension management
  - One-click revocation
  - Extended deadline validation
- **System Analytics**
  - Dashboard with 18+ validation checks
  - Team/faculty/phase statistics
  - Evaluation progress monitoring
  - Meeting conflict detection
  - Announcement statistics

### 🌐 For External Evaluators
- **Modern Dashboard**
  - Single-viewport layout with gradient design
  - Color-coded stats cards
  - Interactive navigation tabs
- **Team Evaluation**
  - View assigned teams for specific phases
  - Independent evaluation interface
  - Phase-specific grading
  - Comprehensive help section with guidelines

---

## 🔄 Core Workflows

### 🚀 Student Workflow

#### 1. Team Formation
```
Login → Dashboard → Teams Tab → Create Team
  ├── Enter team name & project title
  ├── Auto-assigned project number (atomic counter)
  └── Becomes team leader automatically

Add Members:
  ├── Click "Add Member" → Enter email
  ├── Member receives invitation
  └── Accept/decline invitation (real-time updates)
```

#### 2. Finding a Mentor
```
Dashboard → Browse Faculty
  ├── Filter by expertise areas (AI, Web, Mobile, etc.)
  ├── View faculty profiles
  └── Send mentorship request
      ├── Project title & description required
      ├── Abstract/synopsis upload
      └── Track status (pending → approved/revisions/rejected)
```

#### 3. Phase Submissions
```
Dashboard → Phases Tab → Click Phase Card
  ├── Opens unified submission modal
  ├── Enter submission title & notes
  ├── Add Google Drive link (validated)
  ├── View submission history (all versions)
  └── Submit/Update (leader only)

Deadline Handling:
  ├── Amber alert for extended deadlines
  ├── Deadline validation before submission
  └── Version number auto-increments
```

#### 4. Tracking Progress
```
Dashboard Tabs:
  ├── Overview: Stats cards (team, grades, meetings)
  ├── Phases: Submit deliverables & view status
  ├── My Grades: Phase-wise marks & feedback
  ├── My Meetings: Upcoming/past meetings
  └── Team: Member list, mentor info, invite management
```

---

### 👨‍🏫 Faculty Workflow

#### 1. Reviewing Mentorship Requests
```
Dashboard → Requests Tab
  ├── View pending requests (orange badges)
  ├── Review team info & project proposal
  └── Take action:
      ├── Accept & Mentor → Team assigned
      ├── Request Revisions → Feedback required (min 10 chars)
      └── Decline → Team notified
```

#### 2. Evaluating Teams (Collapsible Interface)
```
Dashboard → Phases Tab → Select Phase → Teams Table
  ├── Click team card to expand
  ├── View all team members with avatars
  ├── Enter individual marks (0-maxMarks validation)
  ├── Add team feedback
  └── Save → Auto-calculates average, collapses card

Benefits:
  ✅ No modal opening/closing
  ✅ Mark multiple teams without losing context
  ✅ Pre-populated if previously evaluated
  ✅ Real-time validation & error messages
```

#### 3. Scheduling Meetings
```
Dashboard → Meetings Tab → Schedule Meeting
  ├── Select multiple teams
  ├── Choose date & time
  ├── Set mode:
  │   ├── Online: Auto-generates Google Meet link
  │   └── Offline: Enter venue details
  ├── Conflict detection (prevents double-booking)
  └── Submit → Students notified instantly
```

#### 4. Managing Mentored Teams
```
Dashboard → Teams Tab
  ├── Filter: My Mentored Teams / Panel Teams
  ├── Click team → 4 sub-tabs:
  │   ├── Info: Members, leader, project details
  │   ├── Marks: Phase-wise evaluations
  │   ├── Submissions: All deliverables with history
  │   └── Activities: Team timeline (upcoming)
  └── Quick Actions: Navigate between sections
```

---

### 👨‍💼 Admin Workflow

#### 1. Session Setup (Annual)
```
Dashboard → Sessions Tab → Create Session
  ├── Enter session name (e.g., "2024-2025")
  ├── Set start/end dates
  ├── Auto-initializes default phases:
  │   ├── Synopsis, Phase 1, Phase 2, Final, External
  │   └── Default deadlines (customizable)
  └── Activate session → All users switch automatically
```

#### 2. Bulk User Import
```
Dashboard → Users Tab → Import Users
  ├── Download CSV template
  ├── Fill: name, email, role, uid
  ├── Upload CSV → Validation:
  │   ├── Email format check
  │   ├── Duplicate detection
  │   ├── Role validation (student/faculty/admin/external)
  │   └── UID verification
  └── Import → Users created in Firestore
```

**CSV Format:**
```csv
name,email,role,uid
John Doe,s1@gehu.ac.in,student,uid_123
Dr. Smith,f1@gehu.ac.in,faculty,uid_456
```

#### 3. Bulk Team Import
```
Dashboard → Teams Tab → Import Teams
  ├── Download CSV template
  ├── Fill: teamName, leaderID, memberIDs, projectName, mentorID
  ├── Upload CSV → Advanced parsing:
  │   ├── Handles quoted values with commas
  │   ├── Semicolon-separated member emails
  │   ├── Validates leader & mentor existence
  │   └── Auto-assigns project numbers
  └── Import → Teams created with atomic counters
```

**CSV Format (supports commas in project names):**
```csv
teamName,leaderID,memberIDs,projectName,mentorID
"AI Team",s1@gehu.ac.in,"s2@gehu.ac.in;s3@gehu.ac.in","Smart Chatbot, Version 2.0",f1@gehu.ac.in
```

**CRITICAL:** Use `parseCSVLine()` helper - **never** `.split(',')` or it breaks on quoted values.

#### 3b. Data Export
```
Dashboard → Export Tab

Available Exports:
  ├── Users: All user data (name, email, role, team assignments)
  ├── Teams: Complete team information (members, projects, mentors)
  ├── Panels: Panel configurations and assignments
  ├── Evaluations: Marks, feedback, evaluation status
  ├── Phases: Phase configurations and deadlines
  └── Meetings: Scheduled meetings and attendance

Export Process:
  ├── Select data type
  ├── Choose filters (session, date range, status)
  ├── Click "Export to CSV"
  ├── Download generated CSV file
  └── Use for:
      ├── Backup and archival
      ├── External analysis
      ├── Reporting to administration
      └── Data migration
```

#### 4. Panel Creation & Assignment
```
Dashboard → Panels Tab

Automated Creation:
  ├── Enter number of panels
  ├── Algorithm:
  │   ├── Randomized team assignment
  │   ├── Workload balancing (equal teams per panel)
  │   ├── Conflict detection (mentor cannot evaluate mentored teams)
  │   └── Expertise-based distribution
  └── Generate → Panels created

Manual Assignment:
  ├── Drag & drop teams to panels
  ├── Conflict warnings (red alerts)
  ├── Real-time panel statistics
  └── Save → Updates Firestore

CSV-Based Assignment:
  ├── Download panel template CSV
  ├── Fill: panelNumber, teamId, teamName
  ├── Upload CSV → Validation:
  │   ├── Team existence check
  │   ├── Conflict detection (mentor cannot evaluate own teams)
  │   ├── Panel balance verification
  │   └── Duplicate team detection
  └── Import → Bulk panel assignment

Export Options:
  ├── Export current panel configuration to CSV
  ├── Export panel statistics and analytics
  └── Export evaluation progress reports
```

#### 5. Phase Configuration
```
Dashboard → Phases Tab → Add Phase
  ├── Phase name & description
  ├── Start date & deadline
  ├── Max marks
  ├── Evaluator role: Mentor or Panel
  ├── Submission requirements (optional)
  └── Create → Phase added to active session

Phase Management:
  ├── Toggle grade visibility (Eye/EyeOff icons)
  ├── Edit deadlines
  ├── Grant bulk extensions
  └── Track evaluation progress
```

#### 6. Deadline Extensions
```
Dashboard → Extensions Tab → Grant Extension
  ├── Select teams (multi-select)
  ├── Choose phase
  ├── Set new deadline
  ├── Enter reason (displayed to students)
  └── Submit → Amber alerts shown to students

Revoke Extension:
  ├── View active extensions
  ├── One-click revocation
  └── Reverts to original deadline
```

#### 7. System Validation
```
Dashboard → Testing Tab → Run All Validations
  ├── 18+ automated checks:
  │   ├── Session configuration
  │   ├── User/team data integrity
  │   ├── Panel conflicts
  │   ├── Phase deadlines
  │   ├── Firestore rules deployment
  │   └── Permission validations
  └── Expected: ✅ 18-20/18-20 passed
```

---

### 🌐 External Evaluator Workflow

```
Login → Dashboard
  ├── View assigned teams (phase-specific)
  ├── Navigate to Assigned Teams tab
  ├── Evaluate teams independently
  ├── Submit phase-specific grades
  └── View evaluation statistics
```

---

## 🔄 Key System Processes

### Real-time Data Synchronization
```javascript
// All dashboards use onSnapshot for live updates
useEffect(() => {
  const unsubscribe = onSnapshot(
    query(collection(db, 'teams'), where('sessionId', '==', activeSession.id)),
    (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
  );
  return () => unsubscribe(); // MUST cleanup or memory leak
}, [activeSession]);
```

### Conflict-Free Evaluation
```
Faculty Evaluation Request:
  ├── Check: Is faculty the team's mentor?
  │   ├── YES → ❌ Block evaluation (3-layer enforcement)
  │   │   ├── UI: Hide team from panel list
  │   │   ├── Service: checkMentorConflict() returns error
  │   │   └── Firestore Rules: Reject write operation
  │   └── NO → ✅ Allow evaluation
  └── Save marks → Add to evaluatedBy array
```

### Notification System
```
Two Types:

1. Toast Notifications (Ephemeral):
   ├── Action confirmations (save, delete)
   ├── Validation errors
   ├── 3-5 second duration
   └── Uses Sonner library

2. Persistent Notifications:
   ├── Stored in Firestore
   ├── Accessible via bell icon
   ├── Cross-session messages
   ├── Examples:
   │   ├── New team member joined
   │   ├── Mentor approved abstract
   │   └── Deadline reminders
   └── Auto-cleanup after 7 days (UI filtering)
```

### Announcement Cleanup
```
Automatic (Client-Side):
  ├── Filter announcements > 7 days old
  ├── Hidden from UI automatically
  ├── No manual intervention needed

Admin Manual Cleanup:
  ├── Mark as Read: Soft cleanup (preserves data)
  ├── Permanent Delete: Irreversible (removes from DB)
  └── Recommended schedule:
      ├── Weekly: Mark as read (7+ days)
      └── Monthly: Permanent delete (30+ days)
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (LTS recommended)
- Firebase project with Firestore & Authentication enabled

### Installation

\`\`\`bash
# 1. Clone repository
git clone https://github.com/yourusername/final-year-portal.git
cd final-year-portal

# 2. Install dependencies
npm install

# 3. Configure environment (create .env.local with Firebase credentials)
cp .env.example .env.local

# 4. Run development server
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) - Application running!

### Environment Variables

\`\`\`env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
\`\`\`

---

## 📁 Project Structure

\`\`\`
final-year-portal/
├── docs/                                   # �� Complete documentation
│   ├── 00-DOCUMENTATION-INDEX.md          # Documentation hub
│   ├── 01-CONTRIBUTING-GUIDE.md           # Development standards
│   ├── 02-TESTING-GUIDE.md                # Testing workflows (100+ tests)
│   ├── 03-DEPLOYMENT-GUIDE.md             # Production deployment
│   ├── 04-TROUBLESHOOTING-GUIDE.md        # Common issues & fixes
│   ├── 05-CHANGELOG.md                    # Version history
│   ├── 06-ADMIN-GUIDE-CSV-IMPORT.md       # CSV import workflows
│   ├── 07-FEATURE-PHASE-SUBMISSIONS.md    # Phase submission system
│   ├── 08-FEATURE-ANNOUNCEMENTS.md        # Notification system
│   └── 09-ARCHITECTURE-GUIDE.md           # Technical deep-dive
│
├── src/
│   ├── app/                # Next.js App Router
│   ├── components/         # React components
│   │   ├── ui/            # ShadCN components (22+)
│   │   └── dashboard/     # Role-based dashboards
│   ├── context/           # React Context (Auth, Session)
│   ├── hooks/             # Custom hooks
│   ├── lib/               # Utilities
│   └── services/          # Business logic
│
├── .github/
│   └── copilot-instructions.md  # AI agent guidelines
│
├── firestore.rules        # Security rules
└── package.json           # Dependencies
\`\`\`

---

## 🏗️ Tech Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Framework** | Next.js with App Router & Turbopack | 15.5.9 | React meta-framework with SSR/SSG |
| **UI Library** | React | 19.1.1 | Component-based UI |
| **Styling** | Tailwind CSS + ShadCN/UI | 4.x + Latest | Utility-first CSS + component library |
| **Database** | Firebase Firestore (NoSQL, real-time) | 12.3.0 | Real-time document database |
| **Authentication** | Firebase Auth (email/password) | 12.3.0 | User authentication & authorization |
| **State Management** | React Context (Auth, Session) | Built-in | Global state management |
| **Icons** | Lucide React | 0.544.0 | Icon library (500+ icons) |
| **Notifications** | Sonner (toasts) | 2.0.7 | Toast notification system |
| **Charts** | Recharts | 3.2.1 | Analytics & data visualization |
| **Build Tool** | Turbopack (built into Next.js) | Native | Fast bundler for dev & production |
| **Forms** | React Hook Form (planned) | TBD | Form validation & management |

### Key Libraries & Components
- **ShadCN/UI Components:** 22+ pre-built components (Button, Dialog, Card, Table, Tabs, etc.)
- **Custom Hooks:** 8+ hooks (useTeamData, usePhases, useNotifications, useMeetingStats, etc.)
- **Service Modules:** 12+ services (mentorship, panel, submission, meeting, faculty, etc.)
- **Context Providers:** AuthContext, SessionContext, TooltipProvider

---

## 📚 Documentation

### 🚀 Getting Started (5-15 minutes)
- **[Installation](#-quick-start)** - Setup and configuration
- **[Core Workflows](#-core-workflows)** - Student, faculty, admin workflows
- **[Testing Guide](docs/02-TESTING-GUIDE.md)** - 100+ test checklist
- **[Deployment Guide](docs/03-DEPLOYMENT-GUIDE.md)** - Production deployment

### 📖 For Developers
- **[Contributing Guide](docs/01-CONTRIBUTING-GUIDE.md)** - Code standards and patterns
- **[Architecture Guide](docs/09-ARCHITECTURE-GUIDE.md)** - Technical deep-dive
- **[AI Instructions](.github/copilot-instructions.md)** - Critical patterns for AI agents
- **[Troubleshooting](docs/04-TROUBLESHOOTING-GUIDE.md)** - Common issues & solutions

### 📋 Feature Documentation
- **[Phase Submissions](docs/07-FEATURE-PHASE-SUBMISSIONS.md)** - Unified submission modal with version control
- **[Announcements](docs/08-FEATURE-ANNOUNCEMENTS.md)** - Notification system & auto-cleanup
- **[CSV Import Guide](docs/06-ADMIN-GUIDE-CSV-IMPORT.md)** - Bulk user/team import
- **[Faculty User Guide](docs/10-FACULTY-USER-GUIDE.md)** - Complete faculty workflow guide
- **[Changelog](docs/05-CHANGELOG.md)** - Version history with dates

### 🔍 Need Help?
| Problem | Solution |
|---------|----------|
| Deployment failing | [Deployment § Troubleshooting](docs/03-DEPLOYMENT-GUIDE.md#troubleshooting) |
| CORS errors | [Troubleshooting § CORS](docs/04-TROUBLESHOOTING-GUIDE.md#cors-errors) |
| Tests failing | [Testing § Issues](docs/02-TESTING-GUIDE.md#common-issues) |
| Permission errors | [Deployment § Firestore Rules](docs/03-DEPLOYMENT-GUIDE.md#firestore-rules-deployment) |
| Email vs UID confusion | [Architecture § Authentication](docs/09-ARCHITECTURE-GUIDE.md#authentication-flow) |
| Panel conflicts | [Architecture § Conflict Detection](docs/09-ARCHITECTURE-GUIDE.md#conflict-detection) |

---

## 🎓 Critical Concepts

### Session-Scoped Architecture
All data (teams, phases, panels, meetings, submissions) belongs to an academic year (`sessionId`). **Always filter queries by active session.**

```javascript
const { activeSession } = useSession();
const teamsQuery = query(
  collection(db, 'teams'),
  where('sessionId', '==', activeSession.id)
);
```

### Dual Authentication
- `user` = Firebase Auth object (uid, email, displayName)
- `userData` = Firestore document (role, teamId, projectNumber, expertise)

**CRITICAL:** Wait 500ms after auth for token propagation before querying Firestore.

### Real-time Everything
Use `onSnapshot` (not `getDoc`) for reactive UI. Always include cleanup function or memory leak occurs.

```javascript
useEffect(() => {
  const unsubscribe = onSnapshot(query, (snapshot) => {
    setData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
  return () => unsubscribe(); // MUST cleanup
}, [dependency]);
```

### Email vs UID Convention
| Field | Usage | Example |
|-------|-------|---------|
| **User documents** | Keyed by email | `users/s1@gehu.ac.in` |
| **Team leadership** | Uses UID | `team.leaderId = uid_123` |
| **Team membership** | Uses email array | `team.members = ["s1@gehu.ac.in"]` |
| **Firestore lookups** | Use email fields | `doc(db, 'users', team.leaderEmail)` |
| **Auth checks** | Use UID fields | `if (userData.uid === team.leaderId)` |

**Why?** Firestore security rules require email-based user docs for role validation.

### Conflict-Free Evaluation (3-Layer Enforcement)
Faculty cannot evaluate teams they mentor. Enforced at:
1. **UI Layer:** Teams filtered from panel list
2. **Service Layer:** `PanelService.checkMentorConflict()` returns error
3. **Firestore Rules:** Rejects write operation

### Atomic Operations
- **Counters:** Use `runTransaction` for auto-incrementing (projectNumber, panelNumber)
- **Multi-doc updates:** Use `writeBatch` for parallel writes (max 500 ops/batch)
- **Never:** Use regular `updateDoc` for counters (causes race conditions)

### Service Layer Pattern
Services return `{ success: boolean, error?: string }` objects - **never throw exceptions**.
Services handle toasts internally - **don't wrap in try/catch just for toasts**.

```javascript
const result = await MentorshipService.sendRequest({ teamId, mentorId });
if (result.success) {
  // Success logic (toast already shown by service)
} else {
  // Error already handled with toast
}
```

### Notification Dual System
1. **Toast (Ephemeral):** `toast.success()`, `toast.error()` - 3-5 sec, action confirmations
2. **Persistent:** `NotificationService.sendNotification()` - Stored in Firestore, bell icon, cross-session

---

## 🧪 Development Commands

\`\`\`bash
npm run dev              # Start Turbopack dev server (port 3000)
npm run build            # Production build with Turbopack
npm run start            # Start production server
npm run lint             # Run ESLint
npm run panel:verify     # Verify panel assignment logic
\`\`\`

**Note:** Turbopack is pre-configured in \`package.json\` - don't add \`--turbopack\` flags manually.

---

## 🌟 Major Features & Innovations

### 1. Unified Phase Submission System
**Problem Solved:** Fragmented submission forms for different phases  
**Solution:** Single reusable modal component with:
- ✅ Version control with automatic history archival
- ✅ Google Drive integration (files & folders)
- ✅ Deadline enforcement with extension support
- ✅ Permission-based access (leader submits, members view)
- ✅ Complete submission timeline

**Files:** `PhaseSubmissionModal.jsx`, `PhaseCardWithSubmission.jsx`, `submissionService.js`

### 2. Collapsible Inline Evaluation
**Problem Solved:** Modal-based evaluation workflow was slow (click → wait → enter → close → repeat)  
**Solution:** Card-based expandable interface:
- ✅ Click team → Expands inline
- ✅ Enter marks for all members
- ✅ Auto-calculates team average
- ✅ Save → Auto-collapses
- ✅ No context switching

**Impact:** 60% faster marking workflow for faculty  
**File:** `PhaseTeamsView.jsx` (major refactor, 158 lines of business logic)

### 3. Intelligent Panel Assignment
**Problem Solved:** Manual panel creation caused mentor conflicts  
**Solution:** Multi-constraint algorithm:
- ✅ Randomized team distribution
- ✅ Workload balancing (equal teams per panel)
- ✅ Conflict detection (mentor ≠ evaluator)
- ✅ Expertise-based distribution
- ✅ Real-time conflict warnings

**Files:** `panelService.js`, `ManagePanels.jsx`

### 4. Advanced CSV Import/Export System
**Problem Solved:** Project names with commas broke `.split(',')` parsing; no easy way to backup/export data  
**Solution:** Comprehensive CSV system:
- ✅ Handles quoted values with embedded commas
- ✅ Semicolon-separated member lists
- ✅ Duplicate detection & validation
- ✅ Atomic counter integration
- ✅ Bidirectional: Import AND Export
- ✅ Panel assignment via CSV bulk import
- ✅ Complete data export for all entities

**Import Example CSV:**
```csv
"AI Team","s1@gehu.ac.in","s2@gehu.ac.in;s3@gehu.ac.in","Smart Chatbot, Version 2.0","f1@gehu.ac.in"
```

**Export Capabilities:**
- Users, Teams, Panels, Evaluations, Phases, Meetings
- Filtered by session, date range, status
- Used for backup, reporting, and analysis

**Files:** `ManageTeams.jsx`, `ManagePanels.jsx`, Export service modules

### 5. Meeting Scheduler with Conflict Detection
**Problem Solved:** Faculty accidentally double-booking meetings  
**Solution:** Real-time conflict detection:
- ✅ Checks existing meetings before scheduling
- ✅ Multi-team selection
- ✅ Google Meet auto-generation (online mode)
- ✅ Instant notifications to students

**Files:** `meetingService.js`, `ScheduleMeeting.jsx`, `MeetingAnnouncements.jsx`

### 6. Auto-Cleanup Announcement System
**Problem Solved:** Notification overload from old announcements  
**Solution:** Dual cleanup strategy:
- ✅ Client-side: Auto-hide announcements > 7 days old
- ✅ Admin tools: Mark as read (soft) or permanent delete
- ✅ Age badges (New, Today, 3d old)
- ✅ Recommended schedule: Weekly soft, monthly hard cleanup

**Files:** `MeetingAnnouncements.jsx`, `announcementCleanupService.js`

### 7. Grade Visibility Controls
**Problem Solved:** Students seeing incomplete evaluations causing confusion  
**Solution:** Per-phase visibility toggles:
- ✅ Admin controls Eye/EyeOff icons
- ✅ Students see "X hidden evaluations" count
- ✅ Real-time visibility updates
- ✅ Lock icon indicators

**Files:** `useStudentGrades.js`, `MyGrades.jsx`, `ManagePhases.jsx`

### 8. Deadline Extension System
**Problem Solved:** Manual deadline adjustments were error-prone  
**Solution:** Centralized extension management:
- ✅ Bulk grant to multiple teams
- ✅ Reason tracking (displayed to students)
- ✅ Amber alert badges for active extensions
- ✅ One-click revocation
- ✅ Extended deadline validation

**Files:** `extensionService.js`, `ManageExtensions.jsx`

---

## 🚀 Deployment

### Production Checklist
- [ ] Update Firebase environment variables in Vercel
- [ ] Deploy Firestore rules: \`firebase deploy --only firestore:rules\`
- [ ] Test with all roles (student, faculty, admin)
- [ ] Verify mobile responsiveness
- [ ] Run SystemValidator (18+ checks) in admin dashboard

See [Deployment Guide](docs/03-DEPLOYMENT-GUIDE.md) for detailed steps.

---

## 🧪 Testing

### Quick Test (10 minutes)
1. Run \`npm run dev\`
2. Login as admin → Go to Testing tab
3. Click "Run All Validations"
4. Expected: ✅ 18-20/18-20 checks passed

### Comprehensive Testing (40 minutes)
See [Testing Guide](docs/02-TESTING-GUIDE.md) for complete checklist.

---

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guide](docs/01-CONTRIBUTING-GUIDE.md) first.

### Development Workflow
1. Fork the repository
2. Create feature branch: \`git checkout -b feature/AmazingFeature\`
3. Follow coding conventions (see Contributing Guide)
4. Test with multiple roles
5. Submit pull request

---

## 📊 Project Status

### ✅ Completed Features (85%)

**Core Infrastructure:**
- ✅ Next.js 15 with App Router & Turbopack
- ✅ Firebase Firestore with real-time sync
- ✅ Firebase Authentication (email/password)
- ✅ Session-scoped data architecture
- ✅ Role-based access control (4 roles)
- ✅ Dual authentication (UID + email) system

**Student Features:**
- ✅ Team creation with atomic project numbering
- ✅ Team invitation system (add/remove members)
- ✅ Mentorship request workflow
- ✅ Unified phase submission modal
- ✅ Version control for submissions
- ✅ Google Drive integration
- ✅ Real-time grade tracking
- ✅ Meeting announcements banner
- ✅ My Meetings tab with Google Meet links

**Faculty Features:**
- ✅ Complete dashboard (6 tabs)
- ✅ Mentorship request management
- ✅ Abstract review with 5 sub-tabs
- ✅ Collapsible inline marking interface
- ✅ Meeting scheduling system
- ✅ Panel and mentor evaluations
- ✅ Team detail pages (4 sub-tabs)
- ✅ Conflict-free dual role system
- ✅ Real-time data with caching (5-min TTL)

**Admin Features:**
- ✅ Session management
- ✅ Bulk CSV import (users & teams)
- ✅ CSV export for all data entities
- ✅ Automated panel creation with conflict detection
- ✅ Manual panel assignment
- ✅ CSV-based panel assignment (bulk import)
- ✅ Phase configuration & management
- ✅ Grade visibility controls
- ✅ Deadline extension system
- ✅ System validator (18+ checks)
- ✅ Analytics dashboard
- ✅ Announcement cleanup tools

**External Evaluator Features:**
- ✅ Modern gradient dashboard
- ✅ Phase-based team assignment
- ✅ Independent evaluation interface
- ✅ Comprehensive help section

### 🚧 In Progress (10%)

- 🚧 Advanced analytics & reporting
- 🚧 Email notification integration (template ready)
- 🚧 Team activity timeline
- 🚧 PDF report generation

### 📋 Planned (5%)

- 📋 Multi-file upload support
- 📋 Advanced search & filtering
- 📋 Pagination for large datasets
- 📋 Excel export (CSV already implemented)
- 📋 Timezone support
- 📋 Mobile app (React Native)

---

## 🎉 Recent Updates (Last 30 Days)

### January 2026
- ✨ Added comprehensive workflow documentation
- ✨ Updated README with all feature details
- 📝 Created Faculty User Guide

### October 2025
- ✨ Collapsible inline marking interface (replaced modal-based)
- 🐛 Fixed phase creation validation
- 🐛 Resolved CORS errors documentation
- 📝 Enhanced troubleshooting guide

### September 2025
- ✨ Faculty mentorship request system
- ✨ Meeting scheduling with conflict detection
- ✨ Panel evaluation with aggregation
- ✨ Deadline extension system
- ✨ Grade visibility controls
- 🐛 Fixed team info display issues (UID vs email)
- 🐛 Resolved mentorship status mismatch

### August 2025
- ✨ External evaluator dashboard
- ✨ Announcement auto-cleanup system
- ✨ Enhanced admin analytics

See [Changelog](docs/05-CHANGELOG.md) for complete version history.

---

## 🙏 Acknowledgments

- **Next.js Team** - For the amazing framework
- **Firebase Team** - For real-time database and auth
- **ShadCN** - For beautiful UI components

---

<div align="center">

**Built with ❤️ for better project management**

[Documentation](docs/) • [Contributing](docs/01-CONTRIBUTING-GUIDE.md) • [Changelog](docs/05-CHANGELOG.md)

</div>

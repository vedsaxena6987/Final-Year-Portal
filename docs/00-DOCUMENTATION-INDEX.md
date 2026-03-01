# 📚 Final Year Portal - Documentation Hub

**Version:** 1.0.0 (Production Ready)  
**Last Updated:** January 8, 2026  
**Status:** Active Development

---

## 🎯 Project Overview

The **Final Year Portal** is a Next.js 15 + Firebase application that transforms CSE final year project management from fragmented chaos to structured efficiency.

### Key Benefits
- **🎓 Academic Integrity** - Faculty cannot evaluate teams they mentor (3-layer enforcement)
- **⚖️ Fair Distribution** - Automated panel assignment with workload balancing
- **🔍 Transparency** - Real-time progress tracking for all stakeholders
- **⚡ Automation** - Bulk imports, notifications, deadline management

### Project Status
- **✅ Core Features:** 70% complete
- **🚧 In Progress:** 20% (evaluations, meetings)
- **📋 Planned:** 10% (advanced analytics)

---

## 📖 Documentation Structure

### Getting Started (5-15 minutes)

| # | Document | What You'll Learn | Time |
|---|----------|-------------------|------|
| 📘 | **[README](../README.md)** | Project overview, quick start, tech stack | 5 min |
| 🧪 | **[02-TESTING-GUIDE.md](02-TESTING-GUIDE.md)** | 100+ test checklist, automated validation | 10-40 min |
| 🚀 | **[03-DEPLOYMENT-GUIDE.md](03-DEPLOYMENT-GUIDE.md)** | Firestore rules, production deployment | 5-30 min |

### For Developers

| # | Document | What's Inside | Best For |
|---|----------|---------------|----------|
| 🤝 | **[01-CONTRIBUTING-GUIDE.md](01-CONTRIBUTING-GUIDE.md)** | Code standards, patterns, PR process | New contributors |
| 🏗️ | **[09-ARCHITECTURE-GUIDE.md](09-ARCHITECTURE-GUIDE.md)** | Tech stack, data models, real-time patterns | Technical deep-dive |
| 🤖 | **[.github/copilot-instructions.md](../.github/copilot-instructions.md)** | Critical patterns for AI coding agents | AI-assisted development |
| 🐛 | **[04-TROUBLESHOOTING-GUIDE.md](04-TROUBLESHOOTING-GUIDE.md)** | Common issues, error fixes, debugging | Problem solving |
| 🔌 | **[10-FIRESTORE-CONNECTION-TROUBLESHOOTING.md](10-FIRESTORE-CONNECTION-TROUBLESHOOTING.md)** | Network errors, ad blocker issues, offline mode | Connection issues |

### Feature Documentation

| # | Document | Feature Coverage | Updated |
|---|----------|------------------|---------|
| 📤 | **[07-FEATURE-PHASE-SUBMISSIONS.md](07-FEATURE-PHASE-SUBMISSIONS.md)** | Submission modal, version control, history | ✅ Current |
| 📝 | **[06-ADMIN-GUIDE-CSV-IMPORT.md](06-ADMIN-GUIDE-CSV-IMPORT.md)** | Bulk user/team import workflows | ✅ Current |
| 📢 | **[08-FEATURE-ANNOUNCEMENTS.md](08-FEATURE-ANNOUNCEMENTS.md)** | Notification system, cleanup service | ✅ Current |

### Project History

| # | Document | Contains | Useful For |
|---|----------|----------|------------|
| 📜 | **[05-CHANGELOG.md](05-CHANGELOG.md)** | All features, fixes, improvements by date | Tracking changes |

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 18+ (LTS recommended)
- Firebase project with Firestore & Authentication
- Git

### Installation (5 minutes)

```bash
# 1. Clone and install
git clone <repo-url>
cd final-year-portal
npm install

# 2. Configure Firebase
cp .env.example .env.local
# Edit .env.local with your Firebase credentials

# 3. Deploy Firestore rules
firebase login
firebase deploy --only firestore:rules

# 4. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Next Steps:** See [02-TESTING-GUIDE.md](02-TESTING-GUIDE.md) to verify your setup.

---

## 🎓 Core Concepts

### Session-Scoped Architecture
All data (teams, panels, phases) belongs to an academic year (`sessionId`). Always filter queries by active session.

### Dual Authentication
- `user` = Firebase Auth (uid, email)
- `userData` = Firestore document (role, teamId, projectNumber)

### Real-time Data Pattern
Use `onSnapshot` (not `getDoc`) for reactive UI. Always include cleanup functions to prevent memory leaks.

### Email vs UID Convention
- User docs keyed by **email**: `users/s1@gehu.ac.in`
- Team leadership uses **UID**: `team.leaderId`
- Team membership uses **email array**: `team.members`

**Deep Dive:** See [09-ARCHITECTURE-GUIDE.md](09-ARCHITECTURE-GUIDE.md) for complete patterns.

---

## 🔍 Common Problems & Solutions

| Problem | Quick Fix | Full Guide |
|---------|-----------|------------|
| 🔴 Deployment failing | Deploy Firestore rules | [03-DEPLOYMENT-GUIDE.md § Troubleshooting](03-DEPLOYMENT-GUIDE.md#troubleshooting) |
| 🔴 Permission errors | Run SystemValidator in admin dashboard | [03-DEPLOYMENT-GUIDE.md § Firestore Rules](03-DEPLOYMENT-GUIDE.md#firestore-rules-deployment) |
| 🔴 CORS errors | Check environment variables | [04-TROUBLESHOOTING-GUIDE.md § CORS](04-TROUBLESHOOTING-GUIDE.md#cors-errors) |
| 🔴 Tests failing | Check active session | [02-TESTING-GUIDE.md § Common Issues](02-TESTING-GUIDE.md#common-issues) |
| 🔴 CSV import errors | Use parseCSVLine() helper | [06-ADMIN-GUIDE-CSV-IMPORT.md](06-ADMIN-GUIDE-CSV-IMPORT.md) |

---

## 📋 Documentation Files

### Numbered Reading Order

```
docs/
├── 00-DOCUMENTATION-INDEX.md          ← You are here
├── 01-CONTRIBUTING-GUIDE.md           Code standards, patterns, workflows
├── 02-TESTING-GUIDE.md                100+ test checklist
├── 03-DEPLOYMENT-GUIDE.md             Production deployment steps
├── 04-TROUBLESHOOTING-GUIDE.md        Error fixes and debugging
├── 05-CHANGELOG.md                    Version history
├── 06-ADMIN-GUIDE-CSV-IMPORT.md       Bulk import workflows
├── 07-FEATURE-PHASE-SUBMISSIONS.md    Phase submission system
├── 08-FEATURE-ANNOUNCEMENTS.md        Notification system
└── 09-ARCHITECTURE-GUIDE.md           Technical deep-dive
```

### By Topic

**Development:**
- [01-CONTRIBUTING-GUIDE.md](01-CONTRIBUTING-GUIDE.md) - Code standards
- [09-ARCHITECTURE-GUIDE.md](09-ARCHITECTURE-GUIDE.md) - Architecture patterns
- [../.github/copilot-instructions.md](../.github/copilot-instructions.md) - AI agent guidelines

**Testing & Deployment:**
- [02-TESTING-GUIDE.md](02-TESTING-GUIDE.md) - Testing workflows
- [03-DEPLOYMENT-GUIDE.md](03-DEPLOYMENT-GUIDE.md) - Production deployment
- [04-TROUBLESHOOTING-GUIDE.md](04-TROUBLESHOOTING-GUIDE.md) - Problem solving

**Features:**
- [06-ADMIN-GUIDE-CSV-IMPORT.md](06-ADMIN-GUIDE-CSV-IMPORT.md) - CSV imports
- [07-FEATURE-PHASE-SUBMISSIONS.md](07-FEATURE-PHASE-SUBMISSIONS.md) - Submissions
- [08-FEATURE-ANNOUNCEMENTS.md](08-FEATURE-ANNOUNCEMENTS.md) - Notifications

**History:**
- [05-CHANGELOG.md](05-CHANGELOG.md) - All changes by date


---

## 🧪 Development Commands

```bash
npm run dev              # Start Turbopack dev server (port 3000)
npm run build            # Production build
npm run start            # Start production server
npm run lint             # ESLint validation
npm run panel:verify     # Verify panel assignment logic
```

**Note:** Turbopack is pre-configured in `package.json` scripts.

---

## 🏗️ Tech Stack Overview

| Category | Technology | Version |
|----------|-----------|---------|
| **Framework** | Next.js with App Router | 15.5.9 |
| **UI Library** | React | 19.1.1 |
| **Styling** | Tailwind CSS + ShadCN/UI | 4.x + 22 components |
| **Database** | Firebase Firestore | 12.3.0 |
| **Authentication** | Firebase Auth | 12.3.0 |
| **Build Tool** | Turbopack | Built-in |
| **Notifications** | Sonner | 2.0.7 |
| **Charts** | Recharts | 3.2.1 |

**Full Details:** See [09-ARCHITECTURE-GUIDE.md](09-ARCHITECTURE-GUIDE.md)

---

## 📚 Additional Resources

### Official Documentation
- [Next.js 15](https://nextjs.org/docs)
- [Firebase](https://firebase.google.com/docs)
- [ShadCN/UI](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)

### Project Files
- **Root README:** [../README.md](../README.md)
- **AI Instructions:** [../.github/copilot-instructions.md](../.github/copilot-instructions.md)
- **Firestore Rules:** `../firestore.rules`
- **Package Config:** `../package.json`

---

## 📊 Project Statistics

- **Documentation Files:** 10 markdown files
- **Total Doc Lines:** 6,000+ lines
- **React Components:** 50+ components
- **Business Services:** 12 service modules
- **Custom Hooks:** 8 specialized hooks
- **UI Components:** 22 ShadCN components

---

## 🎯 Next Steps

### For New Developers
1. Read [../README.md](../README.md) - Quick overview (5 min)
2. Follow [Quick Start Guide](#-quick-start-guide) - Setup (5 min)
3. Study [09-ARCHITECTURE-GUIDE.md](09-ARCHITECTURE-GUIDE.md) - Patterns (30 min)
4. Review [01-CONTRIBUTING-GUIDE.md](01-CONTRIBUTING-GUIDE.md) - Standards (20 min)

### For Testing
1. Run [02-TESTING-GUIDE.md](02-TESTING-GUIDE.md) Quick Test - Validation (10 min)
2. Complete feature testing - All workflows (40 min)

### For Deployment
1. Follow [03-DEPLOYMENT-GUIDE.md](03-DEPLOYMENT-GUIDE.md) - Production (30 min)
2. Verify with SystemValidator - Admin dashboard (5 min)

---

**Last Updated:** January 8, 2026  
**Maintainer:** Development Team  
**Status:** Production Ready

---

## 🏗️ Architecture Overview

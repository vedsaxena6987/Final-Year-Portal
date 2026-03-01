# 🧪 Testing Guide - Final Year Portal

**Last Updated:** October 22, 2025  
**Status:** Complete testing documentation  
**Time to Complete:** 10-40 minutes (depending on depth)

---

## 📋 Quick Navigation

- [Quick Start (10 min)](#quick-start-10-minutes)
- [Feature Tests (25 min)](#feature-tests-25-minutes)
- [Comprehensive Checklist](#comprehensive-test-checklist)
- [Automated Testing](#automated-testing)
- [Edge Cases](#edge-cases--troubleshooting)
- [Common Issues](#common-issues--fixes)

---

## 🚀 Quick Start (10 Minutes)

### Prerequisites
- Development server running (`npm run dev`)
- Active session created
- Test user accounts (admin, faculty, student)

### Step 1: Start Development Server (2 min)

```powershell
cd E:\Final_Year_Project\final-year-portal
npm run dev
```

**Expected Output:**
```
- Local:        http://localhost:3000
- ready started server on 0.0.0.0:3000
```

Open browser: **http://localhost:3000**

---

### Step 2: Run Automated Validation (5 min)

1. **Login as Admin**
   - Navigate to `/login`
   - Enter admin credentials

2. **Access Testing Dashboard**
   - Go to Dashboard → **Testing** tab
   - Click "Run All Validations"
   - Wait 5-10 seconds

3. **Review Results**
   - ✅ Expected: 18-20 total checks
   - ✅ Target: 15+ passed tests
   - ❌ If permission errors: Deploy Firestore rules (see [DEPLOYMENT.md](DEPLOYMENT.md))

**Success Criteria:**
```
✅ Meeting Scheduling System: 4/4 checks passed
✅ Panel Evaluation System: 4/4 checks passed
✅ Extension System: 4/4 checks passed
✅ Meeting Requirements: 4/4 checks passed
✅ Marks Visibility: 2/2 checks passed

Total: 18-20/18-20 checks passed
```

---

### Step 3: Create Test Data (Optional, 10 min)

If automated tests show "no data" errors:

#### 3.1 Create Session
- Admin Dashboard → Sessions tab
- Click "Add Session"
- Fill: Name (2024-2025), Start/End dates
- Check "Set as active"
- Save

#### 3.2 Create Teams
- Admin Dashboard → Teams tab
- Create 2-3 test teams
- Assign team members

#### 3.3 Create Phases
- Admin Dashboard → Phases tab
- Create 2 phases:
  1. **Mentor Phase**: evaluatorType: mentor, minPanelists: 0
  2. **Panel Phase**: evaluatorType: panel, minPanelists: 2

#### 3.4 Create Panel
- Admin Dashboard → Panels tab
- Add 3-4 faculty members
- Assign teams to panel

---

## 🎯 Feature Tests (25 Minutes)

### Test 1: Meeting Scheduling (5 min)

**Objective:** Verify faculty can schedule meetings and students receive notifications.

**Steps:**
1. Login as **admin**
2. Create panel phase with meeting requirements (minPanelists: 2)
3. Login as **faculty** (panel member)
4. Navigate to Phases tab
5. Click "Schedule Meeting" button
6. Select teams, date, mode (online/offline)
7. Submit meeting
8. Login as **student** (team member)
9. Check dashboard for meeting banner
10. Navigate to "My Meetings" tab

**Expected Results:**
- ✅ Meeting appears in faculty's meetings list
- ✅ Banner shows at top of student dashboard
- ✅ "My Meetings" tab displays the scheduled meeting
- ✅ Online meetings show "Join Meeting" button
- ✅ Urgency indicator appears for meetings within 24 hours

**Edge Cases:**
- Try scheduling meeting in the past (should fail)
- Schedule conflicting meetings (should warn)
- Schedule with 0 teams selected (should fail validation)

---

### Test 2: Deadline Extensions (3 min)

**Objective:** Verify admin can grant extensions and students see alerts.

**Steps:**
1. Login as **admin**
2. Navigate to Phases tab
3. Click **Clock icon** on a phase
4. Select team(s) for extension
5. Set extended deadline (future date)
6. Enter reason
7. Click "Grant Extension"
8. Login as **student** (team member)
9. Check submission form for the phase

**Expected Results:**
- ✅ Extension granted successfully (green toast)
- ✅ Amber alert badge shows extended deadline
- ✅ Original deadline crossed out
- ✅ New deadline displayed prominently
- ✅ Reason shown in alert
- ✅ Extension appears in "Active Extensions" list (admin)

**Edge Cases:**
- Grant extension with date before original deadline (should fail)
- Revoke extension (should remove amber alert)
- Grant multiple extensions to same team (should replace old one)

---

### Test 3: Panel Evaluation (5 min)

**Objective:** Verify faculty can evaluate teams only after meeting requirements.

**Steps:**
1. Login as **faculty** (panel member)
2. Navigate to Phases tab
3. Select panel phase
4. Try to evaluate a team (before scheduling meeting)
5. Verify evaluation is blocked with requirement badge
6. Schedule meeting with the team
7. Mark meeting as completed
8. Try to evaluate again
9. Enter marks for all team members
10. Add feedback
11. Submit evaluation

**Expected Results:**
- ✅ Evaluation blocked before meeting requirement met
- ✅ Badge shows "2/2 panelists must meet" or similar
- ✅ After meeting: evaluation form accessible
- ✅ Individual marks for each student can be entered
- ✅ Average marks calculated correctly
- ✅ Evaluation saves successfully
- ✅ Team shows "Evaluated" badge

**Edge Cases:**
- Try evaluating without feedback (should fail)
- Enter marks above maxMarks (should validate)
- Try evaluating team you mentor (should be hidden)

---

### Test 4: Marks Visibility Control (2 min)

**Objective:** Verify admin can hide/show phase marks from students.

**Steps:**
1. Login as **admin**
2. Navigate to Phases tab
3. Toggle **Eye icon** on a phase (hide marks)
4. Login as **student**
5. Check "My Grades" tab
6. Verify hidden phase shows alert
7. Login as **admin**
8. Toggle **Eye icon** again (show marks)
9. Login as **student**
10. Verify marks are now visible

**Expected Results:**
- ✅ Eye icon changes to EyeOff when marks hidden
- ✅ Student sees "Hidden grades" alert with count
- ✅ Lock icon appears on hidden phases
- ✅ Hidden marks don't show values
- ✅ Showing marks immediately updates student view
- ✅ Real-time updates work (no refresh needed)

---

### Test 5: Meeting Requirements (5 min)

**Objective:** Verify panel evaluation respects meeting requirements.

**Steps:**
1. Login as **admin**
2. Create panel phase with `minPanelistsMeetRequired: 2`
3. Create panel with 3 faculty members
4. Assign teams to panel
5. Login as **faculty member 1**
6. Schedule and complete meeting with Team A
7. Try to evaluate Team A
8. Verify requirement badge shows "1/2 panelists"
9. Login as **faculty member 2**
10. Schedule and complete meeting with Team A
11. Login as **faculty member 1**
12. Try to evaluate Team A again
13. Verify evaluation is now allowed

**Expected Results:**
- ✅ Phase configuration stores meeting requirements
- ✅ Badge accurately counts panelists who have met
- ✅ Evaluation blocked until requirement met
- ✅ Clear messaging about requirements
- ✅ Multiple faculty can meet independently
- ✅ Requirement satisfied after threshold met
- ✅ Status updates in real-time

---

## 📝 Comprehensive Test Checklist

### 1. Meeting Scheduling System

#### 1.1 Create Meeting (Faculty/Admin)
- [ ] Can open "Schedule Meeting" dialog
- [ ] Can select active phase from dropdown
- [ ] Can select multiple teams
- [ ] Can choose meeting mode (online/offline/both)
- [ ] Can set date and time
- [ ] Online mode shows Google Meet link field
- [ ] Offline mode shows location field
- [ ] Can submit meeting successfully
- [ ] Toast notification appears on success
- [ ] Meeting appears in list immediately

#### 1.2 Meeting Display (Faculty)
- [ ] Meetings list shows all scheduled meetings
- [ ] Upcoming meetings sorted by date
- [ ] Meeting cards show: phase, teams, date, mode
- [ ] Status indicators display correctly
- [ ] Can filter meetings by phase
- [ ] Can edit own meetings
- [ ] Can cancel own meetings
- [ ] Can mark meetings as completed

#### 1.3 Meeting Notifications (Student)
- [ ] Banner appears on dashboard for upcoming meetings
- [ ] Banner shows next meeting details
- [ ] Urgency indicator for meetings within 24 hours
- [ ] "Join Meeting" button works for online meetings
- [ ] Can dismiss banner
- [ ] "My Meetings" tab shows all team meetings
- [ ] Past meetings show completion status
- [ ] Future meetings show countdown/date

#### 1.4 Meeting Conflict Detection
- [ ] Warns when scheduling conflicting times
- [ ] Checks faculty availability
- [ ] Prevents double-booking
- [ ] Shows existing meetings in time slot

---

### 2. Panel Evaluation System

#### 2.1 Panel Assignment
- [ ] Teams assigned to panels display correctly
- [ ] Faculty can see their panel teams
- [ ] Conflict detection prevents mentor evaluating mentored teams
- [ ] Panel members list shows correctly
- [ ] Team count per panel is accurate

#### 2.2 Evaluation Form
- [ ] Form opens for eligible teams
- [ ] Shows all team members
- [ ] Individual mark input for each student
- [ ] Feedback textarea is required
- [ ] Can enter fractional marks (0.5 step)
- [ ] Validates marks range (0 to maxMarks)
- [ ] Average marks calculated correctly
- [ ] Can submit evaluation successfully

#### 2.3 Multiple Evaluators
- [ ] Multiple faculty can evaluate same team
- [ ] Each evaluation stored independently
- [ ] Aggregated marks calculated correctly
- [ ] Shows count of evaluations submitted
- [ ] Can view individual evaluator marks
- [ ] Can update own evaluation

#### 2.4 Evaluation Display (Student)
- [ ] Students can see their individual marks
- [ ] Can see team average marks
- [ ] Can see all evaluator feedback
- [ ] Hidden evaluations show alert
- [ ] Evaluation history displays correctly

---

### 3. Marks Visibility Control

#### 3.1 Admin Controls
- [ ] Eye/EyeOff icon toggles visibility
- [ ] Icon state persists after refresh
- [ ] Can toggle multiple phases independently
- [ ] Visual indicator shows current state
- [ ] Changes apply immediately

#### 3.2 Student View
- [ ] Hidden phases show lock icon
- [ ] Alert displays count of hidden evaluations
- [ ] Marks replaced with "Hidden" text
- [ ] Feedback not visible when hidden
- [ ] Shows marks immediately when visibility restored
- [ ] Real-time updates work without refresh

---

### 4. Deadline Extension System

#### 4.1 Grant Extension (Admin)
- [ ] Can open extension dialog from phase row
- [ ] Team selection with checkboxes works
- [ ] Date picker only allows future dates
- [ ] Reason field is required
- [ ] Can grant to single team
- [ ] Can grant to multiple teams (bulk)
- [ ] Success toast appears
- [ ] Active extensions list updates

#### 4.2 Extension Display (Student)
- [ ] Amber alert badge appears on submission form
- [ ] Original deadline shown crossed out
- [ ] Extended deadline displayed prominently
- [ ] Reason for extension shown
- [ ] Alert dismissible but persists
- [ ] Works on all submission types (abstract, synopsis, phase)

#### 4.3 Extension Management (Admin)
- [ ] Active extensions list shows all current extensions
- [ ] Can revoke extension
- [ ] Revoked extensions no longer show alerts
- [ ] Extension replaces previous extension for same team/phase
- [ ] No duplicate extensions for same team/phase

---

### 5. Meeting Requirements & Phase Status

#### 5.1 Phase Configuration
- [ ] Can set `minPanelistsMeetRequired` when creating phase
- [ ] Value validates (must be > 0 for panel phases)
- [ ] Configuration saved correctly
- [ ] Displays in phase list

#### 5.2 Meeting Requirement Badge
- [ ] Badge shows current meeting count vs required
- [ ] Updates in real-time as meetings completed
- [ ] Shows checkmark when requirement met
- [ ] Shows X when requirement not met
- [ ] Different colors for met/unmet status
- [ ] 4 display variants work (badge, alert, inline, detail)

#### 5.3 Evaluation Eligibility
- [ ] Evaluation blocked when requirement not met
- [ ] Clear error message explains requirement
- [ ] Shows progress toward requirement
- [ ] Unblocks immediately when requirement met
- [ ] Works for mentor phases (no requirement)
- [ ] Works for panel phases (with requirement)

#### 5.4 Meeting Stats Service
- [ ] Correctly counts unique panelists who have met
- [ ] Handles multiple meetings by same faculty
- [ ] Filters by phase correctly
- [ ] Returns accurate eligibility status
- [ ] Bulk stats work for multiple teams

---

### 6. Student Dashboard Features

#### 6.1 My Meetings Tab
- [ ] Shows all upcoming meetings
- [ ] Shows past meetings
- [ ] Groups by phase
- [ ] Displays meeting details (date, time, mode, location)
- [ ] "Join Meeting" button for online meetings
- [ ] Urgency indicators work
- [ ] Loading states display

#### 6.2 Meeting Announcement Banner
- [ ] Shows next upcoming meeting
- [ ] Displays on dashboard home
- [ ] Shows countdown for meetings within 24 hours
- [ ] "Join Meeting" link works
- [ ] Can dismiss banner
- [ ] Reappears after page refresh

#### 6.3 My Grades Tab
- [ ] Shows all phase evaluations
- [ ] Individual marks display
- [ ] Team average marks display
- [ ] Feedback from evaluators shown
- [ ] Hidden evaluations show alert
- [ ] Filter by phase works
- [ ] Empty state when no grades

#### 6.4 Submission Forms
- [ ] Extension alerts show on forms
- [ ] Deadline displays correctly
- [ ] Can submit Google Drive links
- [ ] Link validation works
- [ ] Success/error messages appear
- [ ] Submission history displays

---

### 7. Faculty Dashboard Features

#### 7.1 Phases Tab
- [ ] Lists all phases for current session
- [ ] Phase cards show metadata
- [ ] Can filter by phase type
- [ ] "Schedule Meeting" button accessible
- [ ] "Evaluate" actions available for eligible teams
- [ ] Meeting requirement badges display

#### 7.2 Teams List
- [ ] Shows mentored teams
- [ ] Shows panel-assigned teams
- [ ] Search/filter functionality
- [ ] Team details accessible
- [ ] Status indicators accurate

#### 7.3 Evaluation Workflow
- [ ] Can access evaluation form
- [ ] Meeting requirement enforced
- [ ] Can enter marks for all members
- [ ] Feedback required
- [ ] Can save evaluation
- [ ] Can update evaluation
- [ ] Cannot evaluate conflicted teams

---

### 8. Admin Dashboard Features

#### 8.1 Testing Tab (SystemValidation)
- [ ] Tab appears in admin dashboard
- [ ] "Run All Validations" button works
- [ ] Tests execute without errors
- [ ] Results display with expand/collapse
- [ ] Pass/fail indicators accurate
- [ ] JSON details viewable
- [ ] Summary shows total/passed/failed counts

#### 8.2 Phase Management
- [ ] Can create phases with meeting requirements
- [ ] Eye icon toggles marks visibility
- [ ] Clock icon opens extension dialog
- [ ] Can edit phase details
- [ ] Can delete phases
- [ ] Phase list displays all metadata

#### 8.3 Extension Management
- [ ] Extension dialog accessible from phase row
- [ ] Team selection works
- [ ] Can grant extensions
- [ ] Active extensions list shows correctly
- [ ] Can revoke extensions
- [ ] Bulk operations work

---

### 9. Real-time Updates

#### 9.1 Meeting Updates
- [ ] New meetings appear immediately (no refresh)
- [ ] Meeting status updates in real-time
- [ ] Cancellations reflect immediately
- [ ] Student banner updates when meetings change

#### 9.2 Evaluation Updates
- [ ] New evaluations appear immediately
- [ ] Marks visibility toggles update live
- [ ] Student grades update without refresh
- [ ] Panel evaluation count updates

#### 9.3 Extension Updates
- [ ] Extension alerts appear immediately
- [ ] Revoked extensions disappear immediately
- [ ] Active extension list updates live

---

### 10. Error Handling & Edge Cases

#### 10.1 Validation Errors
- [ ] Form validation messages display
- [ ] Required fields enforced
- [ ] Date validations work (no past dates)
- [ ] Number validations work (marks range)
- [ ] Google Drive link validation works

#### 10.2 Permission Errors
- [ ] Students cannot access admin features
- [ ] Faculty cannot access admin features
- [ ] Students cannot see other teams' data
- [ ] Appropriate error messages shown

#### 10.3 Empty States
- [ ] "No meetings" state displays
- [ ] "No grades" state displays
- [ ] "No extensions" state displays
- [ ] Empty states have helpful messages

#### 10.4 Loading States
- [ ] Skeleton loaders during data fetch
- [ ] Loading spinners on buttons during submit
- [ ] Graceful handling of slow connections
- [ ] Timeout handling

#### 10.5 Edge Cases
- [ ] Handles teams with 1 member
- [ ] Handles teams with max members (4)
- [ ] Handles phases with no submissions
- [ ] Handles panels with min faculty (2)
- [ ] Handles panels with max faculty (10+)
- [ ] Handles concurrent evaluations
- [ ] Handles rapid marks visibility toggles
- [ ] Handles deleted teams/faculty
- [ ] Handles session changes

---

## 🤖 Automated Testing

### SystemValidator Overview

The `SystemValidator` utility provides automated testing for 5 major systems:

1. **Meeting Scheduling System** (4 checks)
2. **Panel Evaluation System** (4 checks)
3. **Extension System** (4 checks)
4. **Meeting Requirements** (4 checks)
5. **Marks Visibility Control** (2 checks)

**Total: 18-20 automated checks**

---

### Running Automated Tests

#### Method 1: Admin Dashboard (Recommended)

1. Login as admin
2. Navigate to Dashboard → **Testing** tab
3. Click "Run All Validations"
4. Wait 5-10 seconds
5. Review results (expandable sections)

---

#### Method 2: Browser Console

```javascript
// Open browser console (F12)

// Import the validator
const SystemValidator = (await import('/src/lib/systemValidator.js')).default;

// Get active session ID (replace with your session)
const sessionId = "your-session-id";

// Run all validations
const results = await SystemValidator.runAllValidations(sessionId);

// View results
console.log('Overall Passed:', results.summary.overallPassed);
console.log('Total Tests:', results.summary.totalTests);
console.log('Passed Tests:', results.summary.passedTests);
console.log('Failed Tests:', results.summary.failedTests);

// View details
console.log(results.results);
```

---

### Method 3: Panel Evaluation Verifier (Node Script)

Use the shared verification script to cross-check Firestore documents with the latest aggregation logic.

**Setup (one-time):**

1. Download service account key from [Firebase Console](https://console.firebase.google.com) → Project Settings → Service Accounts → Generate New Private Key
2. Save as `serviceAccountKey.json` in project root (git-ignored)
3. Set environment variable:

```powershell
$env:FIREBASE_SERVICE_ACCOUNT_PATH = "E:\Final_Year_Project\final-year-portal\serviceAccountKey.json"
```

**Run verification:**

```powershell
npm run panel:verify -- --session <activeSessionId> [--phase <phaseId>] [--team <teamId>] [--verbose]
```

**What it checks:**

- Recomputes aggregated marks + averages using the same helper as `panelEvaluationService`
- Verifies `panelEvaluationProgress` (counts, status label, total panelists)
- Confirms `panelEvaluationSummary` (team average, per-student stats, absentees)
- Flags missing submission docs for evaluated teams

**Sample output:**

```
🔍 Running panel evaluation verification...
📊 Verification complete. Checked 6 group(s).
✅ No discrepancies detected.
```

Script exits with non-zero status if discrepancies are found, making it suitable for CI smoke tests.

---

### Expected Test Results

**Successful Test Run:**
```
Meeting Scheduling System          ✅ 4/4 checks passed
├─ Meetings Collection Accessible  ✅ Pass
├─ Meeting Data Structure Valid    ✅ Pass
├─ Meeting Status Values Correct   ✅ Pass
└─ MeetingService Methods Work     ✅ Pass

Panel Evaluation System            ✅ 4/4 checks passed
├─ Panel Evaluations Collection    ✅ Pass
├─ Evaluation Structure Valid      ✅ Pass
├─ Aggregated Marks Calculation    ✅ Pass
└─ PanelEvaluationService Works    ✅ Pass

Deadline Extension System          ✅ 4/4 checks passed
├─ Extensions Collection           ✅ Pass
├─ Extension Data Validation       ✅ Pass
├─ ExtensionService Methods        ✅ Pass
└─ No Duplicate Extensions         ✅ Pass

Meeting Requirements               ✅ 4/4 checks passed
├─ Panel Phases Config Valid       ✅ Pass
├─ MeetingStatsService Works       ✅ Pass
├─ Enhanced getPhaseStatus         ✅ Pass
└─ canEvaluateTeam Logic           ✅ Pass

Marks Visibility Control           ✅ 2/2 checks passed
├─ marksVisible Field Present      ✅ Pass
└─ Visibility Distribution         ✅ Pass

═══════════════════════════════════════════════════
TOTAL: 18/18 checks passed ✅
═══════════════════════════════════════════════════
```

---

### Troubleshooting Failed Tests

#### Issue: Permission Denied Errors

**Symptoms:**
```
❌ Meetings Collection Accessible: FAIL
   Error: Missing or insufficient permissions
```

**Solution:**
1. Deploy updated Firestore rules (see [DEPLOYMENT.md](DEPLOYMENT.md))
2. Wait 2-3 minutes for propagation
3. Hard refresh browser (Ctrl+Shift+R)
4. Re-run tests

---

#### Issue: No Data Found

**Symptoms:**
```
⚠️ Panel Phases Config Valid: PASS (No data to validate)
```

**Solution:**
1. Create test data (see [Quick Start Step 3](#step-3-create-test-data-optional-10-min))
2. Re-run tests

---

#### Issue: Structure Validation Failed

**Symptoms:**
```
❌ Meeting Data Structure Valid: FAIL
   Missing required fields: ['status']
```

**Solution:**
1. Check service layer code
2. Verify document structure matches schema
3. Update documents in Firestore if needed

---

## 🐛 Edge Cases & Troubleshooting

### Extension Conflicts
- [ ] Grant extension with same deadline as original (should update)
- [ ] Grant extension to team already with extension (should replace)
- [ ] Revoke extension then grant new one (should work)
- [ ] Extension on past phase (should work but show warning)

### Meeting Conflicts
- [ ] Schedule meeting at exact same time (should warn)
- [ ] Schedule meeting during another meeting (should warn)
- [ ] Schedule past meeting (should fail)
- [ ] Schedule meeting with 0 teams (should fail)
- [ ] Schedule meeting with all teams in session (should work)

### Evaluation Edge Cases
- [ ] Evaluate with empty feedback (should fail)
- [ ] Evaluate with marks above max (should fail)
- [ ] Evaluate with negative marks (should fail)
- [ ] Evaluate same team twice (should update, not duplicate)
- [ ] Evaluate with non-numeric marks (should fail)
- [ ] Evaluate team not in panel (should not show team)

### Marks Visibility Race Conditions
- [ ] Toggle visibility rapidly (should handle gracefully)
- [ ] Toggle while student viewing grades (should update)
- [ ] Toggle during evaluation (should not affect evaluation)

### Meeting Requirement Edge Cases
- [ ] Phase with minPanelists = 0 (should not require meetings)
- [ ] Phase with minPanelists > panel size (should warn)
- [ ] Delete completed meeting (should update requirement status)
- [ ] Meeting with team then remove from panel (should handle)

---

## 💡 Common Issues & Fixes

### Issue 1: Tests Fail After Fresh Setup

**Cause:** No test data exists

**Fix:**
1. Create active session
2. Create 2-3 teams
3. Create 2 phases (mentor + panel)
4. Create panel with faculty
5. Re-run tests

---

### Issue 2: Permission Errors

**Cause:** Firestore rules not deployed

**Fix:**
See [DEPLOYMENT.md](DEPLOYMENT.md) - Firestore Rules section

---

### Issue 3: Real-time Updates Not Working

**Cause:** Missing cleanup functions or connection issues

**Fix:**
1. Check browser console for errors
2. Verify internet connection
3. Check Firestore connection in Network tab
4. Hard refresh (Ctrl+Shift+R)
5. Logout and login again

---

### Issue 4: Meeting Banner Not Showing

**Cause:** No upcoming meetings or meeting date in past

**Fix:**
1. Verify meeting exists in database
2. Check meeting date is in future
3. Verify student is in team assigned to meeting
4. Check if banner was dismissed (should reappear on refresh)

---

### Issue 5: Evaluation Form Not Opening

**Cause:** Meeting requirement not met or permission issue

**Fix:**
1. Check meeting requirement badge
2. Verify faculty has completed required meetings
3. Check faculty is panel member
4. Verify team not mentored by faculty
5. Check phase has submissions

---

## 📊 Performance Benchmarks

### Expected Load Times
- Dashboard load: < 2 seconds
- Meetings list: < 1 second
- Evaluation form: < 1.5 seconds
- Grade calculation: < 500ms
- Real-time update: < 1 second

### SystemValidator Performance
- Total test execution: 5-10 seconds
- Per suite: 1-2 seconds
- Individual test: 100-500ms

### Acceptable Ranges
- ✅ Good: < 2 seconds
- ⚠️ Acceptable: 2-5 seconds
- ❌ Slow: > 5 seconds (investigate)

---

## ✅ Success Criteria

Testing is considered successful when:

1. ✅ **Automated Tests**: 90%+ pass rate (16+/18 checks)
2. ✅ **Feature Tests**: All 5 workflows complete without errors
3. ✅ **Real-time Updates**: Work without page refresh
4. ✅ **No Console Errors**: Clean browser console
5. ✅ **Performance**: Meets benchmarks above
6. ✅ **Edge Cases**: Handled gracefully with clear messages
7. ✅ **User Experience**: Intuitive, responsive, polished

---

## 🎯 Next Steps After Testing

### If All Tests Pass ✅
1. Document any performance observations
2. Note any UX improvements needed
3. Consider deployment to staging
4. Plan user acceptance testing

### If Some Tests Fail ⚠️
1. Document all failures with details
2. Categorize by priority (critical/high/medium/low)
3. Fix critical issues first
4. Re-run affected tests
5. Update documentation

### If Many Tests Fail ❌
1. Review [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Check Firestore security rules deployed
3. Verify test data setup
4. Check network/firewall issues
5. Review console for error patterns
6. Consider fresh setup

---

## 📞 Need Help?

**Quick Reference:**
- Console errors? → [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- Feature not working? → Check relevant section above
- Permission errors? → [DEPLOYMENT.md](DEPLOYMENT.md)
- Understanding code? → [.github/copilot-instructions.md](.github/copilot-instructions.md)

**Useful Commands:**
```powershell
# Start dev server
npm run dev

# Stop server
Ctrl + C

# Check for errors
npm run lint

# Build for production
npm run build
```

---

**Total Testing Time:** 10-40 minutes depending on depth  
**Recommended Approach:** Start with Quick Start → Feature Tests → Comprehensive Checklist  
**Success Rate Target:** 90%+ automated tests, all feature tests passing

**Ready to test? Start with the [Quick Start](#quick-start-10-minutes)! 🚀**

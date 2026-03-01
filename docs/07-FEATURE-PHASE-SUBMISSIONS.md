# Phase Submission System Documentation

## Overview

The Phase Submission System is a unified solution for managing all project phase submissions in the Final Year Portal. It replaces the fragmented abstract/synopsis forms with a single, reusable component that handles ANY phase type.

**Key Features:**
- ✅ **Unified Interface**: Single modal for all phase submissions
- ✅ **Version Control**: Complete submission history with version numbers
- ✅ **Deadline Enforcement**: Validates deadlines with extension support
- ✅ **Permission-Based Access**: Leaders submit, members view-only
- ✅ **Status Tracking**: Real-time status badges (Submitted/Pending/Approved/Rejected)
- ✅ **Google Drive Integration**: Supports both files and folder links
- ✅ **Resubmission Support**: Update submissions with automatic history archival

---

## Architecture

### Component Hierarchy

```
PhaseCardWithSubmission (Wrapper)
  ├── Phase Display Card
  │   ├── Phase Name & Status Badge
  │   ├── Description
  │   ├── Dates (Start/Deadline)
  │   ├── Max Marks & Evaluator Info
  │   └── Action Button (Submit/View)
  └── PhaseSubmissionModal (Dialog)
      ├── Phase Header
      ├── Deadline Alert (with extension info)
      ├── Submission Form
      │   ├── Submission Title (required)
      │   ├── Notes (optional)
      │   └── Google Drive Link (required, validated)
      ├── Submission History Timeline
      │   └── Version Cards (collapsible)
      └── Action Buttons (Submit/Update/Close)
```

### Data Flow

```
User Action → PhaseCardWithSubmission
                ↓
          Opens PhaseSubmissionModal
                ↓
          SubmissionService Methods:
          ├── checkDeadline() - Validates timing
          ├── getSubmission() - Loads current submission
          ├── getSubmissionHistory() - Loads all versions
          ├── submitPhase() - Creates/updates submission
          └── _saveToHistory() - Archives before update
                ↓
          Firestore Collections:
          ├── /submissions/{submissionId}
          └── /submission_history/{historyId}
```

---

## File Structure

### New Files Created

1. **`src/components/dashboard/student/PhaseSubmissionModal.jsx`** (693 lines)
   - Reusable modal for all phase submissions
   - Handles form, history, deadline checks, status display

2. **`src/components/dashboard/student/PhaseCardWithSubmission.jsx`** (300+ lines)
   - Clickable phase card with submit/view button
   - Shows phase status, deadline, submission status
   - Opens PhaseSubmissionModal on click

### Modified Files

1. **`src/services/submissionService.js`**
   - Added `getSubmissionHistory(teamId, phaseId)` - Returns array of previous versions
   - Added `checkDeadline(teamId, phaseId, originalDeadline)` - Validates with extensions
   - Added `_saveToHistory(submission)` - Archives before update
   - Updated `submitPhase()` - Now accepts `submissionTitle`, `notes`, `isResubmission`

2. **`src/app/dashboard/student/page.jsx`**
   - Added import: `PhaseCardWithSubmission`
   - Updated Phases tab: Now maps phases to `PhaseCardWithSubmission` components
   - Passes `isLeader` prop for permission control

---

## Database Schema

### Collections

#### `submissions` Collection
```javascript
{
  id: string,                    // Auto-generated document ID
  teamId: string,                // Reference to team
  phaseId: string,               // Reference to phase
  submissionTitle: string,       // User-provided title
  notes: string,                 // Optional notes
  fileUrls: string[],            // Array of Google Drive links
  submittedAt: Timestamp,        // Submission time
  submittedBy: string,           // User ID who submitted
  versionNumber: number,         // Current version (1-indexed)
  status: string,                // 'submitted' | 'pending' | 'approved' | 'rejected'
  evaluationStatus: string,      // Extended status options
  sessionId: string,             // Academic session
  
  // Evaluation fields (populated by faculty/panel)
  feedback: string,
  grade: number,
  evaluatedAt: Timestamp,
  evaluatedBy: string
}
```

#### `submission_history` Collection
```javascript
{
  id: string,                    // Auto-generated document ID
  submissionId: string,          // Original submission reference
  teamId: string,
  phaseId: string,
  submissionTitle: string,
  notes: string,
  fileUrls: string[],
  submittedAt: Timestamp,
  submittedBy: string,
  versionNumber: number,         // Version at time of archival
  archivedAt: Timestamp,         // When this version was archived
  sessionId: string
}
```

---

## API Reference

### SubmissionService Methods

#### `getSubmissionHistory(teamId, phaseId)`
**Description:** Fetches all previous versions of a submission from the history collection.

**Parameters:**
- `teamId` (string): Team document ID
- `phaseId` (string): Phase document ID

**Returns:** 
```javascript
Promise<Array<{
  id: string,
  submissionTitle: string,
  notes: string,
  fileUrls: string[],
  submittedAt: { seconds: number },
  submittedBy: string,
  versionNumber: number,
  archivedAt: { seconds: number }
}>>
```

**Usage:**
```javascript
const history = await SubmissionService.getSubmissionHistory(teamId, phaseId);
history.forEach(version => {
  console.log(`Version ${version.versionNumber}: ${version.submissionTitle}`);
});
```

---

#### `checkDeadline(teamId, phaseId, originalDeadline)`
**Description:** Checks if the deadline has passed, considering any granted extensions.

**Parameters:**
- `teamId` (string): Team document ID
- `phaseId` (string): Phase document ID
- `originalDeadline` (Date): Original phase end date

**Returns:**
```javascript
Promise<{
  isPastDeadline: boolean,
  effectiveDeadline: Date,
  extensionInfo: {
    granted: boolean,
    reason: string,
    extendedDate: Date,
    grantedBy: string
  } | null
}>
```

**Usage:**
```javascript
const deadlineCheck = await SubmissionService.checkDeadline(
  teamId, 
  phaseId, 
  phase.endDate
);

if (deadlineCheck.isPastDeadline) {
  toast.error('Deadline has passed');
} else if (deadlineCheck.extensionInfo) {
  toast.info(`Extension granted until ${deadlineCheck.effectiveDeadline}`);
}
```

---

#### `_saveToHistory(submission)`
**Description:** Private method that archives the current submission before updating. Called automatically during resubmission.

**Parameters:**
- `submission` (object): Current submission document data

**Returns:** `Promise<void>`

**Note:** This is an internal method - do NOT call directly. It's invoked automatically by `submitPhase()` when `isResubmission = true`.

---

#### `submitPhase(teamId, phaseId, data)`
**Description:** Creates a new submission or updates existing one. Handles version control and history archival.

**Parameters:**
- `teamId` (string): Team document ID
- `phaseId` (string): Phase document ID
- `data` (object):
  ```javascript
  {
    submissionTitle: string,    // Required - user-provided title
    notes: string,              // Optional - additional notes
    fileUrls: string[],         // Required - Google Drive links
    submittedBy: string,        // Required - user ID
    isResubmission: boolean     // Required - triggers history save
  }
  ```

**Returns:**
```javascript
Promise<{
  success: boolean,
  error?: string
}>
```

**Usage (New Submission):**
```javascript
const result = await SubmissionService.submitPhase(teamId, phaseId, {
  submissionTitle: 'Phase 1 Implementation',
  notes: 'Implemented core features',
  fileUrls: ['https://drive.google.com/file/d/abc123'],
  submittedBy: userData.uid,
  isResubmission: false
});

if (result.success) {
  toast.success('Submitted successfully');
}
```

**Usage (Resubmission):**
```javascript
const result = await SubmissionService.submitPhase(teamId, phaseId, {
  submissionTitle: 'Phase 1 Implementation (Revised)',
  notes: 'Fixed bugs and added tests',
  fileUrls: ['https://drive.google.com/file/d/xyz789'],
  submittedBy: userData.uid,
  isResubmission: true  // This triggers history archival
});
```

---

## Component Usage

### PhaseCardWithSubmission

**Props:**
```javascript
{
  phase: {                      // Phase object from Firestore
    id: string,
    phaseName: string,
    description: string,
    startDate: Date,
    endDate: Date,
    maxMarks: number,
    evaluatorRole: string       // 'mentor' | 'panel' | 'external' | 'combined'
  },
  teamId: string,               // Team document ID
  teamName: string,             // Display name for team
  team: object,                 // Full team object
  isLeader: boolean,            // True if current user is team leader
  index: number                 // Phase index for numbering
}
```

**Example:**
```jsx
import PhaseCardWithSubmission from '@/components/dashboard/student/PhaseCardWithSubmission';

export default function PhasesTab() {
  const { phases } = usePhases();
  const { team, userData } = useAuth();
  const isLeader = userData?.uid === team?.leaderId;
  
  return (
    <div className="space-y-3">
      {phases.map((phase, index) => (
        <PhaseCardWithSubmission
          key={phase.id}
          phase={phase}
          teamId={userData.teamId}
          teamName={team.teamName}
          team={team}
          isLeader={isLeader}
          index={index}
        />
      ))}
    </div>
  );
}
```

---

### PhaseSubmissionModal

**Props:**
```javascript
{
  open: boolean,                // Controls modal visibility
  onClose: () => void,          // Callback when modal closes
  phase: object,                // Phase object (same as above)
  teamId: string,
  teamName: string,
  team: object,
  isLeader: boolean,
  viewOnly: boolean             // Forces view-only mode (overrides isLeader)
}
```

**Example:**
```jsx
import PhaseSubmissionModal from '@/components/dashboard/student/PhaseSubmissionModal';

const [modalOpen, setModalOpen] = useState(false);

<PhaseSubmissionModal
  open={modalOpen}
  onClose={() => setModalOpen(false)}
  phase={currentPhase}
  teamId={team.id}
  teamName={team.teamName}
  team={team}
  isLeader={true}
  viewOnly={false}
/>
```

---

## Features in Detail

### 1. Version Control

Every resubmission:
1. Archives current submission to `submission_history` collection
2. Increments `versionNumber` in main submission
3. Updates `submittedAt` timestamp
4. Maintains complete audit trail

**Timeline Display:**
```
Version 3 (Current) - Phase 1 Implementation (Final)
  ↓ Submitted on Mar 15, 2024 at 3:45 PM
  ↓ Notes: Fixed all panel feedback
  
Version 2 - Phase 1 Implementation (Revised)
  ↓ Submitted on Mar 10, 2024 at 2:30 PM
  ↓ Notes: Addressed mentor comments
  
Version 1 - Phase 1 Implementation
  ↓ Submitted on Mar 5, 2024 at 10:00 AM
  ↓ Initial submission
```

### 2. Deadline Validation

**Rules:**
- Cannot submit if deadline passed (shows error alert)
- Extension overrides original deadline
- Extension info displayed in blue alert
- Deadline countdown shows days remaining

**Extension Support:**
```javascript
// Extension granted by admin/faculty
{
  teamId: "team_123",
  phaseId: "phase_456",
  originalDeadline: "2024-03-15",
  extendedDeadline: "2024-03-20",
  reason: "Technical difficulties",
  grantedBy: "faculty@example.com"
}
```

### 3. Permission System

**Team Leader:**
- Can submit new work
- Can update/resubmit
- Sees "Submit Work" or "View & Update Submission" button
- Full form access

**Team Members:**
- View-only mode
- Cannot submit or edit
- Sees "View Submission" button
- Can view history and status
- Form fields disabled
- Shows "Waiting for team leader to submit" if no submission

### 4. Status Badges

| Status | Badge Color | Icon | Description |
|--------|-------------|------|-------------|
| `submitted` | Blue | FileCheck | Initial submission received |
| `pending` | Yellow | Clock | Under review |
| `approved` | Green | CheckCircle | Accepted by evaluator |
| `rejected` | Red | AlertCircle | Needs complete revision |
| `revisions_requested` | Orange | AlertCircle | Minor changes needed |

### 5. Google Drive Validation

**Accepted Formats:**
- `https://drive.google.com/file/d/{fileId}/view`
- `https://drive.google.com/open?id={fileId}`
- `https://drive.google.com/drive/folders/{folderId}`
- `https://docs.google.com/document/d/{docId}/edit`
- `https://docs.google.com/spreadsheets/d/{sheetId}/edit`
- `https://docs.google.com/presentation/d/{slideId}/edit`

**Validation:**
- Real-time validation on input
- Shows error if invalid URL
- Must be Google Drive domain
- Extracts file/folder ID

---

## Testing Guide

### Test Case 1: Team Leader Submits New Work

**Steps:**
1. Log in as team leader
2. Navigate to Phases tab
3. Click on a phase card with "Submit Work" button
4. Fill in submission form:
   - Title: "Phase 1 Implementation"
   - Notes: "Initial submission"
   - Drive Link: Valid Google Drive link
5. Click "Submit"

**Expected Results:**
- ✅ Success toast appears
- ✅ Modal closes automatically
- ✅ Phase card now shows "Submitted" badge
- ✅ Button changes to "View & Update Submission"
- ✅ Submission date shown on card

### Test Case 2: Team Leader Resubmits Work

**Steps:**
1. Open existing submission modal
2. Update title to "Phase 1 Implementation (Revised)"
3. Add notes: "Fixed bugs"
4. Update Drive link
5. Click "Update Submission"

**Expected Results:**
- ✅ Previous version saved to history
- ✅ Version number incremented
- ✅ History timeline shows new version
- ✅ Old version visible in collapsed section
- ✅ Success toast confirms update

### Test Case 3: Team Member Views Submission

**Steps:**
1. Log in as team member (non-leader)
2. Navigate to Phases tab
3. Click phase card with "View Submission" button

**Expected Results:**
- ✅ Modal opens in view-only mode
- ✅ All form fields are disabled
- ✅ Can see submission details
- ✅ Can view submission history
- ✅ No submit/update buttons visible
- ✅ Shows "View Only - Team Leader Submission" message

### Test Case 4: Deadline Enforcement

**Scenario A: Before Deadline**
- ✅ Submit button enabled
- ✅ Green deadline alert shows days remaining

**Scenario B: After Deadline (No Extension)**
- ✅ Submit button disabled
- ✅ Red alert: "Deadline has passed"
- ✅ Cannot submit new work

**Scenario C: After Original Deadline (With Extension)**
- ✅ Submit button enabled
- ✅ Blue alert: "Extension granted until [date]"
- ✅ Can submit until extended deadline

### Test Case 5: Submission History Timeline

**Steps:**
1. Create submission (Version 1)
2. Update submission twice (Versions 2, 3)
3. Open submission modal
4. Expand history section

**Expected Results:**
- ✅ Shows "Version 3 (Current)" at top
- ✅ Shows Version 2 and Version 1 below
- ✅ Each version shows:
  - Version number
  - Submission title
  - Date and time
  - Notes
  - Google Drive link
- ✅ Versions are collapsible
- ✅ Chronological order (newest first)

### Test Case 6: Status Badge Updates

**Steps:**
1. Submit work (Status: "Submitted")
2. Faculty reviews and provides feedback (Status: "Revisions Requested")
3. Update submission (Status: "Submitted")
4. Faculty approves (Status: "Approved")

**Expected Results:**
- ✅ Phase card badge updates automatically
- ✅ Modal shows correct status badge
- ✅ Badge color changes with status
- ✅ Real-time updates via Firestore listener

---

## Integration Points

### With Extension System

```javascript
// In ExtensionService
async function grantExtension(teamId, phaseId, newDeadline, reason) {
  await setDoc(doc(db, 'extensions', `${teamId}_${phaseId}`), {
    teamId,
    phaseId,
    originalDeadline: phase.endDate,
    extendedDeadline: newDeadline,
    reason,
    grantedBy: facultyId,
    grantedAt: serverTimestamp()
  });
}

// Automatically detected by checkDeadline()
```

### With Notification System

```javascript
// After successful submission
await NotificationService.create({
  recipientId: team.mentorId,
  type: 'submission_received',
  title: 'New Submission',
  message: `${team.teamName} submitted work for ${phase.phaseName}`,
  relatedId: submissionId,
  relatedType: 'submission'
});
```

### With Evaluation System

```javascript
// Faculty provides feedback
await SubmissionService.updateSubmissionStatus(submissionId, {
  status: 'revisions_requested',
  feedback: 'Please add test cases and documentation',
  evaluatedBy: facultyId,
  evaluatedAt: serverTimestamp()
});

// Triggers notification to student
// Updates status badge in real-time
```

---

## Troubleshooting

### Issue: "Submission not loading"

**Cause:** Firestore rules or missing permissions

**Solution:**
1. Check Firestore rules allow read access for submissions
2. Verify `teamId` and `phaseId` are correct
3. Check browser console for errors
4. Ensure user is authenticated

### Issue: "Cannot submit after deadline"

**Cause:** Deadline passed and no extension granted

**Solution:**
1. Check if extension exists in `/extensions` collection
2. Verify extension document ID format: `{teamId}_{phaseId}`
3. Ensure extension's `extendedDeadline` is in future
4. Contact admin to grant extension

### Issue: "Google Drive link validation fails"

**Cause:** URL format not recognized

**Solution:**
1. Use Google Drive shareable link format
2. Ensure link has public access (or shared with evaluators)
3. Check URL contains `drive.google.com` domain
4. Try different share link format (file/folder)

### Issue: "History not showing old versions"

**Cause:** History not saved before update

**Solution:**
1. Ensure `isResubmission: true` is passed to `submitPhase()`
2. Check `submission_history` collection has documents
3. Verify `submissionId` field in history matches current submission
4. Check Firestore indexes are created

---

## Future Enhancements

### Planned Features

1. **File Preview**
   - Embed Google Drive viewer in modal
   - Preview PDFs, docs, slides directly
   - Thumbnail images for quick reference

2. **Collaborative Annotations**
   - Faculty can add inline comments
   - Students can reply to specific feedback
   - Thread-based discussion per version

3. **Automated Plagiarism Check**
   - Integrate with plagiarism detection API
   - Show similarity score
   - Flag suspicious content

4. **Batch Operations**
   - Download all submissions for a phase
   - Bulk status updates by panel
   - Export submission history to CSV

5. **Advanced Analytics**
   - Submission timeline charts
   - Version comparison diff view
   - Team performance metrics

### API Improvements

```javascript
// Planned method
async function compareVersions(submissionId, version1, version2) {
  // Returns diff between two versions
  // Highlights changes in title, notes, files
}

// Planned method
async function exportSubmissionHistory(teamId, format = 'pdf') {
  // Generates downloadable report
  // Includes all versions with timestamps
}
```

---

## Maintenance Notes

### Regular Tasks

1. **Monitor submission_history growth**
   - Archive old sessions to cold storage
   - Set up automatic cleanup after 2 years
   - Monitor Firestore storage usage

2. **Update validation rules**
   - Keep Google Drive URL patterns current
   - Add new Google Workspace formats
   - Test with actual Drive links monthly

3. **Performance optimization**
   - Add pagination to history (if > 20 versions)
   - Lazy load old versions
   - Cache submission status for quick display

### Code Conventions

- All submission dates use Firestore `serverTimestamp()`
- Version numbers are 1-indexed
- Always use transactions for version increments
- History IDs use format: `{submissionId}_v{versionNumber}`

---

## Support

For issues or questions:
- Create GitHub issue with `[Phase Submission]` tag
- Include browser console errors
- Attach screenshots if UI-related
- Provide steps to reproduce

**Last Updated:** December 2024  
**Version:** 1.0.0  
**Status:** Production Ready

# System Announcements - Automatic Cleanup Guide

## Overview
This system implements automatic cleanup of system announcements to prevent clutter and improve user experience. Announcements are automatically hidden from users after 7 days, but remain in the database for admin review until manually cleaned up.

## How It Works

### 1. **Automatic UI Filtering (Client-Side)**
Location: [MeetingAnnouncements.jsx](../src/components/dashboard/MeetingAnnouncements.jsx)

```javascript
// Announcements older than 7 days are automatically filtered out
const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

const announcements = snapshot.docs
  .map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate() }))
  .filter(announcement => {
    if (!announcement.createdAt) return true; // Keep if no date
    return announcement.createdAt > sevenDaysAgo; // Only show recent ones
  });
```

**Behavior:**
- ✅ Users see only announcements from the last 7 days
- ✅ Older announcements are hidden but NOT deleted
- ✅ No manual intervention needed - happens automatically
- ✅ Announcements show age badges: "New", "Today", "3d old", etc.

### 2. **Improved Scrolling**
Enhanced ScrollArea with:
- Maximum height of 400px
- Visible scrollbar for better UX
- Gradient fade at bottom for visual cue
- Auto-adjusts based on content

### 3. **Manual Cleanup (Admin Tools)**

#### A. Mark as Read (Soft Cleanup)
Location: Admin Dashboard → Cleanup Tab

**Purpose:** Mark old announcements as read without deleting them

```javascript
AnnouncementCleanupService.cleanupOldAnnouncements(7); // Mark 7+ day old as read
```

**When to use:**
- Weekly cleanup routine
- After system updates or announcement campaigns
- When inbox is cluttered with old items

**Effect:**
- Changes `read: false` → `read: true`
- Removes from unread queries
- Preserves data for historical records

#### B. Permanent Delete
Location: Admin Dashboard → Cleanup Tab

**Purpose:** Permanently remove very old announcements

```javascript
AnnouncementCleanupService.deleteOldAnnouncements(30); // Delete 30+ day old
```

**When to use:**
- Monthly database cleanup
- Storage optimization
- Removing outdated information permanently

**Effect:**
- ⚠️ **IRREVERSIBLE** - Permanently deletes from Firestore
- Frees up database storage
- Cannot be recovered

### 4. **Cleanup Service API**

#### Available Methods

```javascript
// 1. Cleanup old announcements (mark as read)
await AnnouncementCleanupService.cleanupOldAnnouncements(daysOld);
// Returns: { success: boolean, cleaned: number, error?: string }

// 2. Delete old announcements permanently
await AnnouncementCleanupService.deleteOldAnnouncements(daysOld);
// Returns: { success: boolean, deleted: number, error?: string }

// 3. Mark all as read for a specific user
await AnnouncementCleanupService.markAllAsRead(userEmail);
// Returns: { success: boolean, marked: number, error?: string }

// 4. Get announcement statistics
await AnnouncementCleanupService.getAnnouncementStats();
// Returns: { total: number, unread: number, old: number }
```

## Recommended Cleanup Schedule

### Daily (Automatic)
✅ **Already implemented** - Users see only last 7 days

### Weekly (Manual - Admin)
Run "Mark as Read" cleanup:
1. Admin Dashboard → Cleanup tab
2. Set days to 7
3. Click "Mark as Read"
4. Result: ~X announcements marked as read

### Monthly (Manual - Admin)
Run "Delete Permanently" cleanup:
1. Admin Dashboard → Cleanup tab
2. Set days to 30 or 60
3. Confirm deletion
4. Result: ~X announcements permanently removed

## User Experience Features

### Visual Indicators
1. **Age Badges**
   - 🟢 "New" - Less than 1 hour old
   - 🔵 "Today" - Less than 24 hours old
   - 🟡 "3d old" - 3 days old
   - (Hidden after 7 days)

2. **Scroll Indicators**
   - ScrollArea with max 400px height
   - Bottom gradient fade when more content available
   - Smooth scrolling experience

3. **Item Count**
   - Badge showing total announcements + meetings
   - Collapse/Expand functionality

## Admin Dashboard Integration

### Navigation
Admin Dashboard → Cleanup (Trash icon in sidebar)

### Cleanup Panel Features
- **Live Statistics**
  - Total announcements in system
  - Unread count
  - Old (7+ days, unread) count
  - Auto-refresh button

- **Cleanup Controls**
  - Adjustable day thresholds
  - Separate "Mark as Read" and "Delete" actions
  - Confirmation for destructive operations
  - Success/error toast notifications

- **Best Practices Guide**
  - Built-in recommendations
  - Visual warnings for destructive actions
  - Usage statistics

## Data Structure

### Firestore Collection: `notifications`

```javascript
{
  id: "auto-generated",
  type: "system_announcement",
  recipientEmail: "user@gehu.ac.in",
  read: false,                    // Marked true during cleanup
  createdAt: Timestamp,
  data: {
    title: "System Announcement",
    message: "Announcement text",
    priority: "Normal"
  },
  sessionId: "session_id",
  // Added during cleanup:
  autoCleanedAt: Timestamp,       // When marked as read automatically
  markedReadAt: Timestamp         // When user manually marked as read
}
```

## Firestore Queries

### Client Query (Users)
```javascript
query(
  collection(db, 'notifications'),
  where('recipientEmail', '==', userEmail),
  where('type', '==', 'system_announcement'),
  where('read', '==', false),     // Only unread
  orderBy('createdAt', 'desc'),
  limit(10)
)
// + client-side filter for 7-day cutoff
```

### Admin Cleanup Query
```javascript
query(
  collection(db, 'notifications'),
  where('type', '==', 'system_announcement'),
  where('read', '==', false),
  where('createdAt', '<', cutoffTimestamp)
)
```

## Security Considerations

1. **Firestore Rules** (Recommended)
```javascript
// Only allow users to read their own announcements
match /notifications/{notificationId} {
  allow read: if request.auth.token.email == resource.data.recipientEmail;
  allow write: if request.auth.token.role == 'admin';
  allow delete: if request.auth.token.role == 'admin';
}
```

2. **Admin-Only Cleanup**
- Cleanup functions only accessible via Admin Dashboard
- Requires `role: 'admin'` in userData
- Protected routes and component-level checks

## Troubleshooting

### Issue: Announcements not disappearing after 7 days
**Cause:** Client-side filter not applied
**Solution:** Check `MeetingAnnouncements.jsx` lines 105-125 for filter logic

### Issue: Scroll not working
**Cause:** ScrollArea height issue or content too short
**Solution:** 
- Verify content exceeds 400px height
- Check ScrollArea className in line 224
- Test with 3+ announcements

### Issue: Cleanup not working
**Cause:** Firestore permissions or query issues
**Solution:**
- Check Firestore rules allow admin delete
- Verify timestamps are valid
- Check browser console for errors

## Future Enhancements (Optional)

1. **Scheduled Cloud Functions**
   - Auto-cleanup via Firebase Cloud Functions
   - Runs daily at midnight
   - No admin intervention needed

2. **User Preferences**
   - Let users set their own retention period (3, 7, 14 days)
   - Per-user cleanup preferences

3. **Archive System**
   - Move old announcements to archive collection
   - Searchable historical records
   - Bulk export functionality

4. **Analytics**
   - Track announcement engagement
   - Open/read rates
   - Optimal posting times

## Code Locations

| Feature | File Path |
|---------|-----------|
| UI Component | `src/components/dashboard/MeetingAnnouncements.jsx` |
| Cleanup Service | `src/services/announcementCleanupService.js` |
| Admin Panel | `src/components/dashboard/admin/AnnouncementCleanup.jsx` |
| Admin Dashboard | `src/components/dashboard/admin/AdminDashboard.jsx` |

## Testing Checklist

- [ ] Create test announcement
- [ ] Verify it appears in user dashboard
- [ ] Check age badge shows correctly
- [ ] Wait 7+ days (or modify createdAt)
- [ ] Verify old announcement is filtered out
- [ ] Test admin cleanup panel
- [ ] Run "Mark as Read" - verify count
- [ ] Check announcement marked as read in Firestore
- [ ] Run "Delete Permanently" - verify removal
- [ ] Verify stats update correctly
- [ ] Test scroll with 5+ announcements
- [ ] Check responsive behavior on mobile

---

**Last Updated:** January 7, 2026
**Version:** 1.0

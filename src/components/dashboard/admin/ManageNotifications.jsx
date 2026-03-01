// components/dashboard/admin/ManageNotifications.jsx
"use client";

import { useState, useEffect } from 'react';
import { useSession } from '@/context/SessionContext';
import { NotificationService } from '@/services/notificationService';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Send, Bell, Users, AlertTriangle, Calendar, Clock, Trash2, Eye } from 'lucide-react';
import { collection, query, where, getDocs, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import AnnouncementCleanupService from "@/services/announcementCleanupService";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, RefreshCw, Info } from "lucide-react";

import { logger } from "../../../lib/logger";
export default function ManageNotifications() {
  const { activeSession } = useSession();
  const [announcementDialog, setAnnouncementDialog] = useState(false);
  const [reminderDialog, setReminderDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [systemAnnouncements, setSystemAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [viewAnnouncementDialog, setViewAnnouncementDialog] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  const [announcement, setAnnouncement] = useState({
    title: '',
    message: '',
    priority: 'medium',
    targetRole: 'all'
  });

  // Cleanup State
  const [cleanupStats, setCleanupStats] = useState({ total: 0, unread: 0, old: 0 });
  const [cleaning, setCleaning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [daysToClean, setDaysToClean] = useState(7);
  const [daysToDelete, setDaysToDelete] = useState(30);

  // Load Cleanup Stats
  const loadCleanupStats = async () => {
    const result = await AnnouncementCleanupService.getAnnouncementStats();
    setCleanupStats(result);
  };

  useEffect(() => {
    loadCleanupStats();
  }, []);

  // Handle cleanup (mark as read)
  const handleCleanup = async () => {
    setCleaning(true);
    const result = await AnnouncementCleanupService.cleanupOldAnnouncements(daysToClean);

    if (result.success) {
      toast.success(`Cleaned up ${result.cleaned} announcement(s)`, {
        description: `Marked announcements older than ${daysToClean} days as read`
      });
      await loadCleanupStats();
    } else {
      toast.error("Cleanup failed", {
        description: result.error
      });
    }
    setCleaning(false);
  };

  // Handle delete
  const handleDelete = async () => {
    if (!confirm(`⚠️ Permanently delete announcements older than ${daysToDelete} days?\n\nThis action CANNOT be undone!`)) {
      return;
    }

    setDeleting(true);
    const result = await AnnouncementCleanupService.deleteOldAnnouncements(daysToDelete);

    if (result.success) {
      toast.success(`Deleted ${result.deleted} announcement(s)`, {
        description: `Permanently removed announcements older than ${daysToDelete} days`
      });
      await loadCleanupStats();
    } else {
      toast.error("Deletion failed", {
        description: result.error
      });
    }
    setDeleting(false);
  };

  // Fetch all system announcements
  useEffect(() => {
    if (!activeSession?.id) return;

    const fetchAnnouncements = async () => {
      setLoadingAnnouncements(true);
      try {
        const announcementsQuery = query(
          collection(db, 'notifications'),
          where('type', '==', 'system_announcement'),
          where('sessionId', '==', activeSession.id),
          orderBy('timestamp', 'desc')
        );

        const snapshot = await getDocs(announcementsQuery);
        const announcements = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setSystemAnnouncements(announcements);
      } catch (error) {
        logger.error('Error fetching announcements:', error);
        toast.error('Failed to load announcements');
      } finally {
        setLoadingAnnouncements(false);
      }
    };

    fetchAnnouncements();
  }, [activeSession?.id]);

  const handleSendAnnouncement = async () => {
    if (!announcement.title.trim() || !announcement.message.trim()) {
      toast.error('Please provide both title and message');
      return;
    }

    if (!activeSession?.id) {
      toast.error('No active session found');
      return;
    }

    setLoading(true);
    try {
      const success = await NotificationService.sendSystemAnnouncement(
        announcement.title,
        announcement.message,
        announcement.priority,
        announcement.targetRole === 'all' ? null : announcement.targetRole,
        activeSession.id
      );

      if (success) {
        toast.success('Announcement sent successfully!');
        setAnnouncementDialog(false);
        setAnnouncement({
          title: '',
          message: '',
          priority: 'medium',
          targetRole: 'all'
        });
        // Refresh announcements list
        const announcementsQuery = query(
          collection(db, 'notifications'),
          where('type', '==', 'system_announcement'),
          where('sessionId', '==', activeSession.id),
          orderBy('timestamp', 'desc')
        );
        const snapshot = await getDocs(announcementsQuery);
        const announcements = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setSystemAnnouncements(announcements);
      } else {
        toast.error('Failed to send announcement');
      }
    } catch (error) {
      toast.error('Error sending announcement', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSendDeadlineReminders = async () => {
    if (!activeSession?.id) {
      toast.error('No active session found');
      return;
    }

    setLoading(true);
    try {
      const success = await NotificationService.sendDeadlineReminders(activeSession.id);

      if (success) {
        toast.success('Deadline reminders sent successfully!');
        setReminderDialog(false);
      } else {
        toast.error('Failed to send deadline reminders');
      }
    } catch (error) {
      toast.error('Error sending reminders', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    if (!confirm('Are you sure you want to delete this announcement? This action cannot be undone.')) {
      return;
    }

    try {
      // Delete all notification documents with this announcement
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('type', '==', 'system_announcement'),
        where('sessionId', '==', activeSession.id)
      );

      const snapshot = await getDocs(notificationsQuery);
      const deletePromises = [];

      snapshot.docs.forEach(docSnap => {
        if (docSnap.id === announcementId ||
          (docSnap.data().title === systemAnnouncements.find(a => a.id === announcementId)?.title &&
            docSnap.data().message === systemAnnouncements.find(a => a.id === announcementId)?.message)) {
          deletePromises.push(deleteDoc(doc(db, 'notifications', docSnap.id)));
        }
      });

      await Promise.all(deletePromises);

      // Update local state
      setSystemAnnouncements(prev => prev.filter(a => a.id !== announcementId));
      toast.success('Announcement deleted successfully');
    } catch (error) {
      logger.error('Error deleting announcement:', error);
      toast.error('Failed to delete announcement');
    }
  };

  const viewAnnouncementDetails = (announcement) => {
    setSelectedAnnouncement(announcement);
    setViewAnnouncementDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Notification Management</h2>
          <p className="text-muted-foreground">Send announcements and manage automatic notifications</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="overview">Overview & Sending</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Send className="h-5 w-5" />
                  <span>System Announcement</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Send important announcements to all users or specific roles
                </p>
                <Button
                  onClick={() => setAnnouncementDialog(true)}
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Create Announcement
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Deadline Reminders</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Send immediate deadline reminders for upcoming phases
                </p>
                <Button
                  onClick={() => setReminderDialog(true)}
                  variant="outline"
                  className="w-full"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Send Reminders
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Bell className="h-5 w-5" />
                  <span>Auto Notifications</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Automatic notifications are enabled for system events
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Team invitations</span>
                    <Badge variant="outline" className="bg-green-50">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Mentor assignments</span>
                    <Badge variant="outline" className="bg-green-50">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Deadline reminders</span>
                    <Badge variant="outline" className="bg-green-50">Enabled</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* System Announcements History */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>System Announcements History</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    View and manage all system announcements sent in this session
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => {
                  const fetchAnnouncements = async () => {
                    setLoadingAnnouncements(true);
                    try {
                      const announcementsQuery = query(
                        collection(db, 'notifications'),
                        where('type', '==', 'system_announcement'),
                        where('sessionId', '==', activeSession.id),
                        orderBy('timestamp', 'desc')
                      );
                      const snapshot = await getDocs(announcementsQuery);
                      const announcements = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                      }));
                      setSystemAnnouncements(announcements);
                    } catch (error) {
                      logger.error('Error fetching announcements:', error);
                    } finally {
                      setLoadingAnnouncements(false);
                    }
                  };
                  fetchAnnouncements();
                }}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loadingAnnouncements ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingAnnouncements ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading announcements...
                </div>
              ) : systemAnnouncements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No system announcements sent yet
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Sent At</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {systemAnnouncements.map((announcement) => (
                        <TableRow key={announcement.id}>
                          <TableCell className="font-medium">
                            {announcement.title}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                announcement.priority === 'urgent' ? 'destructive' :
                                  announcement.priority === 'high' ? 'default' :
                                    'outline'
                              }
                            >
                              {announcement.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {announcement.targetRole || 'All Users'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {announcement.timestamp?.toDate?.()?.toLocaleString() || 'N/A'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => viewAnnouncementDetails(announcement)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteAnnouncement(announcement.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Trash2 className="h-5 w-5" />
                    Announcement Cleanup
                  </CardTitle>
                  <CardDescription className="mt-1.5">
                    Manage and cleanup old system announcements
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadCleanupStats}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Statistics */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg border bg-card">
                  <div className="text-2xl font-bold">{cleanupStats.total}</div>
                  <p className="text-sm text-muted-foreground">Total Announcements</p>
                </div>
                <div className="p-4 rounded-lg border bg-card">
                  <div className="text-2xl font-bold text-blue-600">{cleanupStats.unread}</div>
                  <p className="text-sm text-muted-foreground">Unread</p>
                </div>
                <div className="p-4 rounded-lg border bg-card">
                  <div className="text-2xl font-bold text-amber-600">{cleanupStats.old}</div>
                  <p className="text-sm text-muted-foreground">Old (7+ days, unread)</p>
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Auto-Cleanup Policy:</strong> Announcements older than 7 days are automatically
                  hidden from user views but remain in the database. Use the cleanup functions below
                  to mark them as read or permanently delete them.
                </AlertDescription>
              </Alert>

              {/* Cleanup Actions */}
              <div className="space-y-4">
                {/* Mark as Read */}
                <div className="p-4 rounded-lg border bg-muted/30">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Mark Old Announcements as Read
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Mark announcements older than specified days as read (soft cleanup)
                  </p>

                  <div className="flex items-end gap-3">
                    <div className="flex-1 max-w-xs">
                      <Label htmlFor="daysToClean">Days</Label>
                      <Input
                        id="daysToClean"
                        type="number"
                        min="1"
                        max="365"
                        value={daysToClean}
                        onChange={(e) => setDaysToClean(parseInt(e.target.value) || 7)}
                        className="mt-1"
                      />
                    </div>
                    <Button
                      onClick={handleCleanup}
                      disabled={cleaning || cleanupStats.old === 0}
                    >
                      {cleaning ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Cleaning...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Mark as Read
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Permanent Delete */}
                <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/5">
                  <h4 className="font-semibold mb-3 flex items-center gap-2 text-destructive">
                    <Trash2 className="h-4 w-4" />
                    Permanently Delete Old Announcements
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Permanently remove announcements older than specified days (cannot be undone)
                  </p>

                  <div className="flex items-end gap-3">
                    <div className="flex-1 max-w-xs">
                      <Label htmlFor="daysToDelete">Days</Label>
                      <Input
                        id="daysToDelete"
                        type="number"
                        min="30"
                        max="365"
                        value={daysToDelete}
                        onChange={(e) => setDaysToDelete(parseInt(e.target.value) || 30)}
                        className="mt-1"
                      />
                    </div>
                    <Button
                      onClick={handleDelete}
                      disabled={deleting}
                      variant="destructive"
                    >
                      {deleting ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Permanently
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Announcement Dialog */}
      <Dialog open={announcementDialog} onOpenChange={setAnnouncementDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create System Announcement</DialogTitle>
            <DialogDescription>
              Send an important announcement to users in the current session.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Announcement Title *</Label>
              <Input
                id="title"
                value={announcement.title}
                onChange={(e) => setAnnouncement(prev => ({
                  ...prev,
                  title: e.target.value
                }))}
                placeholder="Enter announcement title..."
              />
            </div>

            <div>
              <Label htmlFor="message">Message *</Label>
              <Textarea
                id="message"
                value={announcement.message}
                onChange={(e) => setAnnouncement(prev => ({
                  ...prev,
                  message: e.target.value
                }))}
                placeholder="Enter announcement message..."
                rows={5}
                className="max-h-36 md:max-h-44 resize-y"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={announcement.priority}
                  onValueChange={(value) => setAnnouncement(prev => ({
                    ...prev,
                    priority: value
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="targetRole">Target Audience</Label>
                <Select
                  value={announcement.targetRole}
                  onValueChange={(value) => setAnnouncement(prev => ({
                    ...prev,
                    targetRole: value
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="student">Students Only</SelectItem>
                    <SelectItem value="faculty">Faculty Only</SelectItem>
                    <SelectItem value="admin">Admins Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Preview</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Badge variant={announcement.priority === 'urgent' ? 'destructive' :
                    announcement.priority === 'high' ? 'default' : 'outline'}>
                    {announcement.priority.toUpperCase()}
                  </Badge>
                  <span className="text-sm text-blue-700">
                    To: {announcement.targetRole === 'all' ? 'All Users' :
                      announcement.targetRole === 'student' ? 'All Students' :
                        announcement.targetRole === 'faculty' ? 'All Faculty' : 'All Admins'}
                  </span>
                </div>
                <h5 className="font-medium text-blue-900">{announcement.title || 'Announcement Title'}</h5>
                <p className="text-sm text-blue-700">{announcement.message || 'Announcement message...'}</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAnnouncementDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendAnnouncement} disabled={loading}>
              {loading ? (
                <>Sending...</>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Announcement
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reminder Dialog */}
      <Dialog open={reminderDialog} onOpenChange={setReminderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Deadline Reminders</DialogTitle>
            <DialogDescription>
              Send immediate deadline reminders for all upcoming phase deadlines in the current session.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-orange-900 mb-1">How it works</h4>
                <ul className="text-sm text-orange-800 space-y-1">
                  <li>• Checks all active phases with deadlines within the next 48 hours</li>
                  <li>• Sends urgent notifications for deadlines within 24 hours</li>
                  <li>• Sends high-priority notifications for deadlines within 48 hours</li>
                  <li>• Only sends to users relevant to each phase (students, faculty, etc.)</li>
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReminderDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendDeadlineReminders} disabled={loading}>
              {loading ? (
                <>Sending...</>
              ) : (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  Send Reminders
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Announcement Details Dialog */}
      <Dialog open={viewAnnouncementDialog} onOpenChange={setViewAnnouncementDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Announcement Details</DialogTitle>
          </DialogHeader>

          {selectedAnnouncement && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Title</Label>
                <p className="text-lg font-medium mt-1">{selectedAnnouncement.title}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Message</Label>
                <p className="mt-1 whitespace-pre-wrap">{selectedAnnouncement.message}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Priority</Label>
                  <div className="mt-1">
                    <Badge
                      variant={
                        selectedAnnouncement.priority === 'urgent' ? 'destructive' :
                          selectedAnnouncement.priority === 'high' ? 'default' :
                            'outline'
                      }
                    >
                      {selectedAnnouncement.priority}
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground">Target Audience</Label>
                  <div className="mt-1">
                    <Badge variant="outline">
                      {selectedAnnouncement.targetRole || 'All Users'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Sent At</Label>
                <p className="mt-1">
                  {selectedAnnouncement.timestamp?.toDate?.()?.toLocaleString() || 'N/A'}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewAnnouncementDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

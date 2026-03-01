"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import MeetingService from '@/services/meetingService';
import { toast } from 'sonner';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Link as LinkIcon, 
  Users, 
  Edit, 
  Trash2,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { format, isPast } from 'date-fns';

import { logger } from "../../../lib/logger";
export default function MeetingsList({ phaseId }) {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, meeting: null });
  const [deleting, setDeleting] = useState(false);

  // Real-time listener for faculty's meetings in this phase
  useEffect(() => {
    if (!user || !phaseId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'meetings'),
      where('phaseId', '==', phaseId),
      where('facultyId', '==', user.uid),
      orderBy('scheduledDate', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const meetingsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        scheduledDate: doc.data().scheduledDate?.toDate()
      }));

      setMeetings(meetingsList);
      setLoading(false);
    }, (error) => {
      // Handle permission errors gracefully during logout
      if (error.code === 'permission-denied') {
        setMeetings([]);
        setLoading(false);
      } else {
        logger.error('Error fetching meetings:', error);
        toast.error('Failed to load meetings');
        setMeetings([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user, phaseId]);

  // Format date/time
  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    try {
      return format(new Date(date), 'MMM dd, yyyy • hh:mm a');
    } catch (e) {
      return 'Invalid date';
    }
  };

  // Check if meeting has passed
  const hasPassed = (meetingDate) => {
    return isPast(new Date(meetingDate));
  };

  // Handle cancel meeting
  const handleCancelMeeting = async () => {
    if (!deleteDialog.meeting) return;

    setDeleting(true);
    try {
      const result = await MeetingService.cancelMeeting(deleteDialog.meeting.id);
      
      if (result.success) {
        toast.success('Meeting cancelled successfully');
        setDeleteDialog({ open: false, meeting: null });
      } else {
        toast.error('Failed to cancel meeting', {
          description: result.error
        });
      }
    } catch (error) {
      logger.error('Error cancelling meeting:', error);
      toast.error('An error occurred');
    } finally {
      setDeleting(false);
    }
  };

  // Handle delete meeting
  const handleDeleteMeeting = async () => {
    if (!deleteDialog.meeting) return;

    setDeleting(true);
    try {
      const result = await MeetingService.deleteMeeting(deleteDialog.meeting.id);
      
      if (result.success) {
        toast.success('Meeting deleted successfully');
        setDeleteDialog({ open: false, meeting: null });
      } else {
        toast.error('Failed to delete meeting', {
          description: result.error
        });
      }
    } catch (error) {
      logger.error('Error deleting meeting:', error);
      toast.error('An error occurred');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <Alert>
        <Calendar className="h-4 w-4" />
        <AlertDescription>
          No meetings scheduled for this phase yet. Use the form above to schedule your first meeting.
        </AlertDescription>
      </Alert>
    );
  }

  // Separate upcoming and past meetings
  const upcomingMeetings = meetings.filter(m => m.status === 'upcoming' && !hasPassed(m.scheduledDate));
  const pastMeetings = meetings.filter(m => m.status === 'completed' || m.status === 'cancelled' || hasPassed(m.scheduledDate));

  return (
    <>
      <div className="space-y-6">
        {/* Upcoming Meetings */}
        {upcomingMeetings.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Upcoming Meetings</h3>
            <div className="space-y-3">
              {upcomingMeetings.map(meeting => (
                <Card key={meeting.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        {/* Date/Time */}
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-blue-600" />
                          <Clock className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-sm">
                            {formatDateTime(meeting.scheduledDate)}
                          </span>
                          {meeting.duration && (
                            <span className="text-xs text-muted-foreground">
                              ({meeting.duration})
                            </span>
                          )}
                        </div>

                        {/* Meeting Type */}
                        <div className="flex items-center gap-2">
                          {meeting.meetingType === 'online' ? (
                            <>
                              <LinkIcon className="h-4 w-4 text-green-600" />
                              <Badge variant="outline" className="text-xs">Online</Badge>
                              {meeting.meetingLink && (
                                <Button
                                  size="sm"
                                  variant="link"
                                  className="h-auto p-0 text-xs"
                                  onClick={() => window.open(meeting.meetingLink, '_blank')}
                                >
                                  Open Link →
                                </Button>
                              )}
                            </>
                          ) : (
                            <>
                              <MapPin className="h-4 w-4 text-orange-600" />
                              <Badge variant="outline" className="text-xs">Offline</Badge>
                              {meeting.venue && (
                                <span className="text-sm text-muted-foreground">
                                  {meeting.venue}
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        {/* Teams Count */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{meeting.invitedTeams?.length || 0} team(s) invited</span>
                        </div>

                        {/* Agenda */}
                        {meeting.agenda && (
                          <p className="text-xs text-muted-foreground italic border-l-2 pl-2">
                            {meeting.agenda}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteDialog({ 
                            open: true, 
                            meeting, 
                            action: 'cancel' 
                          })}
                          title="Cancel meeting"
                        >
                          <XCircle className="h-4 w-4 text-amber-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteDialog({ 
                            open: true, 
                            meeting, 
                            action: 'delete' 
                          })}
                          title="Delete meeting"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Past Meetings */}
        {pastMeetings.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Past Meetings</h3>
            <div className="space-y-3">
              {pastMeetings.map(meeting => (
                <Card key={meeting.id} className="border-l-4 border-l-gray-300 opacity-70">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                          {meeting.status === 'cancelled' ? (
                            <Badge variant="destructive" className="text-xs">Cancelled</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Completed</Badge>
                          )}
                        </div>

                        {/* Date/Time */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <Clock className="h-4 w-4" />
                          <span>{formatDateTime(meeting.scheduledDate)}</span>
                        </div>

                        {/* Meeting Type */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {meeting.meetingType === 'online' ? (
                            <>
                              <LinkIcon className="h-4 w-4" />
                              <span>Online</span>
                            </>
                          ) : (
                            <>
                              <MapPin className="h-4 w-4" />
                              <span>{meeting.venue}</span>
                            </>
                          )}
                        </div>

                        {/* Teams Count */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{meeting.invitedTeams?.length || 0} team(s)</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cancel/Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteDialog.action === 'cancel' ? 'Cancel Meeting?' : 'Delete Meeting?'}
            </DialogTitle>
            <DialogDescription>
              {deleteDialog.action === 'cancel' 
                ? 'This will notify all invited teams that the meeting has been cancelled. You can reschedule later.'
                : 'This will permanently delete the meeting. This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>

          {deleteDialog.meeting && (
            <div className="py-4 space-y-2 text-sm">
              <p><strong>Date:</strong> {formatDateTime(deleteDialog.meeting.scheduledDate)}</p>
              <p><strong>Teams:</strong> {deleteDialog.meeting.invitedTeams?.length || 0} invited</p>
              <p><strong>Type:</strong> {deleteDialog.meeting.meetingType}</p>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialog({ open: false, meeting: null })}
              disabled={deleting}
            >
              Keep Meeting
            </Button>
            <Button 
              variant="destructive"
              onClick={deleteDialog.action === 'cancel' ? handleCancelMeeting : handleDeleteMeeting}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {deleteDialog.action === 'cancel' ? 'Cancelling...' : 'Deleting...'}
                </>
              ) : (
                deleteDialog.action === 'cancel' ? 'Cancel Meeting' : 'Delete Meeting'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useSession } from '@/context/SessionContext';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Link as LinkIcon, 
  Users, 
  X,
  ChevronDown,
  ChevronUp,
  Megaphone,
  Bell,
  AlertCircle
} from 'lucide-react';
import { format, isAfter, isBefore, addHours } from 'date-fns';

import { logger } from "../../lib/logger";
export default function MeetingAnnouncements({ userRole = 'student', teamId = null }) {
  const { user, userData } = useAuth();
  const { activeSession } = useSession();
  const [meetings, setMeetings] = useState([]);
  const [systemAnnouncements, setSystemAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  // Fetch meetings
  useEffect(() => {
    if (!user || !activeSession?.id) {
      setLoading(false);
      return;
    }

    let unsubscribe;

    try {
      if (userRole === 'student' && teamId) {
        // Students see meetings where their team is invited
        const q = query(
          collection(db, 'meetings'),
          where('invitedTeams', 'array-contains', teamId),
          where('status', '==', 'upcoming')
        );

        unsubscribe = onSnapshot(q, (snapshot) => {
          const meetingsList = snapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data(),
              scheduledDate: doc.data().scheduledDate?.toDate()
            }))
            .filter(meeting => {
              // Filter: Only show meetings that haven't passed yet
              const meetingDateTime = new Date(meeting.scheduledDate);
              const now = new Date();
              return isAfter(meetingDateTime, now);
            })
            .sort((a, b) => a.scheduledDate - b.scheduledDate);

          setMeetings(meetingsList);
          setLoading(false);
        }, (error) => {
          logger.warn('Unable to fetch meetings:', error.message);
          setLoading(false);
        });
      } else if (userRole === 'faculty') {
        // Faculty see all meetings in their phases (created by them + colleagues)
        // Get meetings created by this faculty
        const q = query(
          collection(db, 'meetings'),
          where('facultyId', '==', user.uid),
          where('status', '==', 'upcoming')
        );

        unsubscribe = onSnapshot(q, (snapshot) => {
          const meetingsList = snapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data(),
              scheduledDate: doc.data().scheduledDate?.toDate(),
              isMyMeeting: true
            }))
            .filter(meeting => {
              const meetingDateTime = new Date(meeting.scheduledDate);
              const now = new Date();
              return isAfter(meetingDateTime, now);
            })
            .sort((a, b) => a.scheduledDate - b.scheduledDate);

          setMeetings(meetingsList);
          setLoading(false);
        }, (error) => {
          logger.warn('Unable to fetch meetings:', error.message);
          setLoading(false);
        });
      } else {
        // For admin or other roles, just skip meetings fetch
        setLoading(false);
      }
    } catch (error) {
      logger.warn('Error setting up meetings listener:', error.message);
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, activeSession, userRole, teamId]);

  // Fetch system announcements
  useEffect(() => {
    if (!user || !userData?.email) return;

    let unsubscribe;

    try {
      const q = query(
        collection(db, 'notifications'),
        where('recipientEmail', '==', userData.email),
        where('type', '==', 'system_announcement'),
        where('read', '==', false),
        orderBy('createdAt', 'desc'),
        limit(10)
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        
        const announcements = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate()
          }))
          // Filter out announcements older than 7 days
          .filter(announcement => {
            if (!announcement.createdAt) return true; // Keep if no date
            return announcement.createdAt > sevenDaysAgo;
          });
        
        setSystemAnnouncements(announcements);
      }, (error) => {
        // Silently fail for permission errors - just don't show announcements
        logger.warn('Unable to fetch announcements:', error.message);
        setSystemAnnouncements([]);
      });
    } catch (error) {
      logger.warn('Error setting up announcements listener:', error.message);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, userData?.email]);

  // Don't show banner if no meetings and no system announcements
  if (loading || (meetings.length === 0 && systemAnnouncements.length === 0)) return null;

  // Format date/time for display
  const formatMeetingDateTime = (date) => {
    if (!date) return 'N/A';
    try {
      return format(new Date(date), 'MMM dd, yyyy • hh:mm a');
    } catch (e) {
      return 'Invalid date';
    }
  };

  // Get meeting status based on current time
  const getMeetingStatus = (meeting) => {
    const now = new Date();
    const startDateTime = meeting.scheduledDate instanceof Date 
      ? meeting.scheduledDate 
      : new Date(meeting.scheduledDate);
    
    // If meeting has endTime, use it for accurate status
    if (meeting.endTime) {
      const [hours, minutes] = meeting.endTime.split(':');
      const endDateTime = new Date(startDateTime);
      endDateTime.setHours(parseInt(hours), parseInt(minutes), 0);
      
      if (now > endDateTime) {
        return 'completed';
      }
      if (now >= startDateTime && now <= endDateTime) {
        return 'ongoing';
      }
      // Check if meeting starts within 24 hours
      const hoursDiff = (startDateTime - now) / (1000 * 60 * 60);
      if (hoursDiff > 0 && hoursDiff <= 24) {
        return 'soon';
      }
      return 'upcoming';
    }
    
    // Fallback for old meetings without endTime
    if (startDateTime < now) {
      return 'completed';
    }
    const hoursDiff = (startDateTime - now) / (1000 * 60 * 60);
    if (hoursDiff > 0 && hoursDiff <= 24) {
      return 'soon';
    }
    return 'upcoming';
  };

  // Check if meeting is within next 24 hours (for urgency highlighting)
  const isUrgent = (meetingDate) => {
    const now = new Date();
    const next24Hours = addHours(now, 24);
    return isBefore(new Date(meetingDate), next24Hours);
  };

  const totalItems = meetings.length + systemAnnouncements.length;

  return (
    <div className="mb-6">
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <div className="flex items-start gap-3">
          <Megaphone className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                  Announcements & Meetings
                </h3>
                <Badge variant="secondary" className="bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100">
                  {totalItems} {totalItems === 1 ? 'item' : 'items'}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="h-8"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Collapse
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Expand
                    </>
                  )}
                </Button>
              </div>
            </div>

            {expanded && (
              <div className="relative">
                <ScrollArea className="h-auto max-h-[400px] pr-4">
                  <div className="space-y-3">
                  {/* System Announcements */}
                  {systemAnnouncements.map(announcement => (
                    <div
                      key={announcement.id}
                      className="rounded-lg border border-amber-300 p-3 bg-amber-50 dark:bg-amber-950/20"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Bell className="h-4 w-4 text-amber-600" />
                            <h4 className="font-semibold text-sm text-amber-900">
                              {announcement.data?.title || 'System Announcement'}
                            </h4>
                            <Badge className="text-xs bg-amber-500 hover:bg-amber-600">
                              {announcement.data?.priority || 'Normal'}
                            </Badge>
                          </div>

                          <p className="text-sm text-amber-900">
                            {announcement.data?.message || announcement.message}
                          </p>

                          {announcement.createdAt && (
                            <div className="flex items-center gap-3">
                              <p className="text-xs text-amber-700">
                                <Clock className="h-3 w-3 inline mr-1" />
                                {format(announcement.createdAt, 'MMM dd, yyyy • hh:mm a')}
                              </p>
                              {(() => {
                                const now = new Date();
                                const hoursOld = Math.floor((now - announcement.createdAt) / (1000 * 60 * 60));
                                if (hoursOld < 1) return <Badge variant="outline" className="text-xs bg-green-100 text-green-800">New</Badge>;
                                if (hoursOld < 24) return <Badge variant="outline" className="text-xs">Today</Badge>;
                                const daysOld = Math.floor(hoursOld / 24);
                                if (daysOld < 7) return <Badge variant="outline" className="text-xs text-amber-700">{daysOld}d old</Badge>;
                                return null;
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Meetings */}
                  {meetings.map(meeting => (
                    <div
                      key={meeting.id}
                      className={`rounded-lg border p-3 bg-white dark:bg-gray-900 ${
                        isUrgent(meeting.scheduledDate)
                          ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/20'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          {/* Meeting Title */}
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm">
                              {meeting.phaseName}
                            </h4>
                            {(() => {
                              const status = getMeetingStatus(meeting);
                              if (status === 'ongoing') {
                                return (
                                  <Badge className="text-xs bg-green-500 hover:bg-green-600 animate-pulse">
                                    Ongoing
                                  </Badge>
                                );
                              }
                              if (status === 'soon') {
                                return (
                                  <Badge variant="destructive" className="text-xs">
                                    Soon!
                                  </Badge>
                                );
                              }
                              return null;
                            })()}
                            {userRole === 'faculty' && meeting.isMyMeeting && (
                              <Badge variant="outline" className="text-xs">
                                Your Meeting
                              </Badge>
                            )}
                          </div>

                          {/* Faculty Name (for students) */}
                          {userRole === 'student' && (
                            <p className="text-sm text-muted-foreground">
                              <Users className="h-3 w-3 inline mr-1" />
                              with {meeting.facultyName}
                            </p>
                          )}

                          {/* Date/Time */}
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                              <Calendar className="h-3.5 w-3.5" />
                              <Clock className="h-3.5 w-3.5" />
                              <span className="font-medium">
                                {formatMeetingDateTime(meeting.scheduledDate)}
                              </span>
                            </div>

                            {meeting.duration && (
                              <span className="text-muted-foreground">
                                ({meeting.duration})
                              </span>
                            )}
                          </div>

                          {/* Meeting Type & Link/Venue */}
                          <div className="flex items-center gap-2">
                            {meeting.meetingType === 'online' ? (
                              <div className="flex items-center gap-2">
                                <LinkIcon className="h-3.5 w-3.5 text-green-600" />
                                <Badge variant="outline" className="text-xs">
                                  Online
                                </Badge>
                                {meeting.meetingLink && (
                                  <Button
                                    size="sm"
                                    variant="link"
                                    className="h-auto p-0 text-xs"
                                    onClick={() => window.open(meeting.meetingLink, '_blank')}
                                  >
                                    Join Meeting →
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5 text-orange-600" />
                                <Badge variant="outline" className="text-xs">
                                  Offline
                                </Badge>
                                {meeting.venue && (
                                  <span className="text-sm text-muted-foreground">
                                    {meeting.venue}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Agenda (if present) */}
                          {meeting.agenda && (
                            <p className="text-xs text-muted-foreground italic border-l-2 pl-2">
                              {meeting.agenda}
                            </p>
                          )}

                          {/* Team Count (for faculty) */}
                          {userRole === 'faculty' && (
                            <p className="text-xs text-muted-foreground">
                              {meeting.invitedTeams.length} team(s) invited
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {totalItems > 2 && (
                <div className="absolute bottom-0 left-0 right-4 h-8 bg-gradient-to-t from-blue-50 dark:from-blue-950/20 to-transparent pointer-events-none" />
              )}
            </div>
            )}
          </div>
        </div>
      </Alert>
    </div>
  );
}

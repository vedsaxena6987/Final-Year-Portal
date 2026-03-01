"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, Clock, Video, MapPin, Users, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { format, isPast, isFuture } from 'date-fns';
import MeetingService from '@/services/meetingService';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';

import { logger } from "../../../lib/logger";
/**
 * MyMeetings Component - Student View
 * 
 * Displays all meetings where the student's team is invited.
 * - Real-time listener for team's meetings
 * - Groups meetings by phase
 * - Shows meeting details: faculty name, date/time, type, link/venue
 * - Join button for online meetings
 * - Status indicators (upcoming/completed)
 */
export default function MyMeetings({ teamId }) {
  const { userData } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [facultyData, setFacultyData] = useState({}); // Store both name and email

  // Fetch all meetings for the team in real-time
  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }

    const unsubscribe = MeetingService.subscribeToTeamMeetings(teamId, (teamMeetings) => {
      // Transform meeting data to match expected format
      const transformed = teamMeetings.map(meeting => ({
        ...meeting,
        date: meeting.scheduledDate ? format(meeting.scheduledDate, 'yyyy-MM-dd') : null,
        time: meeting.scheduledTime || null
      }));

      // Sort meetings by date/time (newest first)
      const sorted = transformed.sort((a, b) => {
        if (!a.date || !a.time || !b.date || !b.time) return 0;
        const dateA = new Date(`${a.date} ${a.time}`);
        const dateB = new Date(`${b.date} ${b.time}`);
        return dateB - dateA;
      });
      
      setMeetings(sorted);
      setLoading(false);

      // Fetch faculty data for all meetings
      fetchFacultyData(sorted);
    });

    return () => unsubscribe();
  }, [teamId]);

  // Fetch faculty names and emails
  const fetchFacultyData = async (meetingsList) => {
    const facultyEmails = [...new Set(meetingsList.map(m => m.facultyEmail).filter(Boolean))];
    const data = {};

    await Promise.all(
      facultyEmails.map(async (facultyEmail) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', facultyEmail));
          if (userDoc.exists()) {
            data[facultyEmail] = {
              name: userDoc.data().name || 'Unknown Faculty',
              email: facultyEmail
            };
          } else {
            data[facultyEmail] = {
              name: 'Unknown Faculty',
              email: facultyEmail
            };
          }
        } catch (error) {
          logger.error(`Error fetching faculty ${facultyEmail}:`, error);
          data[facultyEmail] = {
            name: 'Unknown Faculty',
            email: facultyEmail
          };
        }
      })
    );

    setFacultyData(data);
  };

  // Get meeting status based on current time
  const getMeetingStatus = (meeting) => {
    const now = new Date();
    const startDateTime = new Date(`${meeting.date} ${meeting.time}`);
    
    // If meeting has endTime, use it for accurate status
    if (meeting.endTime) {
      const endDateTime = new Date(`${meeting.date} ${meeting.endTime}`);
      
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
    if (isPast(startDateTime)) {
      return 'completed';
    }
    const hoursDiff = (startDateTime - now) / (1000 * 60 * 60);
    if (hoursDiff > 0 && hoursDiff <= 24) {
      return 'soon';
    }
    return 'upcoming';
  };

  // Check if meeting is in the past
  const isMeetingPast = (meeting) => {
    const status = getMeetingStatus(meeting);
    return status === 'completed';
  };

  // Check if meeting is upcoming
  const isMeetingUpcoming = (meeting) => {
    const status = getMeetingStatus(meeting);
    return status === 'upcoming' || status === 'soon' || status === 'ongoing';
  };



  // Group meetings by phase
  const groupedMeetings = meetings.reduce((acc, meeting) => {
    const phaseId = meeting.phaseId || 'unknown';
    if (!acc[phaseId]) {
      acc[phaseId] = [];
    }
    acc[phaseId].push(meeting);
    return acc;
  }, {});

  // Separate upcoming and past meetings
  const upcomingMeetings = meetings.filter(m => m.status === 'upcoming' && isMeetingUpcoming(m));
  const pastMeetings = meetings.filter(m => m.status === 'completed' || m.status === 'cancelled' || isMeetingPast(m));

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <Card className="border-gray-200">
        <CardContent className="p-8 text-center">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-gray-900 mb-2">No Meetings Scheduled</h3>
          <p className="text-xs text-gray-600">
            Your team has no scheduled meetings yet. Your faculty mentor or panel will schedule meetings during active phases.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upcoming Meetings Section */}
      {upcomingMeetings.length > 0 && (
        <Card className="border-teal-200 bg-teal-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-teal-600" />
              Upcoming Meetings
              <Badge className="bg-teal-600 hover:bg-teal-700 ml-auto">
                {upcomingMeetings.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-3 pr-4">
                {upcomingMeetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="p-4 bg-white border-l-4 border-l-teal-500 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                  >
                    {/* Meeting Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">
                          Meeting with{' '}
                          <button
                            onClick={() => {
                              const faculty = facultyData[meeting.facultyEmail];
                              if (faculty) {
                                toast.info(`Faculty Email: ${faculty.email}`, {
                                  description: 'Click to copy',
                                  action: {
                                    label: 'Copy',
                                    onClick: () => {
                                      navigator.clipboard.writeText(faculty.email);
                                      toast.success('Email copied to clipboard!');
                                    }
                                  }
                                });
                              }
                            }}
                            className="text-teal-600 hover:text-teal-700 hover:underline cursor-pointer"
                            title={`Click to view email: ${facultyData[meeting.facultyEmail]?.email || ''}`}
                          >
                            {facultyData[meeting.facultyEmail]?.name || meeting.facultyName || 'Faculty'}
                          </button>
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                            {meeting.phaseTitle || 'Phase Meeting'}
                          </Badge>
                        </div>
                      </div>
                      {(() => {
                        const status = getMeetingStatus(meeting);
                        if (status === 'ongoing') {
                          return (
                            <Badge className="bg-green-500 hover:bg-green-600 animate-pulse">
                              Ongoing
                            </Badge>
                          );
                        }
                        if (status === 'soon') {
                          return (
                            <Badge className="bg-amber-500 hover:bg-amber-600">
                              Soon
                            </Badge>
                          );
                        }
                        return (
                          <Badge className="bg-teal-500 hover:bg-teal-600">
                            Upcoming
                          </Badge>
                        );
                      })()}
                    </div>

                    {/* Meeting Details */}
                    <div className="space-y-2 mb-3">
                      {/* Date & Time */}
                      <div className="flex items-center gap-2 text-xs text-gray-700">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">
                          {meeting.date ? format(new Date(meeting.date), 'EEEE, MMMM d, yyyy') : 'Date not set'}
                        </span>
                        <Clock className="h-4 w-4 text-gray-500 ml-2" />
                        <span className="font-medium">{meeting.time || 'Time not set'}</span>
                        {meeting.duration && (
                          <span className="text-gray-500">({meeting.duration})</span>
                        )}
                      </div>

                      {/* Type & Location */}
                      <div className="flex items-center gap-2 text-xs text-gray-700">
                        {meeting.meetingType === 'online' ? (
                          <>
                            <Video className="h-4 w-4 text-blue-500" />
                            <span className="font-medium text-blue-700">Online Meeting</span>
                          </>
                        ) : meeting.meetingType === 'offline' ? (
                          <>
                            <MapPin className="h-4 w-4 text-green-500" />
                            <span className="font-medium text-green-700">In-Person Meeting</span>
                          </>
                        ) : (
                          <>
                            <Users className="h-4 w-4 text-purple-500" />
                            <span className="font-medium text-purple-700">Hybrid Meeting</span>
                          </>
                        )}
                      </div>

                      {/* Venue or Link */}
                      {meeting.meetingType === 'offline' && meeting.venue && (
                        <div className="flex items-start gap-2 text-xs text-gray-700 bg-gray-50 p-2 rounded">
                          <MapPin className="h-4 w-4 text-gray-500 shrink-0 mt-0.5" />
                          <span>{meeting.venue}</span>
                        </div>
                      )}

                      {/* Agenda */}
                      {meeting.agenda && (
                        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                          <span className="font-medium text-gray-700">Agenda: </span>
                          {meeting.agenda}
                        </div>
                      )}

                      {/* Team Names */}
                      {meeting.teamNames && meeting.teamNames.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Users className="h-4 w-4 text-gray-500" />
                          <span>
                            {meeting.teamNames.length === 1 ? '1 team' : `${meeting.teamNames.length} teams`} invited
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {meeting.meetingType === 'online' && meeting.meetingLink && (
                      <Button
                        onClick={() => {
                          if (meeting.meetingLink) {
                            window.open(meeting.meetingLink, '_blank', 'noopener,noreferrer');
                            toast.success('Opening meeting link...');
                          } else {
                            toast.error('No meeting link available');
                          }
                        }}
                        className="w-full bg-teal-600 hover:bg-teal-700 h-9 text-xs"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Join Meeting
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Past Meetings Section */}
      {pastMeetings.length > 0 && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-gray-600" />
              Past Meetings
              <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300 ml-auto">
                {pastMeetings.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3 pr-4">
                {pastMeetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="p-4 bg-gray-50 border-l-4 border-l-gray-400 rounded-lg opacity-70"
                  >
                    {/* Meeting Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">
                          Meeting with{' '}
                          <button
                            onClick={() => {
                              const faculty = facultyData[meeting.facultyEmail];
                              if (faculty) {
                                toast.info(`Faculty Email: ${faculty.email}`, {
                                  description: 'Click to copy',
                                  action: {
                                    label: 'Copy',
                                    onClick: () => {
                                      navigator.clipboard.writeText(faculty.email);
                                      toast.success('Email copied to clipboard!');
                                    }
                                  }
                                });
                              }
                            }}
                            className="text-teal-600 hover:text-teal-700 hover:underline cursor-pointer"
                            title={`Click to view email: ${facultyData[meeting.facultyEmail]?.email || ''}`}
                          >
                            {facultyData[meeting.facultyEmail]?.name || meeting.facultyName || 'Faculty'}
                          </button>
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300">
                            {meeting.phaseTitle || 'Phase Meeting'}
                          </Badge>
                        </div>
                      </div>
                      {meeting.status === 'cancelled' ? (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                          <XCircle className="h-3 w-3 mr-1" />
                          Cancelled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                      )}
                    </div>

                    {/* Meeting Details */}
                    <div className="space-y-2">
                      {/* Date & Time */}
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span>{meeting.date ? format(new Date(meeting.date), 'MMM d, yyyy') : 'Date not set'}</span>
                        <Clock className="h-4 w-4 text-gray-500 ml-2" />
                        <span>{meeting.time || 'Time not set'}</span>
                      </div>

                      {/* Type */}
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        {meeting.meetingType === 'online' ? (
                          <>
                            <Video className="h-4 w-4 text-gray-500" />
                            <span>Online Meeting</span>
                          </>
                        ) : (
                          <>
                            <MapPin className="h-4 w-4 text-gray-500" />
                            <span>In-Person Meeting</span>
                            {meeting.venue && <span className="text-gray-500">• {meeting.venue}</span>}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

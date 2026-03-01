"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, onSnapshot, orderBy } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useSession } from '@/context/SessionContext';
import MeetingService from '@/services/meetingService';
import { Calendar, Clock, Users, MapPin, Link as LinkIcon, AlertTriangle, Loader2 } from 'lucide-react';

import { logger } from "../../../lib/logger";
export default function ScheduleMeeting({ phase }) {
  const { user, userData } = useAuth();
  const { activeSession } = useSession();
  const [teams, setTeams] = useState([]);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictingMeetings, setConflictingMeetings] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    meetingType: phase?.meetingMode === 'both' ? 'online' : phase?.meetingMode || 'online',
    meetingLink: '',
    venue: '',
    scheduledDate: '',
    scheduledTime: '',
    endTime: '',
    agenda: ''
  });

  // Fetch teams based on phase type
  useEffect(() => {
    if (!phase || !userData || !activeSession?.id) return;

    const fetchTeams = async () => {
      try {
        setLoading(true);
        let teamsQuery;


        if (phase.phaseType === 'mentor') {
          // For mentor phases: show only mentored teams
          teamsQuery = query(
            collection(db, 'teams'),
            where('sessionId', '==', activeSession.id),
            where('mentorEmail', '==', user.email)
          );
        } else {
          // For panel phases: show teams in faculty's panel
          // First, get the panel this faculty is part of
          const panelsQuery = query(
            collection(db, 'panels'),
            where('sessionId', '==', activeSession.id)
          );
          
          const panelsSnapshot = await getDocs(panelsQuery);
          
          let facultyPanel = null;

          panelsSnapshot.forEach(docSnap => {
            const panel = docSnap.data();
            panel.facultyMembers?.forEach(f => {
            });
            
            // Check both UID and email for data consistency (some panels store email as uid)
            if (panel.facultyMembers?.some(f => 
              f.uid === user.uid || 
              f.uid === userData.email || 
              f.email === userData.email
            )) {
              facultyPanel = { id: docSnap.id, ...panel };
            }
          });

          if (!facultyPanel) {
            setTeams([]);
            setLoading(false);
            return;
          }

          // Get teams assigned to this panel
          teamsQuery = query(
            collection(db, 'teams'),
            where('sessionId', '==', activeSession.id),
            where('panelId', '==', facultyPanel.id)
          );
        }

        const teamsSnapshot = await getDocs(teamsQuery);
        
        const teamsList = teamsSnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data
          };
        });

        setTeams(teamsList);
      } catch (error) {
        logger.error('Error fetching teams:', error);
        toast.error('Failed to load teams');
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, [phase, userData, user, activeSession]);

  // Handle team selection
  const toggleTeamSelection = (teamId) => {
    setSelectedTeams(prev => 
      prev.includes(teamId)
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  // Select all teams
  const selectAllTeams = () => {
    setSelectedTeams(teams.map(t => t.id));
  };

  // Deselect all teams
  const deselectAllTeams = () => {
    setSelectedTeams([]);
  };

  // Validate form
  const validateForm = () => {
    if (selectedTeams.length === 0) {
      toast.error('Please select at least one team');
      return false;
    }

    if (!formData.scheduledDate || !formData.scheduledTime) {
      toast.error('Please select date and time');
      return false;
    }

    // Check if date is in the past
    const selectedDateTime = new Date(`${formData.scheduledDate}T${formData.scheduledTime}`);
    const now = new Date();
    
    if (selectedDateTime < now) {
      toast.error('Cannot schedule meeting in the past');
      return false;
    }

    // Validate based on meeting type
    if (formData.meetingType === 'online' && !formData.meetingLink) {
      toast.error('Meeting link is required for online meetings');
      return false;
    }

    if (formData.meetingType === 'offline' && !formData.venue) {
      toast.error('Venue is required for offline meetings');
      return false;
    }

    return true;
  };

  // Check for time conflicts
  const checkConflicts = async () => {
    try {
      const result = await MeetingService.checkTimeConflicts(
        user.uid,
        new Date(formData.scheduledDate),
        formData.scheduledTime
      );

      if (result.hasConflict) {
        setConflictingMeetings(result.conflictingMeetings);
        setShowConflictDialog(true);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error checking conflicts:', error);
      return false;
    }
  };

  // Submit meeting
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    // Check for conflicts
    const hasConflict = await checkConflicts();
    if (hasConflict) return; // Show conflict dialog, user must confirm

    await submitMeeting();
  };

  // Submit meeting (called after conflict resolution)
  const submitMeeting = async () => {
    setSubmitting(true);

    try {
      const meetingData = {
        phaseId: phase.id,
        phaseName: phase.phaseName,
        phaseType: phase.phaseType,
        facultyId: user.uid,
        facultyName: userData.name,
        facultyEmail: userData.email,
        invitedTeams: selectedTeams,
        meetingType: formData.meetingType,
        meetingLink: formData.meetingLink,
        venue: formData.venue,
        scheduledDate: new Date(`${formData.scheduledDate}T${formData.scheduledTime}`),
        scheduledTime: formData.scheduledTime,
        endTime: formData.endTime,
        agenda: formData.agenda
      };

      const result = await MeetingService.createMeeting(meetingData);

      if (result.success) {
        toast.success('Meeting scheduled successfully!', {
          description: `${selectedTeams.length} team(s) will be notified via email`
        });
        
        // Reset form
        setFormData({
          meetingType: phase?.meetingMode === 'both' ? 'online' : phase?.meetingMode || 'online',
          meetingLink: '',
          venue: '',
          scheduledDate: '',
          scheduledTime: '',
          endTime: '',
          agenda: ''
        });
        setSelectedTeams([]);
      } else {
        toast.error('Failed to schedule meeting', {
          description: result.error
        });
      }
    } catch (error) {
      logger.error('Error scheduling meeting:', error);
      toast.error('An error occurred while scheduling the meeting');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm scheduling despite conflicts
  const confirmScheduleWithConflict = () => {
    setShowConflictDialog(false);
    submitMeeting();
  };

  if (!phase) {
    return (
      <Alert>
        <AlertDescription>Please select a phase to schedule meetings</AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Schedule Meeting - {phase.phaseName}</CardTitle>
          <CardDescription>
            {phase.phaseType === 'mentor' 
              ? 'Select mentored teams to call for meeting'
              : `Select teams from your panel to call for meeting`}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Team Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  Select Teams <span className="text-destructive">*</span>
                </Label>
                <div className="space-x-2">
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="outline"
                    onClick={selectAllTeams}
                    disabled={loading || teams.length === 0}
                  >
                    Select All
                  </Button>
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="outline"
                    onClick={deselectAllTeams}
                    disabled={selectedTeams.length === 0}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : teams.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    {phase.phaseType === 'mentor'
                      ? 'No mentored teams found for this session'
                      : 'No teams assigned to your panel for this session'}
                  </AlertDescription>
                </Alert>
              ) : (
                <ScrollArea className="h-48 border rounded-md p-4">
                  <div className="space-y-2">
                    {teams.map(team => (
                      <div key={team.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`team-${team.id}`}
                          checked={selectedTeams.includes(team.id)}
                          onCheckedChange={() => toggleTeamSelection(team.id)}
                        />
                        <Label
                          htmlFor={`team-${team.id}`}
                          className="flex-1 cursor-pointer hover:text-primary"
                        >
                          <span className="font-medium">Project #{team.projectNumber}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            ({team.members?.length || 0} members)
                          </span>
                        </Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {selectedTeams.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedTeams.length} team(s) selected
                </p>
              )}
            </div>

            {/* Meeting Type */}
            {phase.meetingMode === 'both' && (
              <div className="space-y-2">
                <Label htmlFor="meetingType">
                  Meeting Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.meetingType}
                  onValueChange={(value) => setFormData({ ...formData, meetingType: value })}
                >
                  <SelectTrigger id="meetingType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="h-4 w-4" />
                        Online Meeting
                      </div>
                    </SelectItem>
                    <SelectItem value="offline">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Offline Meeting
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Meeting Link (Online) */}
            {(formData.meetingType === 'online' || phase.meetingMode === 'online') && (
              <div className="space-y-2">
                <Label htmlFor="meetingLink">
                  Meeting Link <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="meetingLink"
                  type="url"
                  placeholder="https://teams.microsoft.com/... or Zoom/Google Meet link"
                  value={formData.meetingLink}
                  onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  MS Teams, Zoom, or Google Meet link
                </p>
              </div>
            )}

            {/* Venue (Offline) */}
            {(formData.meetingType === 'offline' || phase.meetingMode === 'offline') && (
              <div className="space-y-2">
                <Label htmlFor="venue">
                  Venue <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="venue"
                  placeholder="e.g., Room 301, Block A"
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Physical location for the meeting
                </p>
              </div>
            )}

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scheduledDate">
                  Meeting Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="scheduledDate"
                  type="date"
                  value={formData.scheduledDate}
                  onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduledTime">
                  Meeting Time <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="scheduledTime"
                  type="time"
                  value={formData.scheduledTime}
                  onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* End Time */}
            <div className="space-y-2">
              <Label htmlFor="endTime">
                End Time <span className="text-destructive">*</span>
              </Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                Meeting end time (must be after start time)
              </p>
            </div>

            {/* Agenda (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="agenda">Agenda (Optional)</Label>
              <Textarea
                id="agenda"
                placeholder="Meeting purpose, topics to discuss, preparation required..."
                value={formData.agenda}
                onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
                rows={3}
                className="max-h-28 md:max-h-32 resize-y"
              />
              <p className="text-xs text-muted-foreground">
                Help students prepare for the meeting
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFormData({
                    meetingType: phase?.meetingMode === 'both' ? 'online' : phase?.meetingMode || 'online',
                    meetingLink: '',
                    venue: '',
                    scheduledDate: '',
                    scheduledTime: '',
                    endTime: '',
                    agenda: ''
                  });
                  setSelectedTeams([]);
                }}
                disabled={submitting}
              >
                Reset
              </Button>
              <Button type="submit" disabled={submitting || teams.length === 0}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule Meeting
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Conflict Warning Dialog */}
      <Dialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Time Conflict Detected
            </DialogTitle>
            <DialogDescription>
              You have other meetings scheduled around this time. Do you want to continue?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {conflictingMeetings.map(meeting => (
              <Alert key={meeting.id}>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  <strong>{meeting.phaseName}</strong>
                  <br />
                  {new Date(meeting.scheduledDate).toLocaleDateString()} at {meeting.scheduledTime}
                  <br />
                  {meeting.invitedTeams.length} team(s) invited
                </AlertDescription>
              </Alert>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConflictDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmScheduleWithConflict} disabled={submitting}>
              Schedule Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

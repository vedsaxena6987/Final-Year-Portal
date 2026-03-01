"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SubmissionService } from "@/services/submissionService";
import PanelService from "@/services/panelService";
import PanelEvaluationService from "@/services/panelEvaluationService";
import MeetingService from "@/services/meetingService";
import { useAuth } from "@/context/AuthContext";
import { Calendar, Clock, MapPin, Users, User, Eye, CheckCircle, AlertCircle, UserX } from "lucide-react";
import { format, isAfter } from "date-fns";
import StudentPanelEvaluationDetails from "./StudentPanelEvaluationDetails";

import { logger } from "../../../lib/logger";
/**
 * PanelDetailsCard
 * Shows assigned panel members, upcoming panel meetings, and evaluation progress per panel phase.
 */
export default function PanelDetailsCard({ team, teamId, phases }) {
  const { userData } = useAuth();
  const [panelDetails, setPanelDetails] = useState(null);
  const [panelMeetings, setPanelMeetings] = useState([]);
  const [phaseProgress, setPhaseProgress] = useState([]);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  const panelPhases = useMemo(() => {
    return (phases || []).filter((phase) => phase.phaseType === "panel");
  }, [phases]);

  // Load panel metadata
  useEffect(() => {
    const fetchPanelDetails = async () => {
      if (!team?.panelId) {
        setPanelDetails(null);
        return;
      }

      const details = await PanelService.getPanelDetails(team.panelId);
      setPanelDetails(details);
    };

    fetchPanelDetails();
  }, [team?.panelId]);

  // Subscribe to team meetings and filter panel ones
  useEffect(() => {
    if (!teamId) {
      setPanelMeetings([]);
      return undefined;
    }

    const unsubscribe = MeetingService.subscribeToTeamMeetings(teamId, (meetings) => {
      const panelOnly = meetings.filter((meeting) => meeting.phaseType === "panel");
      setPanelMeetings(panelOnly);
    });

    return () => unsubscribe && unsubscribe();
  }, [teamId]);

  // Fetch submission progress for panel phases
  useEffect(() => {
    const fetchProgress = async () => {
      if (!teamId || panelPhases.length === 0) {
        setPhaseProgress([]);
        setLoadingProgress(false);
        return;
      }

      setLoadingProgress(true);
      try {
        const results = await Promise.all(
          panelPhases.map(async (phase) => {
            const submission = await SubmissionService.getSubmission(teamId, phase.id);
            return {
              phaseId: phase.id,
              phaseName: phase.phaseName || phase.name,
              minPanelists: phase.minPanelistsMeetRequired || 1,
              maxMarks: phase.maxMarks,
              status: submission?.evaluationStatus || submission?.status || null,
              progress: submission?.panelEvaluationProgress || null,
              summary: submission?.panelEvaluationSummary || null,
              hasSubmission: Boolean(submission)
            };
          })
        );
        setPhaseProgress(results);
      } catch (error) {
        logger.error("Error loading panel evaluation progress", error);
        setPhaseProgress([]);
      } finally {
        setLoadingProgress(false);
      }
    };

    fetchProgress();
  }, [teamId, panelPhases]);

  const nextPanelMeeting = useMemo(() => {
    if (panelMeetings.length === 0) return null;
    const upcoming = panelMeetings
      .filter((meeting) => meeting.status === "upcoming" && meeting.scheduledDate && isAfter(meeting.scheduledDate, new Date()))
      .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
    return upcoming[0] || null;
  }, [panelMeetings]);

  if (!team?.panelId || panelPhases.length === 0) {
    return null;
  }

  const getStatusBadge = (status, progress) => {
    if (!status && !progress) {
      return { label: "Awaiting Submission", className: "bg-gray-200 text-gray-700" };
    }

    if (status === "evaluated") {
      return { label: "Evaluated", className: "bg-green-100 text-green-700 border-green-200" };
    }

    if (status === "awaiting_panelists") {
      return {
        label: progress?.statusLabel || "Awaiting Panelists",
        className: "bg-amber-100 text-amber-700 border-amber-200"
      };
    }

    return { label: "Submitted", className: "bg-blue-100 text-blue-700 border-blue-200" };
  };

  return (
    <Card className="border-purple-200 bg-purple-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-purple-900 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Panel Overview
          {panelDetails?.panelNumber && (
            <Badge variant="outline" className="ml-2 bg-white text-purple-700 border-purple-200">
              Panel #{panelDetails.panelNumber}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Panel Members */}
        <div className="p-3 bg-white rounded-lg border border-purple-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-900">Assigned Panel Members</p>
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
              {panelDetails?.facultyMembers?.length || 0} members
            </Badge>
          </div>
          {panelDetails?.facultyMembers?.length ? (
            <ScrollArea className="max-h-32 pr-2">
              <div className="space-y-2">
                {panelDetails.facultyMembers.map((member) => (
                  <div
                    key={member.uid}
                    className="flex items-center gap-3 p-2 rounded-md border border-gray-100"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">
                        {member.name?.split(" ").map((n) => n[0]).slice(0, 2).join("") || "PN"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
                      <p className="text-xs text-gray-500 truncate">{member.email}</p>
                    </div>
                    {member.expertise?.length > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-gray-50 text-gray-600 border-gray-200">
                        {member.expertise[0]}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-xs text-gray-500">Panel members will appear here once assigned.</p>
          )}
        </div>

        {/* Next Panel Meeting */}
        <div className="p-3 bg-white rounded-lg border border-purple-100">
          <p className="text-sm font-semibold text-gray-900 mb-2">Next Panel Meeting</p>
          {nextPanelMeeting ? (
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span>{format(nextPanelMeeting.scheduledDate, "MMM dd, yyyy")}</span>
                <Clock className="h-4 w-4 text-gray-500 ml-2" />
                <span>{nextPanelMeeting.scheduledTime}</span>
              </div>
              <div className="flex items-center gap-2">
                {nextPanelMeeting.meetingType === "online" ? (
                  <>
                    <User className="h-4 w-4 text-blue-500" />
                    <span className="text-blue-600">Online</span>
                  </>
                ) : (
                  <>
                    <MapPin className="h-4 w-4 text-green-500" />
                    <span className="text-green-600">{nextPanelMeeting.venue || "Campus"}</span>
                  </>
                )}
              </div>
              {nextPanelMeeting.agenda && (
                <p className="bg-gray-50 p-2 rounded text-gray-700">
                  <span className="font-semibold">Agenda:</span> {nextPanelMeeting.agenda}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500">No upcoming panel meetings yet.</p>
          )}
        </div>

        <Separator />

        {/* Phase progress */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-900">Panel Evaluation Progress</p>
          {loadingProgress ? (
            <p className="text-xs text-gray-500">Loading panel phases…</p>
          ) : phaseProgress.length === 0 ? (
            <p className="text-xs text-gray-500">No panel evaluations configured.</p>
          ) : (
            <div className="space-y-2">
              {phaseProgress.map((entry) => {
                const status = getStatusBadge(entry.status, entry.progress);
                const phaseData = panelPhases.find(p => p.id === entry.phaseId);
                return (
                  <div key={entry.phaseId} className="p-3 bg-white rounded-lg border border-gray-100">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{entry.phaseName}</p>
                        <p className="text-[11px] text-gray-500">
                          Minimum {entry.minPanelists} panelist{entry.minPanelists === 1 ? "" : "s"} required
                        </p>
                      </div>
                      <Badge variant="outline" className={`${status.className} text-[10px]`}>
                        {status.label}
                      </Badge>
                    </div>
                    {entry.progress && (
                      <p className="text-xs text-gray-600 mt-2">
                        Completed {entry.progress.completedCount}/{entry.progress.requiredCount}
                        {entry.progress.totalPanelists ? ` • ${entry.progress.totalPanelists} assigned` : ""}
                      </p>
                    )}
                    {entry.summary?.absentStudents?.length > 0 && (
                      <p className="text-xs text-red-600 mt-1">
                        Marked absent: {entry.summary.absentStudents.map((s) => s.studentName || s.studentEmail).join(", ")}
                      </p>
                    )}
                    {!entry.hasSubmission && (
                      <p className="text-[11px] text-gray-500 mt-2">Waiting for team submission.</p>
                    )}
                    {/* View Details Button */}
                    {entry.hasSubmission && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full text-xs gap-1"
                        onClick={() => {
                          setSelectedPhase({ ...entry, ...phaseData });
                          setDetailsModalOpen(true);
                        }}
                      >
                        <Eye className="h-3 w-3" />
                        View Panelist Evaluations
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>

      {/* Panel Evaluation Details Modal */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              {selectedPhase?.phaseName || 'Panel Evaluation'} - Your Progress
            </DialogTitle>
          </DialogHeader>
          
          {selectedPhase && (
            <StudentPanelEvaluationDetails
              teamId={teamId}
              phaseId={selectedPhase.phaseId}
              panelId={team?.panelId}
              phase={selectedPhase}
              studentEmail={userData?.email}
              showMarks={selectedPhase?.marksVisible !== false}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

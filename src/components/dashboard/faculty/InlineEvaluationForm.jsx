"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Lock,
  Award,
  Save,
  AlertCircle,
  CheckCircle,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { isBefore, isAfter } from "date-fns";
import PanelEvaluationService from "@/services/panelEvaluationService";
import PanelEvaluationProgress from "./PanelEvaluationProgress";
import MeetingRequirementBadge from "../shared/MeetingRequirementBadge";
import { usePhaseEligibility } from "@/hooks/useMeetingStats";

import { logger } from "../../../lib/logger";
export default function InlineEvaluationForm({
  open,
  onOpenChange,
  team,
  phase,
  onSuccess,
}) {
  const { userData } = useAuth();
  const [members, setMembers] = useState([]);
  const [marks, setMarks] = useState({});
  const [attendance, setAttendance] = useState({}); // <-- ADD THIS
  const [memberFeedbacks, setMemberFeedbacks] = useState({}); // <-- ADD THIS
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingEvaluation, setExistingEvaluation] = useState(null);
  const [isPhaseActive, setIsPhaseActive] = useState(true);
  const [isPanelPhase, setIsPanelPhase] = useState(false);
  const [panelEvaluationStatus, setPanelEvaluationStatus] = useState(null);

  // Check meeting requirements for panel phases
  const { eligibility: meetingEligibility, loading: checkingEligibility } =
    usePhaseEligibility(team?.id, phase);

  // Check if phase is active and if it's a panel phase
  useEffect(() => {
    if (phase?.startDate && phase?.endDate) {
      const now = new Date();
      const start = phase.startDate.toDate();
      const end = phase.endDate.toDate();
      setIsPhaseActive(isAfter(now, start) && isBefore(now, end));
    }

    // Check if this is a panel phase
    if (phase?.phaseType === "panel") {
      setIsPanelPhase(true);
    }
  }, [phase]);

  // Fetch team members and existing evaluation
  useEffect(() => {
    const fetchData = async () => {
      if (!team?.members || !phase?.id) {
        if (!team?.members) {
          toast.error("Invalid team data - no members found");
        }
        setLoading(false);
        return;
      }

      // Check if members array is empty
      if (team.members.length === 0) {
        toast.error("This team has no members to evaluate");
        setLoading(false);
        return;
      }

      try {
        // Fetch member details
        const memberPromises = team.members.map(async (email) => {
          const userRef = doc(db, "users", email);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            return { email, ...userSnap.data() };
          }
          return { email, name: "Unknown User" };
        });

        const membersData = await Promise.all(memberPromises);
        setMembers(membersData);

        // Check evaluation based on phase type
        if (isPanelPhase) {
          // Panel phase - check if current faculty has evaluated
          const panelEval = await PanelEvaluationService.checkFacultyEvaluation(
            team.id,
            phase.id,
            userData.uid
          );

          setPanelEvaluationStatus(panelEval);

          if (panelEval.hasEvaluated) {
            setExistingEvaluation(panelEval.evaluation);

            // Pre-fill marks
            const marksMap = {};
            panelEval.evaluation.marks?.forEach((mark) => {
              marksMap[mark.studentEmail] = mark.marks;
            });
            setMarks(marksMap);
            setFeedback(panelEval.evaluation.feedback || "");
          } else {
            // Initialize empty marks
            // ... inside else {
            // Initialize empty marks, attendance, and feedback
            const marksMap = {};
            const attendanceMap = {};
            const feedbackMap = {};
            membersData.forEach((member) => {
              marksMap[member.email] = "";
              attendanceMap[member.email] = true; // Default to 'present'
              feedbackMap[member.email] = "";
            });
            setMarks(marksMap);
            setAttendance(attendanceMap); // <-- ADD THIS
            setMemberFeedbacks(feedbackMap); // <-- ADD THIS
          }
        } else {
          // Mentor phase - use existing logic
          if (team.evaluation) {
            setExistingEvaluation(team.evaluation);

            // Pre-fill marks
            // Pre-fill marks, attendance, and feedback
            const marksMap = {};
            const attendanceMap = {};
            const feedbackMap = {};
            team.evaluation.marks?.forEach((mark) => {
              marksMap[mark.studentEmail] = mark.marks;
              // Use '?? true' to default to present if data is missing from old evaluations
              attendanceMap[mark.studentEmail] = mark.isPresent ?? true;
              feedbackMap[mark.studentEmail] = mark.feedback || "";
            });
            setMarks(marksMap);
            setAttendance(attendanceMap); // <-- ADD THIS
            setMemberFeedbacks(feedbackMap); // <-- ADD THIS
            setFeedback(team.evaluation.feedback || "");
          } else {
            // Initialize empty marks
            const marksMap = {};
            membersData.forEach((member) => {
              marksMap[member.email] = "";
            });
            setMarks(marksMap);
          }
        }
      } catch (error) {
        logger.error("Error fetching data:", error);
        toast.error("Failed to load evaluation data");
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchData();
    }
  }, [open, team, phase, userData.uid, isPanelPhase]);

  // Handle mark change
  const handleMarkChange = (email, value) => {
    const numValue = value === "" ? "" : parseFloat(value);

    // Validate against max marks
    if (numValue !== "" && (numValue < 0 || numValue > phase.maxMarks)) {
      toast.error(`Marks must be between 0 and ${phase.maxMarks}`);
      return;
    }

    setMarks((prev) => ({
      ...prev,
      [email]: numValue,
    }));
  };
  const handleAttendanceChange = (email, isChecked) => {
    setAttendance((prev) => ({
      ...prev,
      [email]: isChecked,
    }));
  };

  const handleMemberFeedbackChange = (email, value) => {
    setMemberFeedbacks((prev) => ({
      ...prev,
      [email]: value,
    }));
  };
  // Validate form
  const validateForm = () => {
    // Check if all members have marks
    for (const member of members) {
      if (marks[member.email] === "" || marks[member.email] === undefined) {
        toast.error(`Please enter marks for ${member.name}`);
        return false;
      }
    }

    // Check if feedback is provided
    if (!feedback.trim()) {
      toast.error("Please provide feedback");
      return false;
    }

    return true;
  };

  // Handle save (with draft capability)
  const handleSave = async (isDraft = false) => {
    if (!isDraft && !validateForm()) {
      return;
    }

    // Check meeting requirements for panel phases
    if (!isDraft && isPanelPhase && phase.minPanelistsMeetRequired) {
      if (checkingEligibility) {
        toast.error("Still checking meeting requirements...");
        return;
      }

      if (meetingEligibility && !meetingEligibility.eligible) {
        toast.error(
          `Meeting requirements not met: ${meetingEligibility.reason}`,
          {
            description: `Team must meet ${meetingEligibility.remaining} more panelist(s)`,
          }
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      // Prepare marks array
      const marksArray = members.map((member) => ({
        studentEmail: member.email,
        studentName: member.name,
        marks: (attendance[member.email] ? marks[member.email] : 0) || 0, // Give 0 if not present
        isPresent: attendance[member.email] || false,
        feedback: memberFeedbacks[member.email] || "",
      }));

      if (isPanelPhase) {
        // Panel Phase Evaluation
        const evaluationData = {
          teamId: team.id,
          phaseId: phase.id,
          phaseName: phase.name,
          evaluatorId: userData.uid,
          maxMarks: phase.maxMarks,
          marks: marksArray,
          feedback: feedback.trim(),
          sessionId: team.sessionId,
        };

        const result = await PanelEvaluationService.submitPanelEvaluation(
          evaluationData,
          panelEvaluationStatus?.evaluationId || null
        );

        if (result.success) {
          toast.success(
            panelEvaluationStatus?.hasEvaluated
              ? "Evaluation updated successfully"
              : "Evaluation submitted successfully"
          );

          if (onSuccess) {
            onSuccess();
          }
        } else {
          toast.error("Failed to save evaluation");
        }
      } else {
        // Mentor Phase Evaluation (existing logic)
        const evaluationData = {
          teamId: team.id,
          phaseId: phase.id,
          phaseName: phase.name,
          maxMarks: phase.maxMarks,
          marks: marksArray,
          feedback: feedback.trim(),
          evaluatedBy: userData.uid,
          evaluatedAt: serverTimestamp(),
          isDraft,
          sessionId: team.sessionId,
        };

        if (existingEvaluation) {
          // Update existing evaluation
          const evalRef = doc(db, "evaluations", existingEvaluation.id);
          await updateDoc(evalRef, {
            ...evaluationData,
            updatedAt: serverTimestamp(),
          });
          toast.success(
            isDraft ? "Draft saved" : "Evaluation updated successfully"
          );
        } else {
          // Create new evaluation
          await addDoc(collection(db, "evaluations"), evaluationData);
          toast.success(
            isDraft ? "Draft saved" : "Evaluation submitted successfully"
          );
        }

        // Update submission status if exists
          if (team.submission?.id) {
            const submissionRef = doc(db, "submissions", team.submission.id);
            await updateDoc(submissionRef, {
              status: "evaluated",
              evaluationStatus: "evaluated",
              evaluatedAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }

        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error) {
      logger.error("Error saving evaluation:", error);
      toast.error("Failed to save evaluation");
    } finally {
      setSubmitting(false);
    }
  };

  // Get initials for avatar
  const getInitials = (name) => {
    if (!name) return "??";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Calculate total and average
  const calculateStats = () => {
    const filledMarks = Object.values(marks).filter((m) => m !== "");
    if (filledMarks.length === 0)
      return { total: 0, average: 0, percentage: 0 };

    const total = filledMarks.reduce((sum, m) => sum + parseFloat(m), 0);
    const average = total / filledMarks.length;
    const percentage = (average / phase.maxMarks) * 100;

    return { total, average, percentage };
  };

  const stats = calculateStats();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Evaluate Team - {phase?.name}
          </DialogTitle>
          <DialogDescription>
            Enter marks for each team member and provide feedback
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading evaluation form...
          </div>
        ) : (
          <div className="space-y-6">
            {/* Panel Evaluation Progress (Panel Phases Only) */}
            {isPanelPhase && team.panelId && (
              <PanelEvaluationProgress
                teamId={team.id}
                phaseId={phase.id}
                panelId={team.panelId}
                phase={phase}
              />
            )}

            {/* Meeting Requirements Check (Panel Phases Only) */}
            {isPanelPhase && phase.minPanelistsMeetRequired && (
              <MeetingRequirementBadge
                teamId={team.id}
                phase={phase}
                variant="alert"
              />
            )}

            {/* Phase Type Badge */}
            {isPanelPhase && (
              <Alert className="border-purple-200 bg-purple-50">
                <Users className="h-4 w-4 text-purple-600" />
                <AlertDescription className="text-purple-800">
                  <span className="font-semibold">Panel Evaluation:</span> This
                  is a panel phase. Each panel member evaluates independently,
                  and final marks are averaged across all evaluations.
                </AlertDescription>
              </Alert>
            )}

            {/* Phase Locked Warning */}
            {!isPhaseActive && (
              <Alert variant="destructive">
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  This phase has ended. You can view the evaluation but cannot
                  make changes.
                </AlertDescription>
              </Alert>
            )}

            {/* Team Info */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-lg">
                    Project #{team.projectNumber || 'N/A'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {team.projectTitle || "No project title"}
                  </p>
                </div>
                <Badge variant="outline">Max Marks: {phase.maxMarks}</Badge>
              </div>
            </div>

            {/* Marks Entry */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">
                Student Marks
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({members.length}{" "}
                  {members.length === 1 ? "member" : "members"})
                </span>
              </Label>

              {members.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This team has no members. Cannot evaluate an empty team.
                  </AlertDescription>
                </Alert>
              ) : (
                // ...
                members.map((member) => {
                  const isLeader = member.uid === team.leaderId;

                  return (
                    <div
                      key={member.email}
                      className="flex flex-col gap-4 p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback
                            className={
                              isLeader ? "bg-blue-100 text-blue-700" : ""
                            }
                          >
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1">
                          <p className="font-medium">
                            {member.name}
                            {isLeader && (
                              <Badge className="ml-2 text-xs bg-blue-600">
                                Leader
                              </Badge>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {member.email}
                          </p>
                        </div>

                        {/* --- ATTENDANCE CHECKBOX --- */}
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`present-${member.email}`}
                            checked={attendance[member.email] || false}
                            onCheckedChange={(isChecked) =>
                              handleAttendanceChange(member.email, isChecked)
                            }
                            disabled={!isPhaseActive}
                          />
                          <Label
                            htmlFor={`present-${member.email}`}
                            className="text-sm font-medium"
                          >
                            Present
                          </Label>
                        </div>

                        {/* --- MARKS INPUT --- */}
                        <div className="w-32">
                          <div className="relative">
                            <Input
                              type="number"
                              value={marks[member.email] || ""}
                              onChange={(e) =>
                                handleMarkChange(member.email, e.target.value)
                              }
                              placeholder="0"
                              min="0"
                              max={phase.maxMarks}
                              step="0.5"
                              disabled={
                                !isPhaseActive ||
                                !(attendance[member.email] || false)
                              } // Disable marks if not present
                              className="pr-12"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                              / {phase.maxMarks}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* --- INDIVIDUAL FEEDBACK TEXTAREA --- */}
                      <div className="space-y-2">
                        <Label
                          htmlFor={`feedback-${member.email}`}
                          className="text-sm font-medium"
                        >
                          Feedback for {member.name.split(" ")[0]}
                        </Label>
                        <Textarea
                          id={`feedback-${member.email}`}
                          value={memberFeedbacks[member.email] || ""}
                          onChange={(e) =>
                            handleMemberFeedbackChange(
                              member.email,
                              e.target.value
                            )
                          }
                          placeholder={`Provide specific feedback for ${member.name}...`}
                          rows={2}
                          disabled={!isPhaseActive}
                          className="max-h-20 md:max-h-24 resize-none"
                        />
                      </div>
                    </div>
                  );
                })
                // ...
              )}
            </div>

            <Separator />

            {/* Stats Summary */}
            {stats.average > 0 && (
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats.total.toFixed(1)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Average</p>
                  <p className="text-2xl font-bold">
                    {stats.average.toFixed(1)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Percentage</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {stats.percentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            )}

            {/* Feedback */}
            <div className="space-y-2">
              <Label htmlFor="feedback">
                Feedback <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Provide detailed feedback on the team's work..."
                rows={4}
                disabled={!isPhaseActive}
                className="max-h-36 md:max-h-44 resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Provide constructive feedback on the team's submission
              </p>
            </div>

            {/* Existing Evaluation Info */}
            {existingEvaluation && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {isPanelPhase
                    ? "You have already submitted an evaluation for this team. You can update it if the phase is still active."
                    : "This evaluation was previously submitted. You can update it if the phase is still active."}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>

          {isPhaseActive && (
            <>
              <Button
                variant="outline"
                onClick={() => handleSave(true)}
                disabled={submitting || loading}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                Save Draft
              </Button>

              <Button
                onClick={() => handleSave(false)}
                disabled={submitting || loading}
                className="gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                {submitting ? "Submitting..." : "Submit Evaluation"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

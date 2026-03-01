// components/dashboard/student/PhaseCardWithSubmission.jsx
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmissionService } from '@/services/submissionService';
import PhaseSubmissionModal from './PhaseSubmissionModal';
import { useStudentGrades } from '@/hooks/useStudentGrades';
import { useAuth } from '@/context/AuthContext';
import { 
  Calendar, 
  Clock, 
  Award, 
  User, 
  CheckCircle2, 
  Upload,
  Eye,
  AlertCircle,
  FileCheck
} from 'lucide-react';
import { format, isPast, isFuture, isWithinInterval } from 'date-fns';

import { logger } from "../../../lib/logger";
/**
 * PhaseCardWithSubmission Component
 * Displays a phase card with submission capability
 * Shows "Submit" button for team leaders, "View Submission" for members
 * 
 * @param {Object} props
 * @param {Object} props.phase - Phase object
 * @param {string} props.teamId - Team ID
 * @param {string} props.teamName - Team name
 * @param {Object} props.team - Full team object
 * @param {boolean} props.isLeader - Whether current user is team leader
 * @param {number} props.index - Phase index (for numbering)
 */
export default function PhaseCardWithSubmission({ 
  phase, 
  teamId, 
  teamName,
  team,
  isLeader = false,
  index = 0 
}) {
  const { user } = useAuth();
  const { grades, absentGrades } = useStudentGrades();
  const [modalOpen, setModalOpen] = useState(false);
  const [submission, setSubmission] = useState(null);
  const [loadingSubmission, setLoadingSubmission] = useState(true);

  // Load submission status
  useEffect(() => {
    if (teamId && phase?.id) {
      loadSubmission();
    }
  }, [teamId, phase?.id]);

  const loadSubmission = async () => {
    setLoadingSubmission(true);
    try {
      const sub = await SubmissionService.getSubmission(teamId, phase.id);
      setSubmission(sub);
    } catch (error) {
      logger.error('Error loading submission:', error);
    } finally {
      setLoadingSubmission(false);
    }
  };

  /**
   * Get phase status based on dates
   */
  const getPhaseStatus = () => {
    if (!phase.startDate || !phase.endDate) {
      return { status: 'no-dates', label: 'No Deadline', color: 'gray' };
    }

    const now = new Date();
    const start = phase.startDate;
    const end = phase.endDate;

    if (isFuture(start)) {
      return { status: 'upcoming', label: 'Upcoming', color: 'blue' };
    }

    if (isWithinInterval(now, { start, end })) {
      return { status: 'active', label: 'Active', color: 'green' };
    }

    if (isPast(end)) {
      return { status: 'completed', label: 'Closed', color: 'gray' };
    }

    return { status: 'unknown', label: 'Unknown', color: 'gray' };
  };

  /**
   * Get submission status badge - checks individual student evaluation
   */
  const getSubmissionStatus = () => {
    if (!submission) {
      return { label: 'Not Submitted', variant: 'secondary', icon: AlertCircle, color: 'text-gray-600' };
    }

    // Check if THIS STUDENT was marked absent (even if marks not visible)
    const studentAbsent = absentGrades?.find(g => g.phaseId === phase.id);
    if (studentAbsent) {
      return { label: 'Marked Absent', variant: 'destructive', icon: AlertCircle, color: 'text-red-600' };
    }

    // Check if THIS STUDENT has been evaluated (not the entire team)
    const studentGrade = grades?.find(g => g.phaseId === phase.id);
    if (studentGrade) {
      return { label: 'Evaluated', variant: 'default', icon: CheckCircle2, color: 'text-green-600' };
    }

    const awaitingLabel = submission?.panelEvaluationProgress?.statusLabel;
    const statusMap = {
      submitted: { label: 'Submitted', variant: 'default', icon: FileCheck, color: 'text-blue-600' },
      pending: { label: 'Pending Review', variant: 'secondary', icon: Clock, color: 'text-yellow-600' },
      awaiting_panelists: { label: awaitingLabel || 'Awaiting Panel Reviews', variant: 'outline', icon: Clock, color: 'text-amber-600' },
      approved: { label: 'Approved', variant: 'default', icon: CheckCircle2, color: 'text-green-600' },
      rejected: { label: 'Needs Revision', variant: 'destructive', icon: AlertCircle, color: 'text-red-600' },
      revisions_requested: { label: 'Revisions Requested', variant: 'outline', icon: AlertCircle, color: 'text-orange-600' }
    };

    const status = submission.evaluationStatus || submission.status || 'submitted';
    return statusMap[status] || statusMap.submitted;
  };

  /**
   * Get evaluator role display
   */
  const getEvaluatorDisplay = (role) => {
    const roles = {
      mentor: { icon: User, label: 'Mentor', color: 'text-blue-600' },
      panel: { icon: User, label: 'Panel', color: 'text-purple-600' },
      external: { icon: User, label: 'External', color: 'text-orange-600' },
      combined: { icon: User, label: 'Combined', color: 'text-green-600' }
    };
    return roles[role] || roles.mentor;
  };

  const phaseStatus = getPhaseStatus();
  const submissionStatus = getSubmissionStatus();
  const evaluatorInfo = getEvaluatorDisplay(phase.evaluatorRole);
  const EvaluatorIcon = evaluatorInfo.icon;
  const SubmissionIcon = submissionStatus.icon;

  const handleModalClose = () => {
    setModalOpen(false);
    // Reload submission after modal closes
    loadSubmission();
  };

  return (
    <>
      <Card
        className={`transition-all hover:shadow-lg ${
          phaseStatus.status === 'active' 
            ? 'border-teal-300 bg-teal-50/30' 
            : 'border-gray-200'
        }`}
      >
        <CardContent className="p-4">
          {/* Phase Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-start gap-3 flex-1">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                phaseStatus.status === 'active' 
                  ? 'bg-teal-600 text-white' 
                  : phaseStatus.status === 'completed'
                  ? 'bg-gray-400 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-base font-semibold text-gray-900">
                    {phase.phaseName || phase.title || phase.name}
                  </h4>
                  <Badge 
                    variant={phaseStatus.status === 'active' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {phaseStatus.label}
                  </Badge>
                </div>
                {phase.description && (
                  <p className="text-sm text-gray-600 leading-relaxed mb-2">
                    {phase.description}
                  </p>
                )}

                {/* Submission Status Badge */}
                <div className="flex items-center gap-2 mt-2">
                  <SubmissionIcon className={`h-4 w-4 ${submissionStatus.color}`} />
                  <span className={`text-sm font-medium ${submissionStatus.color}`}>
                    {submissionStatus.label}
                  </span>
                  {submission && submission.submittedAt?.seconds && (
                    <span className="text-xs text-gray-500">
                      • Submitted {format(new Date(submission.submittedAt.seconds * 1000), 'MMM dd')}
                    </span>
                  )}
                </div>
                {submission?.panelEvaluationProgress && (
                  <p className="text-xs text-gray-600 mt-1">
                    Panel Progress: <strong>{submission.panelEvaluationProgress.completedCount}/{submission.panelEvaluationProgress.requiredCount}</strong>
                    {submission.panelEvaluationProgress.totalPanelists ? ` reviewers • ${submission.panelEvaluationProgress.totalPanelists} assigned` : ''}
                  </p>
                )}
                {submission?.panelEvaluationSummary?.absentStudents?.length > 0 && (
                  <p className="text-xs text-red-600 mt-1">
                    Marked Absent: {submission.panelEvaluationSummary.absentStudents.map(s => s.studentName || s.studentEmail).join(', ')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Phase Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            {/* Start Date */}
            {phase.startDate && (
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="h-4 w-4 flex-shrink-0 text-teal-600" />
                <div>
                  <p className="text-xs text-gray-500">Start Date</p>
                  <p className="text-sm font-medium">
                    {format(phase.startDate, 'MMM dd, yyyy')}
                  </p>
                </div>
              </div>
            )}

            {/* End Date */}
            {phase.endDate && (
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="h-4 w-4 flex-shrink-0 text-teal-600" />
                <div>
                  <p className="text-xs text-gray-500">Deadline</p>
                  <p className={`text-sm font-medium ${
                    phaseStatus.status === 'active' ? 'text-teal-600' : ''
                  }`}>
                    {format(phase.endDate, 'MMM dd, yyyy')}
                  </p>
                </div>
              </div>
            )}

            {/* Max Marks */}
            <div className="flex items-center gap-2 text-gray-600">
              <Award className="h-4 w-4 flex-shrink-0 text-teal-600" />
              <div>
                <p className="text-xs text-gray-500">Max Marks</p>
                <p className="text-sm font-medium">{phase.maxMarks || 100}</p>
              </div>
            </div>

            {/* Evaluator Role */}
            <div className="flex items-center gap-2 text-gray-600">
              <EvaluatorIcon className={`h-4 w-4 flex-shrink-0 ${evaluatorInfo.color}`} />
              <div>
                <p className="text-xs text-gray-500">Evaluated By</p>
                <p className={`text-sm font-medium ${evaluatorInfo.color}`}>
                  {evaluatorInfo.label}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-3 border-t">
            {isLeader ? (
              <Button
                onClick={() => setModalOpen(true)}
                className="flex-1 gap-2"
                variant={submission ? "outline" : "default"}
                disabled={loadingSubmission}
              >
                {submission ? (
                  <>
                    <Eye className="h-4 w-4" />
                    View & Update Submission
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Submit Work
                  </>
                )}
              </Button>
            ) : (
              <>
                {submission ? (
                  <Button
                    onClick={() => setModalOpen(true)}
                    className="flex-1 gap-2"
                    variant="outline"
                    disabled={loadingSubmission}
                  >
                    <Eye className="h-4 w-4" />
                    View Submission
                  </Button>
                ) : (
                  <div className="flex-1 p-2 text-center text-sm text-gray-500 bg-gray-50 rounded border border-dashed">
                    Waiting for team leader to submit
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submission Modal */}
      <PhaseSubmissionModal
        open={modalOpen}
        onClose={handleModalClose}
        phase={phase}
        teamId={teamId}
        teamName={teamName}
        team={team}
        isLeader={isLeader}
        viewOnly={!isLeader}
      />
    </>
  );
}

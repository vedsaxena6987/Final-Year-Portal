// components/dashboard/student/PhaseSubmissionModal.jsx
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSession } from '@/context/SessionContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubmissionService } from '@/services/submissionService';
import ExtensionService from '@/services/extensionService';
import StudentPanelEvaluationDetails from './StudentPanelEvaluationDetails';
import { toast } from 'sonner';
import { 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  Link as LinkIcon, 
  Clock, 
  Upload,
  History,
  User,
  Calendar,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
  Users
} from 'lucide-react';
import { format, isPast, isAfter } from 'date-fns';

import { logger } from "../../../lib/logger";
/**
 * PhaseSubmissionModal Component
 * Unified modal for submitting work for any phase
 * 
 * @param {Object} props
 * @param {boolean} props.open - Modal open state
 * @param {function} props.onClose - Close handler
 * @param {Object} props.phase - Phase object with id, name, endDate, etc.
 * @param {string} props.teamId - Team ID
 * @param {string} props.teamName - Team name
 * @param {Object} props.team - Full team object (for auto-population if needed)
 * @param {boolean} props.isLeader - Whether current user is team leader
 * @param {boolean} props.viewOnly - View-only mode for non-leaders
 */
export default function PhaseSubmissionModal({ 
  open, 
  onClose, 
  phase, 
  teamId, 
  teamName,
  team,
  isLeader = false,
  viewOnly = false
}) {
  const { userData } = useAuth();
  const { activeSession } = useSession();

  // Helper to safely convert Firestore timestamp to Date
  const toSafeDate = (dateValue) => {
    if (!dateValue) return null;
    if (dateValue instanceof Date) return dateValue;
    if (dateValue?.toDate) return dateValue.toDate();
    if (dateValue?.seconds) return new Date(dateValue.seconds * 1000);
    try {
      const date = new Date(dateValue);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  };
  
  // Form state
  const [submissionTitle, setSubmissionTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [driveLink, setDriveLink] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  
  // Data state
  const [currentSubmission, setCurrentSubmission] = useState(null);
  const [submissionHistory, setSubmissionHistory] = useState([]);
  const [extensionInfo, setExtensionInfo] = useState(null);
  const [deadlinePassed, setDeadlinePassed] = useState(false);

  // Load submission data and check deadline
  useEffect(() => {
    if (open && teamId && phase?.id) {
      loadSubmissionData();
      checkDeadline();
    } else if (!open) {
      // Reset form state when modal closes
      setSubmissionTitle('');
      setNotes('');
      setDriveLink('');
      setCurrentSubmission(null);
      setSubmissionHistory([]);
      setExtensionInfo(null);
      setShowHistory(false);
    }
  }, [open, teamId, phase?.id]);

  /**
   * Load existing submission and history
   */
  const loadSubmissionData = async () => {
    setLoadingData(true);
    try {
      
      // Get current submission
      const submission = await SubmissionService.getSubmission(teamId, phase.id);
      
      if (submission) {
        setCurrentSubmission(submission);
        setSubmissionTitle(submission.submissionTitle || '');
        setNotes(submission.notes || '');
        setDriveLink(submission.fileUrls?.[0] || '');
        
        // Get submission history if available
        const history = await SubmissionService.getSubmissionHistory(teamId, phase.id);
        setSubmissionHistory(history || []);
      } else {
        // Auto-populate title from phase name for new submissions
        const teamDisplay = teamName ? teamName.replace('Project ', '') : team?.projectNumber || 'Team';
        setSubmissionTitle(`${phase.phaseName || phase.name} - Project ${teamDisplay}`);
      }

      // Check for deadline extension
      const extension = await ExtensionService.getExtensionDetails(teamId, phase.id);
      
      if (extension) {
        setExtensionInfo({
          hasExtension: true,
          extendedDeadline: extension.extendedDeadline.toDate(),
          reason: extension.reason
        });
      }
    } catch (error) {
      logger.error('[PhaseSubmissionModal] Error loading submission data:', error);
      logger.error('[PhaseSubmissionModal] Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      toast.error('Failed to load submission data');
    } finally {
      setLoadingData(false);
    }
  };

  /**
   * Check if deadline has passed
   */
  const checkDeadline = () => {
    if (!phase?.endDate) {
      setDeadlinePassed(false);
      return;
    }

    try {
      // Convert Firestore Timestamp to Date if needed
      let deadline = extensionInfo?.extendedDeadline || phase.endDate;
      
      // Handle Firestore Timestamp
      if (deadline?.toDate) {
        deadline = deadline.toDate();
      } else if (deadline?.seconds) {
        deadline = new Date(deadline.seconds * 1000);
      } else if (!(deadline instanceof Date)) {
        deadline = new Date(deadline);
      }

      // Validate that we have a valid date
      if (isNaN(deadline.getTime())) {
        logger.error('[PhaseSubmissionModal] Invalid date:', deadline);
        setDeadlinePassed(false);
        return;
      }

      const now = new Date();
      // Use manual comparison for more reliability (some date-fns versions have timezone issues)
      const hasPassed = deadline.getTime() < now.getTime();
      
      
      
      setDeadlinePassed(hasPassed);
    } catch (error) {
      logger.error('[PhaseSubmissionModal] Error checking deadline:', error);
      setDeadlinePassed(false);
    }
  };

  // Update deadline check when extension info changes
  useEffect(() => {
    checkDeadline();
  }, [extensionInfo, phase?.endDate]);

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!submissionTitle.trim()) {
      toast.error("Submission title is required");
      return;
    }

    if (!driveLink.trim()) {
      toast.error("Please provide a Google Drive link");
      return;
    }

    if (deadlinePassed && !extensionInfo?.hasExtension) {
      toast.error("Deadline has passed. You cannot submit anymore.");
      return;
    }

    if (!activeSession?.id) {
      toast.error("No active session found");
      return;
    }

    setLoading(true);
    try {
      const result = await SubmissionService.submitPhase({
        teamId,
        teamName: teamName || 'Team',
        phaseId: phase.id,
        phaseName: phase.phaseName || phase.name,
        phaseType: phase.phaseType || 'general',
        submissionTitle: submissionTitle.trim(),
        notes: notes.trim(),
        files: [{
          name: submissionTitle.trim(),
          url: driveLink.trim(),
          type: 'folder'
        }],
        sessionId: activeSession.id,
        submittedBy: userData.email,
        isResubmission: !!currentSubmission
      });

      if (result.success) {
        toast.success(currentSubmission ? 'Submission updated successfully!' : 'Submission uploaded successfully!');
        onClose?.();
      }
    } catch (error) {
      logger.error("Submission error:", error);
      toast.error("Failed to submit. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get status badge color and label
   */
  const getStatusBadge = (status, submission) => {
    const awaitingLabel = submission?.panelEvaluationProgress?.statusLabel;
    const statusMap = {
      submitted: { label: 'Submitted', variant: 'default', icon: CheckCircle, color: 'text-blue-600' },
      pending: { label: 'Pending Review', variant: 'secondary', icon: Clock, color: 'text-yellow-600' },
      awaiting_panelists: { label: awaitingLabel || 'Awaiting Panelist Review', variant: 'outline', icon: Clock, color: 'text-amber-600' },
      evaluated: { label: 'Evaluated', variant: 'default', icon: CheckCircle, color: 'text-green-600' },
      approved: { label: 'Approved', variant: 'default', icon: CheckCircle, color: 'text-green-600' },
      rejected: { label: 'Rejected', variant: 'destructive', icon: AlertCircle, color: 'text-red-600' },
      revisions_requested: { label: 'Revisions Requested', variant: 'outline', icon: AlertTriangle, color: 'text-orange-600' },
      absent: { label: 'Marked Absent', variant: 'destructive', icon: AlertCircle, color: 'text-red-600' }
    };
    return statusMap[status] || statusMap.submitted;
  };

  const statusInfo = currentSubmission ? getStatusBadge(currentSubmission.evaluationStatus || currentSubmission.status, currentSubmission) : null;
  const StatusIcon = statusInfo?.icon;
  const panelProgress = currentSubmission?.panelEvaluationProgress;
  const panelSummary = currentSubmission?.panelEvaluationSummary;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-teal-600" />
            {phase?.phaseName || phase?.name || 'Phase Submission'}
          </DialogTitle>
          <DialogDescription>
            {viewOnly 
              ? "View your team's submission details and history"
              : isLeader
              ? "Submit your work as a Google Drive link. Your team members can view the submission."
              : "Only your team leader can submit. You can view the submission once it's uploaded."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-1">
          <div className="space-y-4 pr-4">
            {/* Deadline Info */}
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border">
              <Calendar className="h-4 w-4 text-gray-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Deadline</p>
                <p className="text-xs text-gray-600 mt-1">
                  {(() => {
                    const safeDate = toSafeDate(phase?.endDate);
                    return safeDate ? format(safeDate, 'MMMM dd, yyyy hh:mm a') : 'No deadline set';
                  })()}
                </p>
                {deadlinePassed && !extensionInfo?.hasExtension && (
                  <div className="flex items-center gap-1 mt-2 text-red-600">
                    <AlertCircle className="h-3 w-3" />
                    <span className="text-xs font-medium">Deadline has passed</span>
                  </div>
                )}
              </div>
              {phase?.maxMarks && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">Max Marks</p>
                  <p className="text-sm font-bold text-teal-600">{phase.maxMarks}</p>
                </div>
              )}
            </div>

            {/* Extension Alert */}
            {extensionInfo?.hasExtension && (
              <Alert className="border-amber-500 bg-amber-50">
                <Clock className="h-4 w-4 text-amber-600" />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-amber-900">Deadline Extended</span>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                      New: {(() => {
                        const safeDate = toSafeDate(extensionInfo.extendedDeadline);
                        return safeDate ? format(safeDate, 'MMM dd, yyyy hh:mm a') : 'N/A';
                      })()}
                    </Badge>
                  </div>
                  {extensionInfo.reason && (
                    <p className="text-sm text-amber-800 mt-2">Reason: {extensionInfo.reason}</p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Current Submission Status */}
            {currentSubmission && (
              <Alert className={statusInfo?.variant === 'destructive' ? 'border-red-500 bg-red-50' : 'border-blue-500 bg-blue-50'}>
                {StatusIcon && <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />}
                <AlertDescription>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-medium text-gray-900">Current Status: </span>
                      <span className={statusInfo.color}>{statusInfo.label}</span>
                      <p className="text-sm text-gray-700 mt-1">
                        Last submitted: {currentSubmission.submittedAt?.seconds 
                          ? format(new Date(currentSubmission.submittedAt.seconds * 1000), 'MMM dd, yyyy hh:mm a')
                          : 'Unknown date'}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        By: {currentSubmission.submittedBy}
                      </p>
                      {panelProgress && (
                        <p className="text-xs text-gray-600 mt-2">
                          Panel Progress: <strong>{panelProgress.completedCount}/{panelProgress.requiredCount}</strong>
                          {panelProgress.totalPanelists ? ` panelist reviews • ${panelProgress.totalPanelists} assigned` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  {currentSubmission.feedback && (
                    <div className="mt-3 p-2 bg-white rounded border">
                      <p className="text-xs font-medium text-gray-700">Evaluator Feedback:</p>
                      <p className="text-sm text-gray-600 mt-1">{currentSubmission.feedback}</p>
                    </div>
                  )}
                  {panelSummary?.absentStudents?.length > 0 && (
                    <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
                      <p className="text-xs font-semibold text-red-700">Marked Absent:</p>
                      <p className="text-xs text-red-600 mt-1">
                        {panelSummary.absentStudents.map(s => s.studentName || s.studentEmail).join(', ')}
                      </p>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Panel Evaluation Details - Per Panelist View */}
            {phase?.phaseType === 'panel' && team?.panelId && currentSubmission && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-semibold text-gray-900">Detailed Panel Evaluation</span>
                </div>
                <StudentPanelEvaluationDetails
                  teamId={teamId}
                  phaseId={phase.id}
                  panelId={team.panelId}
                  phase={phase}
                  studentEmail={userData?.email}
                  showMarks={phase?.marksVisible !== false}
                />
              </div>
            )}

            {/* Non-Leader Message */}
            {!isLeader && !currentSubmission && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Waiting for team leader to submit.</strong>
                  <p className="text-sm mt-1">Once your team leader submits, you'll be able to view the submission here.</p>
                </AlertDescription>
              </Alert>
            )}

            {/* Submission Form */}
            {isLeader && !viewOnly && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="submissionTitle">
                    Submission Title <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    id="submissionTitle" 
                    value={submissionTitle} 
                    onChange={(e) => setSubmissionTitle(e.target.value)} 
                    placeholder={`e.g., ${phase?.phaseName || 'Phase'} - ${teamName}`}
                    required
                    disabled={loadingData || (deadlinePassed && !extensionInfo?.hasExtension)}
                  />
                  <p className="text-xs text-gray-500">Give your submission a descriptive title</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="driveLink" className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    Google Drive Link <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    id="driveLink" 
                    value={driveLink} 
                    onChange={(e) => setDriveLink(e.target.value)} 
                    placeholder="https://drive.google.com/drive/folders/... or /file/d/..."
                    required
                    type="url"
                    disabled={loadingData || (deadlinePassed && !extensionInfo?.hasExtension)}
                  />
                  <Alert className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>Important:</strong> Make sure your Google Drive link has "Anyone with the link can view" permission enabled.
                      You can share a folder link containing all your work.
                    </AlertDescription>
                  </Alert>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">
                    Notes (Optional)
                  </Label>
                  <Textarea 
                    id="notes" 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)} 
                    placeholder="Add any additional notes or comments about your submission..."
                    rows={4}
                    className="resize-none max-h-28 md:max-h-32"
                    disabled={loadingData || (deadlinePassed && !extensionInfo?.hasExtension)}
                  />
                  <p className="text-xs text-gray-500">{notes.length} characters</p>
                </div>
              </form>
            )}

            {/* View-Only Submission Details */}
            {(viewOnly || !isLeader) && currentSubmission && (
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                <div>
                  <p className="text-xs text-gray-500">Submission Title</p>
                  <p className="text-sm font-medium text-gray-900">{currentSubmission.submissionTitle}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Google Drive Link</p>
                  <a 
                    href={currentSubmission.fileUrls?.[0] || currentSubmission.files?.[0]?.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-teal-600 hover:text-teal-700 underline flex items-center gap-1"
                  >
                    <LinkIcon className="h-3 w-3" />
                    Open in Google Drive
                  </a>
                </div>
                {currentSubmission.notes && (
                  <div>
                    <p className="text-xs text-gray-500">Notes</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{currentSubmission.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Submission History */}
            {submissionHistory.length > 0 && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center justify-between w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-900">
                      Submission History ({submissionHistory.length} versions)
                    </span>
                  </div>
                  {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showHistory && (
                  <div className="space-y-2 pl-4 border-l-2 border-gray-200 ml-2">
                    {submissionHistory.map((submission, index) => (
                      <div key={submission.id || index} className="p-3 bg-white rounded border">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              v{submissionHistory.length - index}
                            </Badge>
                            <span className="text-xs text-gray-600">
                              {submission.submittedAt?.seconds 
                                ? format(new Date(submission.submittedAt.seconds * 1000), 'MMM dd, yyyy hh:mm a')
                                : 'Unknown date'}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 mb-1">{submission.submissionTitle}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <User className="h-3 w-3" />
                          {submission.submittedBy}
                        </div>
                        {submission.fileUrls?.[0] && (
                          <a 
                            href={submission.fileUrls[0]} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-teal-600 hover:text-teal-700 underline flex items-center gap-1 mt-2"
                          >
                            <LinkIcon className="h-3 w-3" />
                            View this version
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {isLeader && !viewOnly ? 'Cancel' : 'Close'}
          </Button>
          {isLeader && !viewOnly && (() => {
            const isEvaluated = currentSubmission?.evaluationStatus === 'evaluated';
            const isDisabled = loading || loadingData || (deadlinePassed && !extensionInfo?.hasExtension) || isEvaluated;
            
            return (
              <Button 
                type="submit"
                onClick={handleSubmit}
                disabled={isDisabled}
                className={`gap-2 ${isEvaluated ? 'bg-green-600 hover:bg-green-600 cursor-not-allowed' : ''}`}
                title={
                  isEvaluated ? "Evaluation complete - cannot update" :
                  loading ? "Submitting..." :
                  loadingData ? "Loading data..." :
                  (deadlinePassed && !extensionInfo?.hasExtension) ? "Deadline has passed" :
                  "Click to submit"
                }
              >
              {isEvaluated ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Evaluation Complete
                </>
              ) : loading ? (
                "Submitting..."
              ) : currentSubmission ? (
                <>
                  <Upload className="h-4 w-4" />
                  Update Submission
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Submit
                </>
              )}
            </Button>
            );
          })()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

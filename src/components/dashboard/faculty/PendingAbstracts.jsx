// components/dashboard/faculty/PendingAbstracts.jsx
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useSession } from '@/context/SessionContext';
import { SubmissionService } from '@/services/submissionService';
import { toast } from 'sonner';
import { FileText, Clock, CheckCircle, AlertCircle, ExternalLink, Users } from 'lucide-react';

import { logger } from "../../../lib/logger";
export default function PendingAbstracts() {
  const { userData } = useAuth();
  const { activeSession } = useSession();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [dialogType, setDialogType] = useState(null); // 'revisions' or 'view'
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    if (!userData?.uid || !activeSession?.id) {
      setLoading(false);
      return;
    }

    let unsubscribeSubmissions = null; // Track nested listener for cleanup

    // Step 1: Get all teams where current faculty is mentor
    const teamsQuery = query(
      collection(db, "teams"),
      where("mentorEmail", "==", userData.email),
      where("sessionId", "==", activeSession.id)
    );

    const unsubscribeTeams = onSnapshot(teamsQuery, async (teamsSnapshot) => {
      // Clean up previous submissions listener if it exists
      if (unsubscribeSubmissions) {
        unsubscribeSubmissions();
        unsubscribeSubmissions = null;
      }

      if (teamsSnapshot.empty) {
        setSubmissions([]);
        setLoading(false);
        return;
      }

      const teamIds = teamsSnapshot.docs.map(doc => doc.id);
      const teamsMap = {};
      teamsSnapshot.docs.forEach(doc => {
        teamsMap[doc.id] = { id: doc.id, ...doc.data() };
      });

      // Step 2: Get "abstract" phase for this session
      const phasesQuery = query(
        collection(db, "phases"),
        where("sessionId", "==", activeSession.id),
        where("type", "==", "abstract")
      );

      const phasesSnapshot = await getDocs(phasesQuery);

      if (phasesSnapshot.empty) {
        ("No abstract phase found for session");
        setSubmissions([]);
        setLoading(false);
        return;
      }

      const abstractPhase = phasesSnapshot.docs[0];
      const abstractPhaseId = abstractPhase.id;

      // Step 3: Query submissions for these teams and abstract phase
      const submissionsQuery = query(
        collection(db, "submissions"),
        where("teamId", "in", teamIds),
        where("phaseId", "==", abstractPhaseId)
      );

      unsubscribeSubmissions = onSnapshot(submissionsQuery, (submissionsSnapshot) => {
        const submissionsList = submissionsSnapshot.docs.map(doc => {
          const data = doc.data();
          const team = teamsMap[data.teamId];

          return {
            id: doc.id,
            ...data,
            teamName: `Project ${team?.projectNumber || data.projectNumber}` || 'Unknown Team',
            projectNumber: team?.projectNumber || data.projectNumber,
            projectNumber: team?.projectNumber || 'N/A',
            submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate() : new Date(),
            evaluatedAt: data.evaluatedAt?.toDate ? data.evaluatedAt.toDate() : null
          };
        });

        // Sort by submission date (newest first)
        submissionsList.sort((a, b) => b.submittedAt - a.submittedAt);

        setSubmissions(submissionsList);
        setLoading(false);
      }, (error) => {
        // Handle permission errors gracefully during logout
        if (error.code === 'permission-denied') {
          setSubmissions([]);
          setLoading(false);
        } else {
          logger.error('Error fetching submissions:', error);
          setSubmissions([]);
          setLoading(false);
        }
      });
    }, (error) => {
      // Handle permission errors gracefully during logout
      if (error.code === 'permission-denied') {
        setSubmissions([]);
        setLoading(false);
      } else {
        logger.error('Error fetching teams:', error);
        setSubmissions([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeTeams();
      if (unsubscribeSubmissions) {
        unsubscribeSubmissions();
      }
    };
  }, [userData, activeSession]);

  const handleApprove = async (submission) => {
    setProcessingId(submission.id);
    try {
      const result = await SubmissionService.updateEvaluationStatus(
        submission.id,
        'evaluated',
        'Abstract approved by mentor. Proceed to next phase.'
      );

      if (result.success) {
        toast.success(`Abstract approved for Project #${submission.projectNumber || submission.teamName.replace('Project ', '')}`);
      }
    } catch (error) {
      logger.error('Error approving abstract:', error);
      toast.error('Failed to approve abstract');
    } finally {
      setProcessingId(null);
    }
  };

  const openRevisionsDialog = (submission) => {
    setSelectedSubmission(submission);
    setDialogType('revisions');
    setFeedback('');
  };

  const openViewDialog = (submission) => {
    setSelectedSubmission(submission);
    setDialogType('view');
  };

  const handleRequestRevisions = async () => {
    if (!feedback.trim() || feedback.trim().length < 10) {
      toast.error('Please provide detailed feedback (at least 10 characters)');
      return;
    }

    setProcessingId(selectedSubmission.id);
    try {
      const result = await SubmissionService.requestRevisions(
        selectedSubmission.id,
        feedback.trim()
      );

      if (result.success) {
        setDialogType(null);
        setSelectedSubmission(null);
        setFeedback('');
      }
    } catch (error) {
      logger.error('Error requesting revisions:', error);
      toast.error('Failed to request revisions');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Pending Review</Badge>;
      case 'evaluated':
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" />Approved</Badge>;
      case 'revisions_requested':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Revisions Requested</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Pending Abstract Submissions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!activeSession) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Abstract Submissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Active Session</AlertTitle>
            <AlertDescription>
              An active academic session must be configured before viewing submissions.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const pendingSubmissions = submissions.filter(s => s.evaluationStatus === 'pending');
  const reviewedSubmissions = submissions.filter(s => s.evaluationStatus !== 'pending');

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Abstract Submissions
          </CardTitle>
          <CardDescription>
            Review and evaluate abstract submissions from your mentored teams
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pending Submissions */}
          {pendingSubmissions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Pending Review
                </h3>
                <Badge variant="outline" className="font-normal">
                  {pendingSubmissions.length} {pendingSubmissions.length === 1 ? 'submission' : 'submissions'}
                </Badge>
              </div>
              <Separator />
              {pendingSubmissions.map(submission => (
                <Card key={submission.id} className="border-l-4 border-l-orange-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Project #{submission.projectNumber || submission.teamName.replace('Project ', '')}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Submitted {submission.submittedAt.toLocaleDateString()} at {submission.submittedAt.toLocaleTimeString()}
                        </CardDescription>
                      </div>
                      {getStatusBadge(submission.evaluationStatus)}
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3 space-y-3">
                    {submission.files && submission.files.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Submitted Files</p>
                        <div className="space-y-1">
                          {submission.files.map((file, idx) => (
                            <Button
                              key={idx}
                              variant="outline"
                              size="sm"
                              className="w-full justify-start h-auto py-2 px-3"
                              asChild
                            >
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-3.5 w-3.5 mr-2" />
                                <span className="flex-1 text-left truncate">{file.name}</span>
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  {file.type?.toUpperCase() || 'FILE'}
                                </Badge>
                              </a>
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex gap-2 justify-end pt-3 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openViewDialog(submission)}
                    >
                      View Details
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openRevisionsDialog(submission)}
                      disabled={processingId === submission.id}
                    >
                      Request Revisions
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApprove(submission)}
                      disabled={processingId === submission.id}
                    >
                      {processingId === submission.id ? 'Processing...' : 'Approve'}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}

          {/* Reviewed Submissions */}
          {reviewedSubmissions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Reviewed
                </h3>
                <Badge variant="outline" className="font-normal">
                  {reviewedSubmissions.length} {reviewedSubmissions.length === 1 ? 'submission' : 'submissions'}
                </Badge>
              </div>
              <Separator />
              {reviewedSubmissions.map(submission => (
                <Card key={submission.id} className="border-l-4 border-l-green-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Project #{submission.projectNumber || submission.teamName.replace('Project ', '')}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Evaluated {submission.evaluatedAt?.toLocaleDateString() || 'Recently'}
                        </CardDescription>
                      </div>
                      {getStatusBadge(submission.evaluationStatus)}
                    </div>
                  </CardHeader>
                  <CardFooter className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openViewDialog(submission)}
                    >
                      View Details
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}

          {submissions.length === 0 && (
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertTitle>No Submissions Available</AlertTitle>
              <AlertDescription>
                There are currently no abstract submissions from your mentored teams. Once teams submit their abstracts, they will appear here for your review.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={dialogType === 'view'} onOpenChange={() => { setDialogType(null); setSelectedSubmission(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedSubmission?.teamName} - Abstract Details</DialogTitle>
            <DialogDescription>
              Project #{selectedSubmission?.projectNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-1">Status</h4>
              {selectedSubmission && getStatusBadge(selectedSubmission.evaluationStatus)}
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-1">Submission Date</h4>
              <p className="text-sm text-muted-foreground">
                {selectedSubmission?.submittedAt.toLocaleString()}
              </p>
            </div>

            {selectedSubmission?.files && selectedSubmission.files.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Submitted Files</h4>
                <div className="space-y-2">
                  {selectedSubmission.files.map((file, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      className="w-full justify-start h-auto py-3"
                      asChild
                    >
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        <span className="flex-1 text-left">{file.name}</span>
                        <Badge variant="secondary" className="ml-auto">
                          {file.type?.toUpperCase() || 'FILE'}
                        </Badge>
                      </a>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {selectedSubmission?.evaluationFeedback && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Evaluation Feedback</h4>
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription className="whitespace-pre-wrap">
                    {selectedSubmission.evaluationFeedback}
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {selectedSubmission?.revisionFeedback && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Revision Feedback</h4>
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="whitespace-pre-wrap">
                    {selectedSubmission.revisionFeedback}
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Revisions Dialog */}
      <Dialog open={dialogType === 'revisions'} onOpenChange={() => { setDialogType(null); setSelectedSubmission(null); setFeedback(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Revisions</DialogTitle>
            <DialogDescription>
              Provide detailed feedback for {selectedSubmission?.teamName} to improve their abstract.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Textarea
                placeholder="Explain what needs to be revised and why..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={6}
                className="resize-none max-h-36 md:max-h-44"
              />
              <p className="text-xs text-muted-foreground">
                {feedback.length}/10 characters minimum • Be specific and constructive in your feedback
              </p>
            </div>
            {feedback.trim().length > 0 && feedback.trim().length < 10 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Feedback must be at least 10 characters long.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleRequestRevisions}
              disabled={processingId === selectedSubmission?.id || !feedback.trim() || feedback.trim().length < 10}
            >
              {processingId === selectedSubmission?.id ? 'Sending...' : 'Send Feedback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

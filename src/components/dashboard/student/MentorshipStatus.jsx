// src/components/dashboard/MentorshipStatus.jsx
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSession } from '@/context/SessionContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, MessageSquare, Clock, User, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import SelectMentor from './SelectMentor';
import ActiveMentorshipRequest from './ActiveMentorshipRequest';
import { RevisionHistoryDialog } from '../shared/RevisionHistory';

import { logger } from "../../../lib/logger";
export default function MentorshipStatus({ team }) {
  const { userData } = useAuth();
  const { activeSession } = useSession();
  const [mentorshipRequest, setMentorshipRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSelectMentor, setShowSelectMentor] = useState(false);
  const [showResubmitDialog, setShowResubmitDialog] = useState(false);
  const [resubmitData, setResubmitData] = useState({
    projectTitle: '',
    abstract: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      if (!team?.id) {
        setLoading(false);
        return;
      }

      // Always query for mentorship requests, regardless of team.mentorStatus
      // This ensures we catch pending requests even if team document hasn't been updated
      const requestsQuery = query(
        collection(db, 'mentorship_requests'),
        where('teamId', '==', team.id)
      );


      const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
        
        // Log each document for debugging
        snapshot.docs.forEach((doc) => {
        });
        
        if (snapshot.docs.length > 0) {
          // Get pending requests first (highest priority)
          const requests = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            respondedAt: doc.data().respondedAt?.toDate() || null
          }));
          
          // Sort by: 1) pending status first, 2) then by most recent
          const sortedRequests = requests.sort((a, b) => {
            if (a.status === 'pending' && b.status !== 'pending') return -1;
            if (a.status !== 'pending' && b.status === 'pending') return 1;
            return b.createdAt - a.createdAt;
          });
          
          const latestRequest = sortedRequests[0];
          setMentorshipRequest(latestRequest);
        } else {
          // No request documents found
          // Only create fallback if team has mentorStatus (backward compatibility)
          if (team.mentorStatus) {
            const requestFromTeam = {
              id: `team-${team.id}`,
              status: team.mentorStatus,
              teamId: team.id,
              teamName: team.name,
              projectNumber: team.projectNumber,
              projectTitle: team.projectTitle || 'Project Title',
              projectAbstract: team.projectAbstract || 'Project Abstract',
              mentorId: team.pendingMentorId || team.mentorId,
              mentorName: team.mentorName || 'Faculty Member',
              mentorEmail: team.mentorEmail || 'mentor@gehu.ac.in',
              createdAt: new Date(),
              feedback: team.mentorStatus === 'revisions_requested' ? 
                'The mentor has requested revisions to your project proposal.' : 
                ''
            };
            setMentorshipRequest(requestFromTeam);
          } else {
            // No requests and no mentorStatus = truly no request sent yet
            setMentorshipRequest(null);
          }
        }
        setLoading(false);
      });

      return () => unsubscribe();

    } catch (error) {
      logger.error('MentorshipStatus: Error in useEffect:', error);
      setLoading(false);
    }
  }, [team]);

  const handleResubmitProposal = () => {
    // Pre-fill the form with saved project details from team document (priority)
    // Fall back to mentorship request details if no saved details exist
    setResubmitData({
      projectTitle: team.projectTitle || mentorshipRequest?.projectTitle || '',
      abstract: team.projectAbstract || mentorshipRequest?.projectAbstract || ''
    });
    setShowResubmitDialog(true);
  };

  const handleSubmitResubmission = async () => {
    if (!resubmitData.projectTitle.trim() || !resubmitData.abstract.trim()) {
      toast.error('Please fill in both project title and abstract.');
      return;
    }

    if (!userData?.teamId || !mentorshipRequest?.mentorId) {
      toast.error('Missing team or mentor information.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Store revision history entry for the current version before creating new request
      const revisionHistoryData = {
        teamId: userData.teamId,
        projectNumber: userData.projectNumber,
        requestId: mentorshipRequest.id,
        version: (mentorshipRequest.revisionVersion || 0) + 1,
        projectTitle: resubmitData.projectTitle.trim(),
        projectAbstract: resubmitData.abstract.trim(),
        previousTitle: mentorshipRequest.projectTitle,
        previousAbstract: mentorshipRequest.projectAbstract,
        mentorFeedback: mentorshipRequest.revisionFeedback || mentorshipRequest.feedback || null,
        feedbackType: 'resubmission', // Required field for Firestore rules
        status: 'resubmitted',
        submittedBy: userData.uid,
        submittedByEmail: userData.email,
        submittedByName: userData.name,
        mentorId: mentorshipRequest.mentorId,
        mentorEmail: mentorshipRequest.mentorEmail,
        mentorName: mentorshipRequest.mentorName,
        sessionId: activeSession?.id || mentorshipRequest.sessionId,
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, "revision_history"), revisionHistoryData);

      // 2. Create new mentorship request document
      const requestData = {
        teamId: userData.teamId,
        teamName: team?.name || `Team ${userData.projectNumber}`,
        projectNumber: userData.projectNumber,
        projectTitle: resubmitData.projectTitle.trim(),
        projectAbstract: resubmitData.abstract.trim(),
        mentorId: mentorshipRequest.mentorId,
        // Use mentor details if available, otherwise use placeholders that will be filled later
        mentorEmail: mentorshipRequest.mentorEmail || 'mentor@gehu.ac.in',
        mentorName: mentorshipRequest.mentorName || 'Faculty Member',
        requestedBy: userData.uid,
        requestedByEmail: userData.email,
        requestedByName: userData.name,
        status: "pending",
        isResubmission: true,
        previousRequestId: mentorshipRequest.id,
        revisionVersion: (mentorshipRequest.revisionVersion || 0) + 1,
        sessionId: activeSession?.id || mentorshipRequest.sessionId,
        teamMembers: team?.members || [userData.email],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, "mentorship_requests"), requestData);

      // 3. Update team status
      const teamRef = doc(db, "teams", userData.teamId);
      await updateDoc(teamRef, {
        mentorStatus: "pending",
        projectTitle: resubmitData.projectTitle.trim(),
        projectAbstract: resubmitData.abstract.trim(),
      });

      toast.success("Proposal resubmitted successfully!", {
        description: `Revision ${(mentorshipRequest.revisionVersion || 0) + 1} submitted`
      });
      setShowResubmitDialog(false);
      setResubmitData({ projectTitle: '', abstract: '' });
    } catch (error) {
      toast.error("Failed to resubmit proposal.");
      logger.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusConfig = (status) => {
    const configs = {
      pending: {
        icon: Clock,
        variant: 'secondary',
        label: 'Pending Review',
        color: 'text-yellow-600'
      },
      approved: {
        icon: CheckCircle,
        variant: 'default',
        label: 'Approved',
        color: 'text-green-600'
      },
      rejected: {
        icon: XCircle,
        variant: 'destructive',
        label: 'Rejected',
        color: 'text-red-600'
      },
      revisions_requested: {
        icon: MessageSquare,
        variant: 'outline',
        label: 'Revisions Requested',
        color: 'text-blue-600'
      }
    };
    
    return configs[status] || configs.pending;
  };

  const isLeader = userData?.uid === team?.leaderId;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Mentorship Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading status...</p>
        </CardContent>
      </Card>
    );
  }

  // Handle showing SelectMentor for rejected requests or no request at all
  const shouldShowSelectMentor = !mentorshipRequest || mentorshipRequest.status === 'rejected';
  
  // No mentorship request exists yet or request was rejected
  if (!mentorshipRequest || mentorshipRequest.status === 'rejected') {
    if (showSelectMentor && isLeader) {
      return <SelectMentor team={team} onCancel={() => setShowSelectMentor(false)} hasPendingRequest={false} />;
    }
    
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {mentorshipRequest?.status === 'rejected' ? 'Previous Request Rejected' : 'Select a Mentor'}
          </CardTitle>
          {mentorshipRequest?.status === 'rejected' && (
            <CardDescription className="text-red-600">
              Your previous mentorship request was rejected. You can select a different mentor.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {isLeader ? (
            <div className="space-y-4">
              {mentorshipRequest?.status === 'rejected' && mentorshipRequest?.rejectionReason && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Rejection Reason:</strong> {mentorshipRequest.rejectionReason}
                  </AlertDescription>
                </Alert>
              )}
              <p>
                {mentorshipRequest?.status === 'rejected' 
                  ? 'Select a different mentor and send a new request.' 
                  : 'Your team needs to select a mentor to proceed.'}
              </p>
              <Button onClick={() => setShowSelectMentor(true)}>
                Select Mentor
              </Button>
            </div>
          ) : (
            <p>Your team leader needs to select a mentor.</p>
          )}
        </CardContent>
      </Card>
    );
  }
  
  // Show ActiveMentorshipRequest component for pending requests
  if (mentorshipRequest.status === 'pending') {
    return (
      <div className="space-y-4">
        {isLeader ? (
          <ActiveMentorshipRequest 
            request={mentorshipRequest}
            onWithdraw={() => {
              // Refresh the component by clearing the request
              setMentorshipRequest(null);
              setShowSelectMentor(false);
            }}
          />
        ) : (
          <Card className="border-yellow-200 bg-yellow-50/30">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <CardTitle>Mentorship Request Pending</CardTitle>
              </div>
              <CardDescription>
                Your team leader has sent a mentorship request
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium">Requested Mentor:</span>
                  <p className="text-sm text-muted-foreground">{mentorshipRequest.mentorName}</p>
                </div>
                <div>
                  <span className="text-sm font-medium">Project Title:</span>
                  <p className="text-sm text-muted-foreground">{mentorshipRequest.projectTitle}</p>
                </div>
                <Badge variant="outline" className="border-yellow-600 text-yellow-600">
                  <Clock className="h-3 w-3 mr-1" />
                  Awaiting Faculty Response
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  const statusConfig = getStatusConfig(mentorshipRequest.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Mentorship Request
            </CardTitle>
            <div className="flex items-center gap-2">
              {(mentorshipRequest.revisionVersion > 0 || mentorshipRequest.isResubmission) && (
                <RevisionHistoryDialog 
                  teamId={userData.teamId} 
                  projectNumber={userData.projectNumber}
                  triggerText={`v${mentorshipRequest.revisionVersion || 0}`}
                />
              )}
              <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                <StatusIcon className="h-3 w-3" />
                {statusConfig.label}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mentor Information */}
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-medium mb-2">Requested Mentor</h4>
            <p className="text-sm">{mentorshipRequest.mentorName}</p>
            <p className="text-sm text-muted-foreground">{mentorshipRequest.mentorEmail}</p>
          </div>

          {/* Project Details */}
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-1">
              <FileText className="h-4 w-4" />
              Project Details
            </h4>
            <div className="space-y-2">
              <div>
                <span className="text-sm font-medium">Title: </span>
                <span className="text-sm">{mentorshipRequest.projectTitle}</span>
              </div>
              <div>
                <span className="text-sm font-medium">Abstract: </span>
                <ScrollArea className="h-24 w-full border rounded p-2 mt-1">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {mentorshipRequest.projectAbstract}
                  </p>
                </ScrollArea>
              </div>
            </div>
          </div>

          {/* Status Information */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Requested on {mentorshipRequest.createdAt?.toLocaleDateString()}</span>
            {mentorshipRequest.respondedAt && (
              <span>Responded on {mentorshipRequest.respondedAt.toLocaleDateString()}</span>
            )}
          </div>

          {/* Feedback from Mentor */}
          {(mentorshipRequest.revisionFeedback || mentorshipRequest.feedback) && (
            <div className={`p-4 rounded-lg border-l-4 ${
              mentorshipRequest.status === 'revisions_requested' 
                ? 'bg-blue-50 border-l-blue-500' 
                : 'bg-muted border-l-blue-500'
            }`}>
              <h4 className="font-medium mb-2 flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                {mentorshipRequest.status === 'revisions_requested' ? 'Revision Feedback' : 'Mentor Feedback'}
              </h4>
              <p className="text-sm whitespace-pre-wrap">
                {mentorshipRequest.revisionFeedback || mentorshipRequest.feedback}
              </p>
            </div>
          )}

          {/* Action Buttons Based on Status */}
          {mentorshipRequest.status === 'revisions_requested' && isLeader && (
            <div className="pt-4 border-t bg-blue-50 -mx-6 -mb-6 px-6 py-4 rounded-b-lg">
              <Alert className="mb-4 border-blue-200 bg-white">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription>
                  The mentor has requested changes to your project proposal. Please review the feedback above and revise your project title and abstract accordingly.
                </AlertDescription>
              </Alert>
              <Button 
                onClick={handleResubmitProposal}
                className="w-full flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <FileText className="h-4 w-4" />
                Revise & Resubmit Proposal
              </Button>
            </div>
          )}

          {mentorshipRequest.status === 'rejected' && isLeader && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-3">
                This mentorship request was rejected. You can select a different mentor.
              </p>
              <Button 
                onClick={() => setShowSelectMentor(true)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <User className="h-4 w-4" />
                Select Different Mentor
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Show SelectMentor component when needed */}
      {showSelectMentor && isLeader && (
        <SelectMentor 
          team={team} 
          onCancel={() => setShowSelectMentor(false)} 
          hasPendingRequest={mentorshipRequest?.status === 'pending'}
        />
      )}

      {/* Resubmission Dialog */}
      <Dialog open={showResubmitDialog} onOpenChange={setShowResubmitDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Resubmit Project Proposal</DialogTitle>
            <DialogDescription>
              Update your project title and abstract based on the mentor's feedback, then resubmit to the same mentor.
              {(team.projectTitle || team.projectAbstract) && (
                <span className="block mt-2 text-green-600 text-xs">
                  ✓ Auto-filled from saved project details
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="resubmit-title">Project Title</Label>
              <Input
                id="resubmit-title"
                placeholder="Enter your updated project title"
                value={resubmitData.projectTitle}
                onChange={(e) => setResubmitData(prev => ({
                  ...prev,
                  projectTitle: e.target.value
                }))}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="resubmit-abstract">Abstract</Label>
              <Textarea
                id="resubmit-abstract"
                placeholder="Provide your updated project abstract (minimum 100 words)"
                value={resubmitData.abstract}
                onChange={(e) => setResubmitData(prev => ({
                  ...prev,
                  abstract: e.target.value
                }))}
                rows={6}
                required
                className="max-h-40 md:max-h-48 resize-y"
              />
              <p className="text-xs text-muted-foreground">
                {resubmitData.abstract.length} characters
              </p>
            </div>

            {(mentorshipRequest?.revisionFeedback || mentorshipRequest?.feedback) && (
              <div className="bg-blue-50 border-l-4 border-l-blue-500 p-3 rounded">
                <h4 className="font-medium text-sm mb-1 flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  Mentor's Revision Feedback
                </h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {mentorshipRequest.revisionFeedback || mentorshipRequest.feedback}
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowResubmitDialog(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitResubmission} 
              disabled={submitting}
            >
              {submitting ? "Resubmitting..." : "Resubmit to Mentor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

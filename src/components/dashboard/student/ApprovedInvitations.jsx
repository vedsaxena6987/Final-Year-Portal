"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { TeamInvitationService } from '@/services/teamInvitationService';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Users, CheckCircle, XCircle, Hash, Calendar, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

import { logger } from "../../../lib/logger";
/**
 * ApprovedInvitations Component
 * 
 * Shows invitations approved by team leaders that student needs to accept/reject
 * Displayed above the TeamCreationGuard when leader has approved but student hasn't confirmed
 */
export default function ApprovedInvitations() {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvitation, setSelectedInvitation] = useState(null);
  const [actionType, setActionType] = useState(''); // 'accept' or 'reject'
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Real-time listener for approved invitations awaiting student confirmation
  useEffect(() => {
    if (!user?.email) return;

    const q = query(
      collection(db, 'team_invitations'),
      where('studentEmail', '==', user.email),
      where('status', '==', 'approved_by_leader'),
      orderBy('approvedByLeaderAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const invitationsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        approvedByLeaderAt: doc.data().approvedByLeaderAt?.toDate()
      }));
      setInvitations(invitationsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.email]);

  const handleOpenDialog = (invitation, action) => {
    setSelectedInvitation(invitation);
    setActionType(action);
    setDialogOpen(true);
  };

  const handleAction = async () => {
    if (!selectedInvitation) return;

    setProcessing(true);
    try {
      let result;
      if (actionType === 'accept') {
        result = await TeamInvitationService.acceptByStudent(selectedInvitation.id);
        if (result.success) {
          toast.success('Welcome to the team! 🎉', {
            description: `You are now a member of ${result.teamData?.name}`
          });
          // Page will automatically update via AuthContext when userData.teamId changes
        }
      } else if (actionType === 'reject') {
        result = await TeamInvitationService.rejectByStudent(selectedInvitation.id);
      }

      if (result.success) {
        setDialogOpen(false);
        setSelectedInvitation(null);
      }
    } catch (error) {
      logger.error('Error processing invitation:', error);
    } finally {
      setProcessing(false);
    }
  };

  if (loading || invitations.length === 0) {
    return null; // Don't show component if no approved invitations
  }

  return (
    <>
      {/* Full-screen overlay with approved invitation */}
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl shadow-2xl border-green-200">
          <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="h-6 w-6 text-green-600" />
                Team Invitation Approved!
              </CardTitle>
              <Badge className="bg-green-500 text-white">
                Action Required
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="space-y-6">
                <div className="text-center space-y-2">
                  <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                    <Users className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    Join {invitation.teamName}?
                  </h3>
                  <p className="text-gray-600">
                    <strong>{invitation.leaderName}</strong> has approved your request to join their team
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-gray-500 uppercase">Team Name</div>
                      <div className="font-semibold text-gray-900">{invitation.teamName}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        Project Number
                      </div>
                      <div className="font-semibold text-gray-900">#{invitation.projectNumber}</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-medium text-gray-500 uppercase">Team Leader</div>
                    <div className="font-medium text-gray-900">{invitation.leaderName}</div>
                    <div className="text-sm text-gray-600">{invitation.leaderEmail}</div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 border-t">
                    <Calendar className="h-3 w-3" />
                    Approved {formatDistanceToNow(invitation.approvedByLeaderAt, { addSuffix: true })}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    <strong>Important:</strong> Once you accept, you will be added to this team permanently. 
                    Make sure this is the team you want to join for your final year project.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    size="lg"
                    onClick={() => handleOpenDialog(invitation, 'accept')}
                    className="flex-1 bg-green-600 hover:bg-green-700 h-12 text-base"
                  >
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Accept & Join Team
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => handleOpenDialog(invitation, 'reject')}
                    className="flex-1 border-red-300 text-red-700 hover:bg-red-50 h-12 text-base"
                  >
                    <XCircle className="h-5 w-5 mr-2" />
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === 'accept' && <CheckCircle className="h-5 w-5 text-green-600" />}
              {actionType === 'reject' && <XCircle className="h-5 w-5 text-red-600" />}
              {actionType === 'accept' ? 'Confirm Join Team' : 'Decline Invitation'}
            </DialogTitle>
            <DialogDescription>
              {selectedInvitation && (
                <div className="mt-2">
                  Team: <strong>{selectedInvitation.teamName}</strong> (Project #{selectedInvitation.projectNumber})
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {actionType === 'accept' && (
              <p className="text-sm text-gray-600">
                Are you sure you want to join <strong>{selectedInvitation?.teamName}</strong>? 
                This will be your final year project team for the entire academic year.
              </p>
            )}

            {actionType === 'reject' && (
              <p className="text-sm text-gray-600">
                Are you sure you want to decline this invitation? You can create a new team or 
                request to join a different team instead.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={processing}
              className={
                actionType === 'accept'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }
            >
              {processing ? 'Processing...' : actionType === 'accept' ? 'Yes, Join Team' : 'Yes, Decline'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

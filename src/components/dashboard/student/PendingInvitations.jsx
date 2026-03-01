"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { TeamInvitationService } from '@/services/teamInvitationService';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UserPlus, CheckCircle, XCircle, Clock, Mail, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

import { logger } from "../../../lib/logger";
/**
 * PendingInvitations Component
 * 
 * Displays pending join requests for team leaders to approve/reject
 * Real-time updates using Firestore onSnapshot
 */
export default function PendingInvitations({ teamId }) {
  const { userData } = useAuth();
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvitation, setSelectedInvitation] = useState(null);
  const [actionType, setActionType] = useState(''); // 'approve' or 'reject'
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  // Real-time listener for pending invitations
  useEffect(() => {
    if (!teamId) return;

    const q = query(
      collection(db, 'team_invitations'),
      where('teamId', '==', teamId),
      where('status', '==', 'pending'),
      orderBy('requestedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const invitationsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          requestedAt: doc.data().requestedAt?.toDate()
        }));
        setInvitations(invitationsData);
        setLoading(false);
      },
      (error) => {
        logger.error('Error fetching invitations:', error);
        if (error.code === 'permission-denied') {
          toast.error('Access denied', {
            description: 'You do not have permission to view join requests.'
          });
        } else {
          toast.error('Failed to load join requests', {
            description: error.message
          });
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [teamId]);

  const handleOpenDialog = (invitation, action) => {
    setSelectedInvitation(invitation);
    setActionType(action);
    setDialogOpen(true);
    setRejectionReason('');
  };

  const handleAction = async () => {
    if (!selectedInvitation) return;

    setProcessing(true);
    let isMounted = true;

    try {
      let result;
      if (actionType === 'approve') {
        result = await TeamInvitationService.approveByLeader(selectedInvitation.id);
      } else if (actionType === 'reject') {
        result = await TeamInvitationService.rejectByLeader(
          selectedInvitation.id,
          rejectionReason.trim()
        );
      }

      // Only update state if component is still mounted
      if (result.success && isMounted) {
        setDialogOpen(false);
        setSelectedInvitation(null);
        setRejectionReason('');
      }
    } catch (error) {
      logger.error('Error processing invitation:', error);
      if (isMounted) {
        toast.error('Failed to process request', {
          description: error.message
        });
      }
    } finally {
      if (isMounted) {
        setProcessing(false);
      }
    }

    // Cleanup function
    return () => {
      isMounted = false;
    };
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 animate-pulse" />
            Loading Join Requests...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (invitations.length === 0) {
    return null; // Don't show component if no pending invitations
  }

  return (
    <>
      <Card className="border-orange-200 bg-orange-50/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="h-5 w-5 text-orange-600" />
              Pending Join Requests
            </CardTitle>
            <Badge className="bg-orange-500 text-white">
              {invitations.length} pending
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {invitations.map((invitation) => (
            <Card key={invitation.id} className="border-orange-100">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <Avatar className="mt-1">
                      <AvatarFallback className="bg-orange-100 text-orange-700">
                        {invitation.studentName?.substring(0, 2).toUpperCase() || '??'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <div>
                        <h4 className="font-semibold text-gray-900">{invitation.studentName}</h4>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Mail className="h-3 w-3" />
                          {invitation.studentEmail}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        Requested {formatDistanceToNow(invitation.requestedAt, { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleOpenDialog(invitation, 'approve')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenDialog(invitation, 'reject')}
                      className="border-red-300 text-red-700 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === 'approve' && <CheckCircle className="h-5 w-5 text-green-600" />}
              {actionType === 'reject' && <XCircle className="h-5 w-5 text-red-600" />}
              {actionType === 'approve' ? 'Approve Join Request' : 'Reject Join Request'}
            </DialogTitle>
            {selectedInvitation && (
              <DialogDescription>
                <strong>{selectedInvitation.studentName}</strong> ({selectedInvitation.studentEmail})
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4">
            {actionType === 'approve' && (
              <p className="text-sm text-gray-600">
                Once approved, <strong>{selectedInvitation?.studentName}</strong> will be immediately added to your team and notified.
              </p>
            )}

            {actionType === 'reject' && (
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Rejection (Optional)</Label>
                <Textarea
                  id="reason"
                  placeholder="E.g., Team is already coordinating with other members..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  maxLength={200}
                  className="max-h-16 md:max-h-20 resize-none"
                />
                <p className="text-xs text-gray-500">{rejectionReason.length}/200 characters</p>
              </div>
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
                actionType === 'approve'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }
            >
              {processing ? 'Processing...' : actionType === 'approve' ? 'Approve Request' : 'Reject Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

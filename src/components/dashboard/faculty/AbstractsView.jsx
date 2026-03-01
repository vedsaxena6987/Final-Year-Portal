"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSession } from '@/context/SessionContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileText, CheckCircle, XCircle, Clock, Eye, Users, Calendar, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { logger } from "../../../lib/logger";
export default function AbstractsView() {
  const { userData } = useAuth();
  const { activeSession } = useSession();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState(null); // 'approve', 'reject', 'revisions'
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch mentored teams with abstracts
  useEffect(() => {
    if (!userData?.uid || !activeSession?.id) return;

    const teamsRef = collection(db, 'teams');
    const q = query(
      teamsRef,
      where('sessionId', '==', activeSession.id),
      where('mentorEmail', '==', userData.email)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const teamsData = [];
      
      for (const docSnap of snapshot.docs) {
        const teamData = { id: docSnap.id, ...docSnap.data() };
        
        // Fetch leader details
        if (teamData.leaderId) {
          const leaderRef = doc(db, 'users', teamData.leaderId);
          const leaderSnap = await getDoc(leaderRef);
          if (leaderSnap.exists()) {
            teamData.leaderName = leaderSnap.data().name;
          }
        }
        
        teamsData.push(teamData);
      }
      
      setTeams(teamsData);
      setLoading(false);
    }, (error) => {
      // Handle permission errors gracefully during logout
      if (error.code === 'permission-denied') {
        setTeams([]);
        setLoading(false);
      } else {
        logger.error('Error fetching teams:', error);
        toast.error('Failed to load abstracts');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [userData?.uid, activeSession?.id]);

  // Filter teams by abstract status
  const filterTeams = (status) => {
    if (status === 'all') return teams;
    if (status === 'pending') return teams.filter(t => t.abstractStatus === 'pending');
    if (status === 'approved') return teams.filter(t => t.abstractStatus === 'approved');
    if (status === 'rejected') return teams.filter(t => t.abstractStatus === 'rejected');
    if (status === 'under_review') return teams.filter(t => t.abstractStatus === 'under_review');
    return teams;
  };

  // Get status badge variant
  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return { 
          variant: 'default', 
          icon: CheckCircle, 
          text: 'Approved', 
          className: 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-0 shadow-md',
          cardGradient: 'from-green-50 to-emerald-50/30',
          borderColor: 'border-green-200'
        };
      case 'rejected':
        return { 
          variant: 'destructive', 
          icon: XCircle, 
          text: 'Rejected', 
          className: 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white border-0 shadow-md',
          cardGradient: 'from-red-50 to-rose-50/30',
          borderColor: 'border-red-200'
        };
      case 'pending':
        return { 
          variant: 'secondary', 
          icon: Clock, 
          text: 'Pending Review', 
          className: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-md',
          cardGradient: 'from-amber-50 to-orange-50/30',
          borderColor: 'border-amber-200'
        };
      case 'under_review':
        return { 
          variant: 'outline', 
          icon: AlertTriangle, 
          text: 'Under Review', 
          className: 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white border-0 shadow-md',
          cardGradient: 'from-blue-50 to-cyan-50/30',
          borderColor: 'border-blue-200'
        };
      default:
        return { 
          variant: 'secondary', 
          icon: FileText, 
          text: 'Not Submitted', 
          className: 'bg-gradient-to-r from-gray-500 to-slate-500 hover:from-gray-600 hover:to-slate-600 text-white border-0 shadow-md',
          cardGradient: 'from-gray-50 to-slate-50/30',
          borderColor: 'border-gray-200'
        };
    }
  };

  // Handle view abstract
  const handleView = (team) => {
    setSelectedTeam(team);
    setViewDialogOpen(true);
  };

  // Handle action (approve/reject/revisions)
  const handleAction = (team, type) => {
    setSelectedTeam(team);
    setActionType(type);
    setFeedback('');
    setActionDialogOpen(true);
  };

  // Submit action
  const handleSubmitAction = async () => {
    if (!selectedTeam || !actionType) return;

    // Validate feedback for reject and revisions
    if ((actionType === 'reject' || actionType === 'revisions') && !feedback.trim()) {
      toast.error('Please provide feedback');
      return;
    }

    setSubmitting(true);

    try {
      const teamRef = doc(db, 'teams', selectedTeam.id);
      const updateData = {
        abstractStatus: actionType === 'approve' ? 'approved' : actionType === 'reject' ? 'rejected' : 'under_review',
        abstractFeedback: feedback.trim() || null,
        abstractReviewedAt: new Date(),
        abstractReviewedBy: userData.uid
      };

      await updateDoc(teamRef, updateData);

      toast.success(
        actionType === 'approve' 
          ? 'Abstract approved successfully' 
          : actionType === 'reject' 
          ? 'Abstract rejected' 
          : 'Revisions requested'
      );

      setActionDialogOpen(false);
      setFeedback('');
      setSelectedTeam(null);
      setActionType(null);
    } catch (error) {
      logger.error('Error updating abstract status:', error);
      toast.error('Failed to update abstract status');
    } finally {
      setSubmitting(false);
    }
  };

  // Compact row renderer
  const renderCompactRow = (team) => {
    const statusInfo = getStatusBadge(team.abstractStatus);
    const StatusIcon = statusInfo.icon;
    const statusColors = {
      pending: 'bg-orange-50 text-orange-700 border-orange-200',
      approved: 'bg-green-50 text-green-700 border-green-200',
      rejected: 'bg-red-50 text-red-700 border-red-200',
      under_review: 'bg-blue-50 text-blue-700 border-blue-200'
    };

    return (
      <div 
        key={team.id}
        className="flex items-center gap-3 p-2.5 bg-white border border-gray-200 rounded-lg hover:border-teal-300 hover:bg-teal-50/30 transition-colors group"
      >
        {/* Icon */}
        <div className={`${statusColors[team.abstractStatus] || 'bg-gray-50 text-gray-600'} p-2 rounded`}>
          <StatusIcon className="h-3.5 w-3.5" />
        </div>

        {/* Project Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-900 truncate">
              {team.projectTitle || 'Untitled Project'}
            </h4>
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-gray-50">
              #{team.projectNumber}
            </Badge>
          </div>
          <p className="text-xs text-gray-600 truncate">
            Project #{team.projectNumber} • {team.leaderName}
          </p>
        </div>

        {/* Status Badge */}
        <Badge className={`${statusColors[team.abstractStatus] || 'bg-gray-50 text-gray-700'} border text-[10px] h-5 px-2`}>
          {statusInfo.text}
        </Badge>

        {/* Submitted Date */}
        {team.abstractSubmittedAt && (
          <span className="text-[10px] text-gray-500 hidden md:block w-20 text-right">
            {format(team.abstractSubmittedAt.toDate(), 'MMM dd')}
          </span>
        )}

        {/* Actions */}
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 hover:bg-teal-100 hover:text-teal-700"
            onClick={() => {
              setSelectedTeam(team);
              setViewDialogOpen(true);
            }}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          
          {team.abstractStatus === 'pending' && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 hover:bg-green-100 hover:text-green-700"
                onClick={() => {
                  setSelectedTeam(team);
                  setActionType('approve');
                  setActionDialogOpen(true);
                }}
              >
                <CheckCircle className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 hover:bg-red-100 hover:text-red-700"
                onClick={() => {
                  setSelectedTeam(team);
                  setActionType('reject');
                  setActionDialogOpen(true);
                }}
              >
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  // Empty state renderer
  const renderEmptyState = (message) => (
    <div className="text-center py-12 text-gray-400">
      <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
      <p className="text-xs font-medium">{message}</p>
    </div>
  );

  // Render team card
  const renderTeamCard = (team) => {
    const statusInfo = getStatusBadge(team.abstractStatus);
    const StatusIcon = statusInfo.icon;

    return (
      <Card 
        key={team.id} 
        className={`
          border-2 ${statusInfo.borderColor}
          hover:shadow-2xl hover:shadow-${statusInfo.borderColor.split('-')[1]}-200/50
          transition-all duration-300 
          hover:-translate-y-1
          bg-gradient-to-br from-white via-white ${statusInfo.cardGradient ? `to-${statusInfo.cardGradient.split(' ')[0].replace('from-', '')}` : 'to-gray-50/20'}
          group
        `}
      >
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            {/* Left Section - Team Info */}
            <div className="flex-1 space-y-3">
              <div className="flex items-start gap-3">
                <div className={`
                  p-3 rounded-2xl
                  bg-gradient-to-br ${statusInfo.cardGradient}
                  shadow-md
                  transform transition-all duration-300
                  group-hover:scale-110 group-hover:rotate-6
                `}>
                  <FileText className={`h-6 w-6 ${statusInfo.borderColor.replace('border-', 'text-')}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-xl text-gray-900 group-hover:text-teal-700 transition-colors">
                    {team.projectTitle || 'Untitled Project'}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1 font-medium">
                    Project: <span className="font-semibold text-gray-800">#{team.projectNumber}</span> • 
                    <span className="text-teal-600 font-bold"> #{team.projectNumber}</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2 bg-gradient-to-r from-teal-50 to-emerald-50 px-3 py-1.5 rounded-full">
                  <Users className="h-4 w-4 text-teal-600" />
                  <span className="font-medium">{team.leaderName}</span>
                </div>
                {team.abstractSubmittedAt && (
                  <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-cyan-50 px-3 py-1.5 rounded-full">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">
                      {format(team.abstractSubmittedAt.toDate(), 'MMM dd, yyyy')}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <Badge className={`${statusInfo.className} px-3 py-1.5`}>
                  <StatusIcon className="h-4 w-4 mr-1.5" />
                  {statusInfo.text}
                </Badge>
              </div>

              {team.abstractFeedback && (
                <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl shadow-sm">
                  <p className="text-sm text-amber-900 font-medium">
                    <strong className="font-bold">Feedback:</strong> {team.abstractFeedback}
                  </p>
                </div>
              )}
            </div>

            {/* Right Section - Actions */}
            <div className="flex flex-col gap-2 md:min-w-[160px]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleView(team)}
                disabled={!team.abstractText && !team.abstractFileUrl}
                className="w-full border-2 hover:border-teal-400 hover:bg-gradient-to-r hover:from-teal-50 hover:to-emerald-50 hover:shadow-md transition-all duration-300 font-semibold"
              >
                <Eye className="h-4 w-4 mr-2" />
                View
              </Button>

              {team.abstractStatus === 'pending' || team.abstractStatus === 'under_review' ? (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleAction(team, 'approve')}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-md hover:shadow-lg transition-all duration-300 font-semibold"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(team, 'revisions')}
                    className="w-full border-2 border-blue-300 hover:border-blue-400 hover:bg-gradient-to-r hover:from-blue-50 hover:to-cyan-50 hover:shadow-md transition-all duration-300 font-semibold"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Revisions
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleAction(team, 'reject')}
                    className="w-full bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 shadow-md hover:shadow-lg transition-all duration-300 font-semibold"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Compact Header with Inline Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-teal-500 rounded-full" />
            <h2 className="text-lg font-semibold text-gray-900">Abstracts</h2>
            <Badge className="bg-gray-100 text-gray-700 text-xs">
              {teams.length} total
            </Badge>
          </div>
        </div>
        
        {/* Pill Filters */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="h-9 bg-gray-100 p-0.5 w-full justify-start">
            <TabsTrigger 
              value="all"
              className="text-xs h-8 px-3 data-[state=active]:bg-teal-600 data-[state=active]:text-white"
            >
              All ({teams.length})
            </TabsTrigger>
            <TabsTrigger 
              value="pending"
              className="text-xs h-8 px-3 data-[state=active]:bg-orange-600 data-[state=active]:text-white"
            >
              Pending ({filterTeams('pending').length})
            </TabsTrigger>
            <TabsTrigger 
              value="under_review"
              className="text-xs h-8 px-3 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              Review ({filterTeams('under_review').length})
            </TabsTrigger>
            <TabsTrigger 
              value="approved"
              className="text-xs h-8 px-3 data-[state=active]:bg-green-600 data-[state=active]:text-white"
            >
              Approved ({filterTeams('approved').length})
            </TabsTrigger>
            <TabsTrigger 
              value="rejected"
              className="text-xs h-8 px-3 data-[state=active]:bg-red-600 data-[state=active]:text-white"
            >
              Rejected ({filterTeams('rejected').length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-3 space-y-1">
            {teams.length === 0 ? renderEmptyState('No abstracts yet') : teams.map(team => renderCompactRow(team))}
          </TabsContent>

          <TabsContent value="pending" className="mt-3 space-y-1">
            {filterTeams('pending').length === 0 ? renderEmptyState('No pending abstracts') : filterTeams('pending').map(team => renderCompactRow(team))}
          </TabsContent>

          <TabsContent value="under_review" className="mt-3 space-y-1">
            {filterTeams('under_review').length === 0 ? renderEmptyState('No abstracts under review') : filterTeams('under_review').map(team => renderCompactRow(team))}
          </TabsContent>

          <TabsContent value="approved" className="mt-3 space-y-1">
            {filterTeams('approved').length === 0 ? renderEmptyState('No approved abstracts') : filterTeams('approved').map(team => renderCompactRow(team))}
          </TabsContent>

          <TabsContent value="rejected" className="mt-3 space-y-1">
            {filterTeams('rejected').length === 0 ? renderEmptyState('No rejected abstracts') : filterTeams('rejected').map(team => renderCompactRow(team))}
          </TabsContent>
        </Tabs>
      </div>

      {/* View Abstract Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Abstract - {selectedTeam?.projectTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Project: #{selectedTeam?.projectNumber} • Leader: {selectedTeam?.leaderName}
              </p>
            </div>
            {selectedTeam?.abstractText && (
              <div>
                <Label>Abstract Content</Label>
                <div className="mt-2 p-4 bg-gray-50 rounded-lg border">
                  <p className="whitespace-pre-wrap">{selectedTeam.abstractText}</p>
                </div>
              </div>
            )}
            {selectedTeam?.abstractFileUrl && (
              <div>
                <Label>Attached File</Label>
                <Button
                  variant="outline"
                  className="mt-2"
                  onClick={() => window.open(selectedTeam.abstractFileUrl, '_blank')}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View File
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Action Dialog (Approve/Reject/Revisions) */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' && 'Approve Abstract'}
              {actionType === 'reject' && 'Reject Abstract'}
              {actionType === 'revisions' && 'Request Revisions'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {actionType === 'approve' && 'Are you sure you want to approve this abstract?'}
              {actionType === 'reject' && 'Please provide a reason for rejection:'}
              {actionType === 'revisions' && 'Please provide feedback for revisions:'}
            </p>
            {(actionType === 'reject' || actionType === 'revisions') && (
              <div>
                <Label htmlFor="feedback">Feedback {actionType === 'revisions' ? '(Required)' : ''}</Label>
                <Textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Enter your feedback..."
                  rows={4}
                  className="mt-2"
                />
              </div>
            )}
            {actionType === 'approve' && (
              <div>
                <Label htmlFor="feedback">Feedback (Optional)</Label>
                <Textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Add any comments or suggestions..."
                  rows={3}
                  className="mt-2"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitAction}
              disabled={submitting}
              className={
                actionType === 'approve' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : actionType === 'reject' 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : ''
              }
            >
              {submitting ? 'Submitting...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

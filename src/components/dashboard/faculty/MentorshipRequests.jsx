// src/components/dashboard/faculty/MentorshipRequests.jsx - Premium Mobile-First UI
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSession } from '@/context/SessionContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { MentorshipService } from '@/services/mentorshipService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle,
  XCircle,
  MessageSquare,
  Users,
  Calendar,
  Clock,
  User,
  Mail,
  Hash,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { RevisionHistoryDialog } from '../shared/RevisionHistory';

import { logger } from "../../../lib/logger";
export default function MentorshipRequests() {
  const { userData } = useAuth();
  const { activeSession } = useSession();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionType, setActionType] = useState('');
  const [feedback, setFeedback] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    if (!userData?.uid) return;

    const requestsQuery = query(
      collection(db, 'mentorship_requests'),
      where('mentorEmail', '==', userData.email)
    );

    const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
      const requestsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));

      setRequests(requestsList.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    }, (error) => {
      if (error.code === 'permission-denied') {
        setRequests([]);
        setLoading(false);
      } else {
        logger.error('Error fetching mentorship requests:', error);
        toast.error('Failed to load mentorship requests');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [userData?.uid]);

  const handleAction = (request, action) => {
    setSelectedRequest(request);
    setActionType(action);
    setDialogOpen(true);
    setFeedback('');
  };

  const handleSubmitAction = async () => {
    if (!selectedRequest) return;

    if (actionType === 'revisions') {
      if (!feedback.trim() || feedback.trim().length < 10) {
        toast.error('Please provide detailed feedback (minimum 10 characters)');
        return;
      }
    }

    setProcessing(true);
    try {
      let result;

      if (actionType === 'approve') {
        result = await MentorshipService.acceptRequest(
          selectedRequest.id,
          activeSession?.id
        );
      } else if (actionType === 'reject') {
        result = await MentorshipService.rejectRequest(
          selectedRequest.id,
          feedback.trim() || undefined
        );
      } else if (actionType === 'revisions') {
        result = await MentorshipService.requestRevisions(
          selectedRequest.id,
          feedback.trim()
        );
      }

      if (result && result.success) {
        setDialogOpen(false);
        setSelectedRequest(null);
        setFeedback('');
      }
    } catch (error) {
      logger.error('Error processing request:', error);
      toast.error('Failed to process request');
    } finally {
      setProcessing(false);
    }
  };

  // Filter logic
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const approvedRequests = requests.filter(r => r.status === 'approved');
  const otherRequests = requests.filter(r => r.status !== 'pending' && r.status !== 'approved');

  const getFilteredRequests = () => {
    switch (activeFilter) {
      case 'pending': return pendingRequests;
      case 'approved': return approvedRequests;
      case 'other': return otherRequests;
      default: return requests;
    }
  };

  const filteredRequests = getFilteredRequests();

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton-card h-16" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card-faculty p-4 space-y-3 animate-shimmer">
              <div className="flex justify-between">
                <div className="space-y-2">
                  <div className="skeleton-faculty h-5 w-32" />
                  <div className="skeleton-faculty h-3 w-48" />
                </div>
                <div className="skeleton-faculty h-6 w-24 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header & Stats */}
        <div className="card-faculty-elevated p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-teal-500 to-emerald-500 p-2.5 rounded-xl text-white shadow-md">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Mentorship Requests</h1>
                <p className="text-sm text-gray-500">Review and manage student requests</p>
              </div>
            </div>
            {pendingRequests.length > 0 && (
              <Badge className="bg-amber-500 text-white px-3 py-1.5 text-sm font-semibold shadow-sm self-start sm:self-auto">
                {pendingRequests.length} pending
              </Badge>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {[
            { id: 'all', label: 'All', count: requests.length },
            { id: 'pending', label: 'Pending', count: pendingRequests.length, highlight: true },
            { id: 'approved', label: 'Approved', count: approvedRequests.length },
            { id: 'other', label: 'Other', count: otherRequests.length }
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all touch-target ${activeFilter === filter.id
                ? 'bg-teal-100 text-teal-700 shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
            >
              {filter.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeFilter === filter.id
                ? 'bg-teal-200 text-teal-800'
                : filter.highlight && filter.count > 0
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-600'
                }`}>
                {filter.count}
              </span>
            </button>
          ))}
        </div>

        {/* Request Cards */}
        {filteredRequests.length === 0 ? (
          <div className="empty-state py-12">
            <div className="empty-state-icon">
              {activeFilter === 'pending' ? <Clock className="h-8 w-8" /> : <Users className="h-8 w-8" />}
            </div>
            <h2 className="empty-state-title">
              {activeFilter === 'all' ? 'No Mentorship Requests' : `No ${activeFilter} requests`}
            </h2>
            <p className="empty-state-text">
              {activeFilter === 'all'
                ? 'When students request you as a mentor, their proposals will appear here.'
                : `You don't have any ${activeFilter} requests at the moment.`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((request, index) => (
              <RequestCard
                key={request.id}
                request={request}
                onAction={handleAction}
                isPending={request.status === 'pending'}
                animationDelay={index}
              />
            ))}
          </div>
        )}
      </div>

      {/* Action Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === 'approve' && <CheckCircle className="h-5 w-5 text-emerald-600" />}
              {actionType === 'reject' && <XCircle className="h-5 w-5 text-red-600" />}
              {actionType === 'revisions' && <MessageSquare className="h-5 w-5 text-blue-600" />}

              {actionType === 'approve' && 'Accept Mentorship'}
              {actionType === 'reject' && 'Decline Request'}
              {actionType === 'revisions' && 'Request Revisions'}
            </DialogTitle>
            {selectedRequest && (
              <DialogDescription className="mt-2">
                <strong>Project #{selectedRequest.projectNumber}</strong>
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4">
            {selectedRequest && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div>
                  <h4 className="font-medium text-gray-900 text-sm mb-1">Project Title</h4>
                  <p className="text-sm text-gray-700 break-words">{selectedRequest.projectTitle}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 text-sm mb-1">Abstract</h4>
                  <ScrollArea className="h-24 w-full border rounded-lg p-2 bg-white">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words overflow-wrap-anywhere">
                      {selectedRequest.projectAbstract}
                    </p>
                  </ScrollArea>
                </div>
              </div>
            )}

            {actionType === 'reject' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">
                  Reason for Declining (Optional)
                </label>
                <Textarea
                  placeholder="Explain why you cannot mentor this team..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={4}
                  className="resize-none max-h-28 md:max-h-32"
                  maxLength={500}
                />
                <p className="text-xs text-gray-500">{feedback.length}/500</p>
              </div>
            )}

            {actionType === 'revisions' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">
                  Feedback for Revisions <span className="text-red-500">*</span>
                </label>
                <Textarea
                  placeholder="Provide detailed feedback on what needs improvement..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={5}
                  className="resize-none max-h-36 md:max-h-44"
                  maxLength={1000}
                />
                <div className="flex justify-between text-xs">
                  <span className={feedback.length < 10 ? 'text-red-500' : 'text-gray-500'}>
                    {feedback.length}/1000 (min 10)
                  </span>
                  {feedback.length >= 10 && (
                    <span className="text-emerald-600">✓ Ready</span>
                  )}
                </div>
                <div className="bg-blue-50 text-blue-700 text-xs p-2.5 rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  The team will revise based on your feedback and resubmit.
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={processing}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitAction}
              disabled={processing || (actionType === 'revisions' && feedback.trim().length < 10)}
              className={`w-full sm:w-auto ${actionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' :
                actionType === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-blue-600 hover:bg-blue-700'
                }`}
            >
              {processing ? "Processing..." :
                actionType === 'approve' ? 'Accept & Mentor' :
                  actionType === 'reject' ? 'Decline' :
                    'Send Feedback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Premium Request Card Component
function RequestCard({ request, onAction, isPending, animationDelay = 0 }) {
  const [expanded, setExpanded] = useState(false);

  const getStatusConfig = (status) => {
    const configs = {
      pending: {
        className: 'status-pending',
        icon: Clock,
        label: 'Pending'
      },
      approved: {
        className: 'status-success',
        icon: CheckCircle,
        label: 'Approved'
      },
      rejected: {
        className: 'status-danger',
        icon: XCircle,
        label: 'Declined'
      },
      revisions_requested: {
        className: 'status-info',
        icon: MessageSquare,
        label: 'Revisions'
      }
    };
    return configs[status] || configs.pending;
  };

  const config = getStatusConfig(request.status);
  const StatusIcon = config.icon;

  return (
    <div
      className={`card-faculty overflow-hidden transition-all animate-fade-in-up ${isPending ? 'border-l-4 border-l-amber-400' : ''
        }`}
      style={{ animationDelay: `${animationDelay * 50}ms` }}
    >
      {/* Main Row - Always Visible */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Project Icon */}
        <div className={`${isPending ? 'bg-amber-50 text-amber-600' : 'bg-teal-50 text-teal-600'} p-2.5 rounded-xl shrink-0`}>
          <FileText className="h-5 w-5" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-semibold text-gray-900 truncate">
              Project #{request.projectNumber}
            </h3>
            {(request.revisionVersion > 0 || request.isResubmission) && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-blue-50 text-blue-600 border-blue-200">
                v{request.revisionVersion || 0}
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-500 truncate">
            {request.requestedByName} • {formatDistanceToNow(request.createdAt, { addSuffix: true })}
          </p>
        </div>

        {/* Status & Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={`${config.className} text-[11px] h-6 px-2.5`}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3 animate-fade-in-up">
          {/* Contact Info */}
          <div className="flex flex-wrap gap-3 text-sm text-gray-600">
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {request.requestedByName}
            </div>
            <div className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              <span className="truncate max-w-[200px]">{request.requestedByEmail}</span>
            </div>
          </div>

          {/* Project Title */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Project Title</h4>
            <p className="text-sm text-gray-800 break-words">{request.projectTitle}</p>
          </div>

          {/* Abstract */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Abstract</h4>
            <ScrollArea className="h-24 w-full border border-gray-100 rounded-lg p-3 bg-gray-50/50">
              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words overflow-wrap-anywhere">
                {request.projectAbstract}
              </p>
            </ScrollArea>
          </div>

          {/* Feedback if exists */}
          {(request.feedback || request.revisionFeedback) && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {request.status === 'revisions_requested' ? 'Revision Feedback' : 'Your Feedback'}
              </h4>
              <p className="text-sm text-blue-700 break-words whitespace-pre-wrap">{request.revisionFeedback || request.feedback}</p>
            </div>
          )}

          {/* Actions */}
          {isPending && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              <Button
                size="sm"
                onClick={() => onAction(request, 'approve')}
                className="btn-faculty text-sm h-9"
              >
                <CheckCircle className="h-4 w-4 mr-1.5" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction(request, 'revisions')}
                className="btn-faculty-outline text-sm h-9 text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <MessageSquare className="h-4 w-4 mr-1.5" />
                Revisions
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction(request, 'reject')}
                className="text-sm h-9 text-red-600 border-red-200 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4 mr-1.5" />
                Decline
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

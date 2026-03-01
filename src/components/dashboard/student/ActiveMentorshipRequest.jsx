// src/components/dashboard/student/ActiveMentorshipRequest.jsx
"use client";

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { User, FileText, Mail, Clock, AlertCircle, XCircle } from 'lucide-react';
import { MentorshipService } from '@/services/mentorshipService';
import { toast } from 'sonner';

import { logger } from "../../../lib/logger";
/**
 * ActiveMentorshipRequest Component
 * 
 * Displays the currently pending mentorship request with:
 * - Mentor details (name, email)
 * - Project title and abstract
 * - Request timestamp
 * - Withdraw request functionality
 * 
 * @param {Object} request - The mentorship request object
 * @param {Function} onWithdraw - Callback after successful withdrawal
 */
export default function ActiveMentorshipRequest({ request, onWithdraw }) {
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  if (!request) {
    return null;
  }

  const handleWithdrawRequest = async () => {
    setWithdrawing(true);
    try {
      const result = await MentorshipService.cancelRequest(request.id);
      
      if (result.success) {
        setWithdrawDialogOpen(false);
        
        // Call the callback to refresh parent component
        if (onWithdraw) {
          onWithdraw();
        }
      }
    } catch (error) {
      logger.error('Error withdrawing request:', error);
      toast.error('Failed to withdraw request');
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <>
      <Card className="border-yellow-200 bg-yellow-50/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-lg">Mentorship Request Pending</CardTitle>
            </div>
            <Badge variant="outline" className="border-yellow-600 text-yellow-600">
              <Clock className="h-3 w-3 mr-1" />
              Awaiting Response
            </Badge>
          </div>
          <CardDescription>
            Your mentorship request is currently under review
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Alert Info */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You can only have one pending request at a time. Withdraw this request if you want to select a different mentor.
            </AlertDescription>
          </Alert>

          <Separator />

          {/* Mentor Information */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Requested Mentor
            </h4>
            <div className="bg-white p-3 rounded-lg border space-y-1">
              <p className="font-semibold">{request.mentorName}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {request.mentorEmail}
              </p>
            </div>
          </div>

          <Separator />

          {/* Project Details */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Project Details
            </h4>
            <div className="space-y-3">
              <div className="bg-white p-3 rounded-lg border">
                <span className="text-xs text-muted-foreground font-medium uppercase">Project Title</span>
                <p className="mt-1 text-sm font-medium">{request.projectTitle}</p>
              </div>
              
              <div className="bg-white p-3 rounded-lg border">
                <span className="text-xs text-muted-foreground font-medium uppercase">Abstract</span>
                <ScrollArea className="h-32 w-full mt-2">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap pr-4">
                    {request.projectAbstract}
                  </p>
                </ScrollArea>
              </div>
            </div>
          </div>

          <Separator />

          {/* Request Metadata */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Request sent on {request.createdAt?.toLocaleDateString()}</span>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <Button 
              variant="destructive" 
              className="w-full flex items-center gap-2"
              onClick={() => setWithdrawDialogOpen(true)}
            >
              <XCircle className="h-4 w-4" />
              Withdraw Request
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw Mentorship Request?</DialogTitle>
            <DialogDescription>
              Are you sure you want to withdraw your mentorship request to {request.mentorName}? 
              This action cannot be undone, and you will need to send a new request if you change your mind.
            </DialogDescription>
          </DialogHeader>
          
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              After withdrawal, you can select a different mentor and send a new request.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setWithdrawDialogOpen(false)}
              disabled={withdrawing}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleWithdrawRequest}
              disabled={withdrawing}
            >
              {withdrawing ? "Withdrawing..." : "Withdraw Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// components/dashboard/SelectMentor.jsx
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useSession } from '@/context/SessionContext';
import { MentorshipService } from '@/services/mentorshipService';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';

import { logger } from "../../../lib/logger";
export default function SelectMentor({ onCancel, team, hasPendingRequest = false }) {
  const { userData } = useAuth();
  const { activeSession } = useSession();
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [projectTitle, setProjectTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const fetchMentors = async () => {
      const q = query(collection(db, "users"), where("role", "==", "faculty"));
      const querySnapshot = await getDocs(q);
      const mentorsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMentors(mentorsList);
      setLoading(false);
    };
    fetchMentors();
  }, []);

  const handleRequestMentor = async (mentor) => {
    // Check if team already has a pending request
    if (hasPendingRequest) {
      toast.error("You already have a pending mentorship request", {
        description: "Please withdraw your current request before sending a new one"
      });
      return;
    }
    
    // Double-check with the service
    const existingRequest = await MentorshipService.getTeamRequest(userData.teamId);
    if (existingRequest) {
      toast.error("You already have a pending mentorship request", {
        description: "Please withdraw your current request before sending a new one"
      });
      return;
    }
    
    setSelectedMentor(mentor);
    
    // Auto-populate from saved project details if available
    if (team?.projectTitle) {
      setProjectTitle(team.projectTitle);
    }
    if (team?.projectAbstract) {
      setAbstract(team.projectAbstract);
    }
    
    setDialogOpen(true);
  };

  const handleSubmitRequest = async () => {
    if (!userData?.teamId) {
      toast.error("You are not in a team.");
      return;
    }

    if (!projectTitle.trim() || !abstract.trim()) {
      toast.error("Please fill in both project title and abstract.");
      return;
    }

    if (!activeSession) {
      toast.error("No active session found.");
      return;
    }

    setSubmitting(true);
    try {
      // Use mentorship service to send request
      const result = await MentorshipService.sendRequest({
        teamId: userData.teamId,
        teamName: `Project ${userData.projectNumber || team?.projectNumber}`,
        projectNumber: userData.projectNumber || team?.projectNumber,
        mentorId: selectedMentor.uid,
        mentorEmail: selectedMentor.email,
        mentorName: selectedMentor.name || selectedMentor.email,
        projectTitle: projectTitle.trim(),
        projectAbstract: abstract.trim(),
        sessionId: activeSession.id,
        teamMembers: team?.members || [userData.email]
      });

      if (result.success) {
        // Close dialog and refresh
        setDialogOpen(false);
        setProjectTitle("");
        setAbstract("");
        setSelectedMentor(null);
        
        // Optionally close the mentor selection view
        if (onCancel) {
          onCancel();
        }
      }
    } catch (error) {
      logger.error('Error sending mentorship request:', error);
      // Error toast is handled by service
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p>Loading available mentors...</p>;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Select Your Mentor</CardTitle>
              <CardDescription>Choose a faculty member to guide your project.</CardDescription>
            </div>
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasPendingRequest && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You already have a pending mentorship request. Please withdraw it before selecting a different mentor.
              </AlertDescription>
            </Alert>
          )}
          {mentors.map(mentor => (
            <div key={mentor.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-semibold">{mentor.name}</p>
                <p className="text-sm text-muted-foreground">{mentor.email}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {mentor.expertise?.map(exp => (
                    <span key={exp} className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded-full">{exp}</span>
                  ))}
                </div>
              </div>
              <Button 
                onClick={() => handleRequestMentor(mentor)}
                disabled={hasPendingRequest}
              >
                Request
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Mentorship Request Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Send Mentorship Request</DialogTitle>
            <DialogDescription>
              Provide your project details to send a mentorship request to {selectedMentor?.name}.
              {(team?.projectTitle || team?.projectAbstract) && (
                <span className="block mt-2 text-green-600 text-xs">
                  ✓ Auto-filled from saved project details
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="project-title">Project Title</Label>
              <Input
                id="project-title"
                placeholder="Enter your project title"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="abstract">Abstract</Label>
              <Textarea
                id="abstract"
                placeholder="Provide a brief abstract of your project (minimum 100 words)"
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                rows={6}
                required
                className="max-h-40 md:max-h-48 resize-y"
              />
              <p className="text-xs text-muted-foreground">
                {abstract.length} characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitRequest} disabled={submitting}>
              {submitting ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

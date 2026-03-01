"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSession } from '@/context/SessionContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { TeamInvitationService } from '@/services/teamInvitationService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from 'sonner';
import { Users, UserPlus, AlertCircle, Sparkles, ArrowRight, LogOut } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

import { logger } from "../../../lib/logger";
/**
 * TeamCreationGuard Component
 * 
 * Forces students to create or join a team before accessing the dashboard.
 * Shows a non-dismissible modal dialog if student has no teamId.
 * 
 * Features:
 * - Create new team (becomes leader)
 * - Join existing team via team code
 * - Auto-assigns project number
 * - Integrates with active session
 * - Cannot be closed until team is created/joined
 * - Optional: Redirect to student dashboard after team creation
 */
export default function TeamCreationGuard({ children, redirectToStudentDashboard = false }) {
  const router = useRouter();
  const { userData, user } = useAuth();
  const { activeSession } = useSession();
  const [showDialog, setShowDialog] = useState(false);
  const [mode, setMode] = useState('choice'); // 'choice', 'create', 'join'
  const [loading, setLoading] = useState(false);

  // Create team form state
  const [teamName, setTeamName] = useState('');
  const [projectTitle, setProjectTitle] = useState('');

  // Join team form state
  const [teamCode, setTeamCode] = useState('');

  // Check if student needs to create/join a team
  useEffect(() => {

    if (userData && userData.role === 'student') {
      if (!userData.teamId) {
        setShowDialog(true);
      } else {
        setShowDialog(false);
        // If redirectToStudentDashboard is true and student has a team, redirect
        if (redirectToStudentDashboard) {
          router.push('/dashboard/student');
        }
      }
    }
  }, [userData, activeSession, userData?.teamId, redirectToStudentDashboard, router]);

  // Get next project number using Firestore transaction (ensures sequential numbering)
  const getNextProjectNumber = async (sessionId) => {
    try {
      return await runTransaction(db, async (transaction) => {
        // Use a counter document for atomic increments
        const counterRef = doc(db, 'counters', `session_${sessionId}_project_numbers`);
        const counterDoc = await transaction.get(counterRef);

        let nextNumber;
        if (!counterDoc.exists()) {
          // Initialize counter
          nextNumber = 1;
          transaction.set(counterRef, {
            sessionId,
            currentNumber: nextNumber,
            updatedAt: serverTimestamp()
          });
        } else {
          // Increment counter
          nextNumber = counterDoc.data().currentNumber + 1;
          transaction.update(counterRef, {
            currentNumber: nextNumber,
            updatedAt: serverTimestamp()
          });
        }

        return nextNumber;
      });
    } catch (error) {
      logger.error('Error getting project number:', error);
      throw error;
    }
  };

  // Create new team
  const handleCreateTeam = async (e) => {
    e.preventDefault();

    if (!teamName.trim() || !projectTitle.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!activeSession?.id) {
      toast.error('No active session found. Please contact admin.');
      return;
    }

    setLoading(true);
    try {
      // Get next project number
      const projectNumber = await getNextProjectNumber(activeSession.id);

      // Generate team code (first 3 letters of team name + 4 random digits)
      const teamCode = (teamName.slice(0, 3).toUpperCase() + Math.floor(1000 + Math.random() * 9000));

      // Create team document
      const teamData = {
        name: teamName.trim(),
        projectTitle: projectTitle.trim(),
        projectNumber,
        teamCode,
        sessionId: activeSession.id,
        sessionName: activeSession.name,
        leaderId: user.uid,
        leaderName: userData.name,
        leaderEmail: user.email,
        members: [user.email],
        memberDetails: [{
          email: user.email,
          name: userData.name,
          uid: user.uid,
          joinedAt: new Date()
        }],
        mentorId: null,
        mentorName: null,
        mentorEmail: null,
        panelId: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const teamRef = await addDoc(collection(db, 'teams'), teamData);

      // Update user document with teamId
      const userRef = doc(db, 'users', user.email);
      await updateDoc(userRef, {
        teamId: teamRef.id,
        projectNumber,
        updatedAt: serverTimestamp()
      });


      toast.success('Team created successfully!', {
        description: `Your team code is: ${teamCode}. Loading your dashboard...`
      });

      // The dialog will close automatically when userData updates via the useEffect
      // The real-time listener in AuthContext will pick up the teamId change

    } catch (error) {
      logger.error('Error creating team:', error);
      toast.error('Failed to create team', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  // Request to join existing team (sends invitation to team leader)
  const handleJoinTeam = async (e) => {
    e.preventDefault();


    if (!teamCode.trim()) {
      toast.error('Please enter a team code');
      return;
    }

    if (!activeSession?.id) {
      toast.error('No active session found. Please contact admin.');
      return;
    }

    setLoading(true);
    try {
      const result = await TeamInvitationService.requestToJoin(
        teamCode.trim(),
        user.email,
        userData.name,
        user.uid,
        activeSession.id
      );


      if (result.success) {
        // Don't close dialog yet - student needs to wait for approval
        setTeamCode('');
        setMode('choice');
        toast.success('Join request sent! 📨', {
          description: 'You will be notified when the team leader responds to your request.'
        });
      } else {
        // Show appropriate message based on error type
        if (result.message.includes('already have a pending request')) {
          toast.info('Request Already Sent', {
            description: 'Your join request is pending. Wait for the team leader to respond.'
          });
          setMode('choice');
        } else {
          toast.error('Failed to join team', {
            description: result.message || 'Please check the team code and try again.'
          });
        }
      }
    } catch (error) {
      logger.error('Error requesting to join team:', error);
      toast.error('Error sending join request', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  // If not a student or already has team, render children normally
  if (!showDialog) {
    return <>{children}</>;
  }

  // Render blocking dialog for team creation/joining
  return (
    <>
      {/* Blur background content */}
      <div className="blur-sm pointer-events-none">
        {children}
      </div>

      {/* Non-dismissible dialog */}
      <Dialog open={showDialog} onOpenChange={() => { }}>
        <DialogContent className="max-w-2xl" showCloseButton={false}>
          <DialogHeader>
            <div className="flex justify-between items-start">
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <Sparkles className="h-6 w-6 text-blue-600" />
                Welcome to Final Year Portal!
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    await signOut(auth);
                    window.location.href = '/login';
                  } catch (error) {
                    toast.error("Logout failed");
                  }
                }}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
            <DialogDescription className="text-base">
              To get started, you need to create a new team or join an existing one.
            </DialogDescription>
          </DialogHeader>

          {/* Warning if no active session */}
          {!activeSession && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>No Active Session</strong><br />
                An academic session must be created by an administrator before you can create or join teams.
                Please contact your administrator.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-6 py-4">
            {mode === 'choice' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Create Team Card */}
                <Card
                  className="cursor-pointer hover:border-blue-500 hover:shadow-lg transition-all duration-200 group"
                  onClick={() => setMode('create')}
                >
                  <CardContent className="pt-6 pb-6 text-center space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                      <Users className="h-8 w-8 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Create New Team</h3>
                      <p className="text-sm text-gray-600">
                        Start a new team and become the team leader. You'll get a team code to share with others.
                      </p>
                    </div>
                    <Button
                      className="w-full group-hover:bg-blue-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMode('create');
                      }}
                    >
                      Create Team
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>

                {/* Join Team Card */}
                <Card
                  className="cursor-pointer hover:border-green-500 hover:shadow-lg transition-all duration-200 group"
                  onClick={() => setMode('join')}
                >
                  <CardContent className="pt-6 pb-6 text-center space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                      <UserPlus className="h-8 w-8 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Join Existing Team</h3>
                      <p className="text-sm text-gray-600">
                        Enter a team code provided by your team leader to join their team.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full group-hover:border-green-600 group-hover:text-green-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMode('join');
                      }}
                    >
                      Join Team
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {mode === 'create' && (
              <form onSubmit={handleCreateTeam} className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    As the team creator, you will automatically become the <strong>Team Leader</strong>. Share your team code with up to 3 other members.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="teamName">
                    Team Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="teamName"
                    placeholder="e.g., Tech Innovators"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    required
                    maxLength={50}
                  />
                  <p className="text-xs text-gray-500">{teamName.length}/50 characters</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="projectTitle">
                    Project Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="projectTitle"
                    placeholder="e.g., AI-Powered Healthcare System"
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    required
                    maxLength={100}
                  />
                  <p className="text-xs text-gray-500">{projectTitle.length}/100 characters</p>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMode('choice')}
                    disabled={loading}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? 'Creating...' : 'Create Team'}
                  </Button>
                </div>
              </form>
            )}

            {mode === 'join' && (
              <form onSubmit={handleJoinTeam} className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Ask your team leader for the <strong>team code</strong>. Your join request will be sent to the team leader for approval.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="teamCode">
                    Team Code <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="teamCode"
                    placeholder="e.g., TEC1234"
                    value={teamCode}
                    onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                    required
                    maxLength={10}
                    className="uppercase font-mono text-lg tracking-wider"
                  />
                  <p className="text-xs text-gray-500">
                    Enter the code exactly as provided by your team leader
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMode('choice')}
                    disabled={loading}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? 'Joining...' : 'Join Team'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

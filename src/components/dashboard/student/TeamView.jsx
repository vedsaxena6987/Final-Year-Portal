// src/components/dashboard/TeamView.jsx (Corrected and Finalized)
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from "@/context/AuthContext";
import { useSession } from "@/context/SessionContext";
import { useTeamData } from "@/hooks/useTeamData";
import { usePhases } from "@/hooks/usePhases";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

// Import all necessary child components
import PendingInvitations from './PendingInvitations';
import SelectMentor from './SelectMentor';
import MentorshipStatus from './MentorshipStatus';
import PhaseCardWithSubmission from './PhaseCardWithSubmission';
import AddMemberForm from '../AddMemberForm'; // This is in the main dashboard folder
import MyGrades from './MyGrades';
import ProjectDetails from './ProjectDetails';
import PhasesList from '../shared/PhasesList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


export default function TeamView() {
  const { userData } = useAuth();
  const { activeSession } = useSession();
  const { team, members, loading: teamLoading } = useTeamData();
  const { phases, loading: phasesLoading } = usePhases();

  // Show skeleton loaders while data is being fetched
  if (teamLoading || phasesLoading) {
    return (
        <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
                <Card>
                    <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                    <CardContent><Skeleton className="h-20 w-full" /></CardContent>
                </Card>
            </div>
            <div className="lg:col-span-2">
                <Card>
                    <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
                    <CardContent><Skeleton className="h-40 w-full" /></CardContent>
                </Card>
            </div>
        </div>
    );
  }

  if (!team) {
    return <p>Could not find your team details. Please contact an administrator.</p>;
  }

  const isLeader = userData?.uid === team.leaderId;

  const renderWorkflowContent = () => {
    if (!team || !userData?.teamId) return null;

    // Stage 1: Mentor Selection and Approval Process
    if (!team.mentorId) {
      // Use the new MentorshipStatus component to handle all mentor-related states
      return <MentorshipStatus team={team} />;
    }

    // Stage 2: Dynamic Phases
    if (phases.length > 0) {
      const submittedPhaseIds = team.submittedPhaseIds || [];
      const nextPhase = phases.find(p => !submittedPhaseIds.includes(p.id));

      if (nextPhase) {
        return isLeader ? 
          <PhaseCardWithSubmission 
            phase={nextPhase}
            teamId={userData.teamId}
            teamName={team.name}
            team={team}
            isLeader={true}
            index={0}
          /> : 
          <Card><CardHeader><CardTitle>Next Task: {nextPhase.title}</CardTitle></CardHeader><CardContent><p>Your team leader needs to submit the materials for this phase.</p></CardContent></Card>;
      }
    }

    // Stage 3: All Phases Complete
    return <Card><CardHeader><CardTitle>All Phases Complete!</CardTitle></CardHeader><CardContent><p>Congratulations! You are now ready for the final report submission.</p></CardContent></Card>;
  };

  return (
    <Tabs defaultValue="workflow" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="workflow">Project Workflow</TabsTrigger>
            <TabsTrigger value="phases">Phases</TabsTrigger>
            <TabsTrigger value="details">Project Details</TabsTrigger>
            <TabsTrigger value="grades">My Grades</TabsTrigger>
        </TabsList>
        <TabsContent value="workflow" className="mt-4">
            <div className="space-y-6">
              {/* Show pending join requests for team leader */}
              {isLeader && <PendingInvitations teamId={userData?.teamId} />}
              
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                  <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      Project #{team.projectNumber || 'N/A'}
                    </CardTitle>
                    <CardDescription>Members ({members.length} / 4)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {members.map(member => (
                        <li key={member.uid} className="flex items-center justify-between p-2 rounded-md bg-slate-50">
                          <span>{member.name}</span>
                          {member.uid === team.leaderId && <span className="text-xs font-bold text-primary">Leader</span>}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                  {isLeader && members.length < 4 && team.teamCode && (
                    <Card className="border-blue-200 bg-blue-50/30">
                      <CardHeader>
                        <CardTitle className="text-base">Share Team Code</CardTitle>
                        <CardDescription>Share this code with students who want to join</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 bg-white px-4 py-3 rounded-md font-mono text-lg font-bold text-center border-2 border-blue-300">
                            {team.teamCode}
                          </code>
                        </div>
                        <p className="text-xs text-gray-600 mt-2 text-center">
                          {4 - members.length} slot{4 - members.length !== 1 ? 's' : ''} remaining
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
                <div className="lg:col-span-2">
                  {renderWorkflowContent()}
                </div>
              </div>
            </div>
        </TabsContent>
        <TabsContent value="phases" className="mt-4">
            <PhasesList view="student" teamId={userData?.teamId} />
        </TabsContent>
        <TabsContent value="details" className="mt-4">
            <ProjectDetails team={{ id: userData?.teamId, ...team }} />
        </TabsContent>
        <TabsContent value="grades" className="mt-4">
            <MyGrades />
        </TabsContent>
    </Tabs>
  );
}

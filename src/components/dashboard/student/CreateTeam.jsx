// components/dashboard/CreateTeam.jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { useSession } from "@/context/SessionContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, writeBatch, runTransaction } from "firebase/firestore";
import { toast } from "sonner";

import { logger } from "../../../lib/logger";
export default function CreateTeam() {
  const { user, userData } = useAuth(); // Get both user and userData
  const { activeSession } = useSession(); // Get active session
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!teamName.trim()) {
      toast.error("Please enter a team name.");
      return;
    }
    if (!user || !userData) {
      toast.error("You must be logged in to create a team.");
      return;
    }
    if (!activeSession) {
      toast.error("No active session found. Please contact administrator.");
      return;
    }

    setLoading(true);

    try {
      // Use a transaction to ensure atomic operations and get next project number
      const result = await runTransaction(db, async (transaction) => {
        // 1. Get the current project counter
        const counterRef = doc(db, "counters", "projectNumber");
        const counterDoc = await transaction.get(counterRef);
        
        let nextProjectNumber = 1;
        if (counterDoc.exists()) {
          nextProjectNumber = counterDoc.data().value + 1;
        }

        // 2. Update the counter
        if (counterDoc.exists()) {
          transaction.update(counterRef, { value: nextProjectNumber });
        } else {
          transaction.set(counterRef, { value: nextProjectNumber });
        }

        // 3. Create the new team document
        const teamRef = doc(collection(db, "teams"));
        transaction.set(teamRef, {
          name: teamName,
          projectNumber: nextProjectNumber,
          leaderId: userData.uid, // Use UID from userData for team leadership
          members: [user.email], // Use email for member references
          sessionId: activeSession.id, // Link to active session
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // 4. Update the user's document with the new teamId and projectNumber
        const userRef = doc(db, "users", user.email);
        transaction.update(userRef, { 
          teamId: teamRef.id,
          projectNumber: nextProjectNumber 
        });

        return { teamId: teamRef.id, projectNumber: nextProjectNumber };
      });
      
      toast.success(`Team "${teamName}" created successfully! Project Number: ${result.projectNumber}`, {
        description: 'Your dashboard will update automatically.'
      });
      
      // Don't redirect - the real-time listener will automatically update userData
      // which will trigger the parent component to show the team dashboard
      
    } catch (error) {
      logger.error("Error creating team: ", error);
      toast.error("Failed to create team. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Create a New Team</CardTitle>
        <CardDescription>
          You are not currently in a team. Create one to get started.
          <br />
          <span className="text-xs text-muted-foreground">
            Your team will be automatically assigned a project number.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreateTeam}>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="team-name">Team Name</Label>
              <Input 
                id="team-name" 
                placeholder="e.g., The Innovators" 
                required 
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Team"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

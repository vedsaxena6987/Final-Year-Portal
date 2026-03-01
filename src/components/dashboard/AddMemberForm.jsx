// components/dashboard/AddMemberForm.jsx
"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion, writeBatch } from 'firebase/firestore';
import { toast } from 'sonner';

export default function AddMemberForm({ teamId, currentMemberCount, projectNumber }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const MAX_MEMBERS = 4;
  const ALLOWED_DOMAINS = ["gehu.ac.in", "geu.ac.in"];

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (currentMemberCount >= MAX_MEMBERS) {
      toast.error("Team is full", { description: `You cannot add more than ${MAX_MEMBERS} members.` });
      return;
    }

    // Validate email domain
    const emailDomain = email.split('@')[1];
    if (!ALLOWED_DOMAINS.includes(emailDomain)) {
      toast.error("Invalid Email Domain", {
        description: `You can only add members with @gehu.ac.in or @geu.ac.in email addresses.`,
      });
      return;
    }

    setLoading(true);
    try {
      // 1. Check if user exists with this email (using email as document ID)
      const userRef = doc(db, "users", email);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error("No user found with this email.");
      }

      const userData = userDoc.data();

      // 2. Run validations
      if (userData.teamId) {
        throw new Error("This user is already in a team.");
      }

      // 3. Add the user to the team using a batch write
      const batch = writeBatch(db);
      const teamRef = doc(db, "teams", teamId);
      batch.update(teamRef, { members: arrayUnion(email) }); // Use email instead of UID

      const userDocRef = doc(db, "users", email); // Use email as document ID
      batch.update(userDocRef, {
        teamId: teamId,
        projectNumber: projectNumber // Assign the same project number as the team
      });

      await batch.commit();

      toast.success(`Member added successfully! Project Number: ${projectNumber}`);
      setEmail("");

    } catch (error) {
      toast.error("Failed to add member", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New Member</CardTitle>
        <CardDescription>Enter the college email of the student you want to add.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleAddMember}>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="member-email">Student Email</Label>
              <Input
                id="member-email"
                type="email"
                placeholder="name@gehu.ac.in or name@geu.ac.in"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Member"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

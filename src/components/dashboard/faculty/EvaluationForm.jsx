// components/dashboard/EvaluationForm.jsx
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export default function EvaluationForm({ submission, open, onOpenChange }) {
  const { user } = useAuth();
  const [grades, setGrades] = useState({});
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!submission) return;

    const fetchMembers = async () => {
      const memberPromises = submission.team.members.map(memberId =>
        getDoc(doc(db, 'users', memberId))
      );
      const memberDocs = await Promise.all(memberPromises);
      const memberData = memberDocs.map(doc => doc.data());
      setMembers(memberData);
    };
    fetchMembers();
  }, [submission]);

  const handleGradeChange = (studentId, field, value) => {
    setGrades(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
  };

  const handleSubmitGrades = async () => {
    setLoading(true);
    try {
        const batch = writeBatch(db);

        // 1. Create a grade document for each student
        members.forEach(member => {
            const gradeData = grades[member.uid];
            if (gradeData && gradeData.marks) {
                const gradeRef = doc(collection(db, "grades"));
                batch.set(gradeRef, {
                    submissionId: submission.id,
                    teamId: submission.teamId,
                    phaseId: submission.phaseId,
                    studentId: member.uid,
                    evaluatorId: user.uid,
                    marks: Number(gradeData.marks),
                    remarks: gradeData.remarks || "",
                    evaluatedAt: serverTimestamp(),
                });
            }
        });

        // 2. Update the submission's status
        const subRef = doc(db, "submissions", submission.id);
        batch.update(subRef, { status: "graded" });

        await batch.commit();
        toast.success("Grades submitted successfully!");
        onOpenChange(false);
    } catch (error) {
        toast.error("Failed to submit grades.", { description: error.message });
    } finally {
        setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Evaluate: {submission?.team?.name} - "{submission?.phase?.title}"</DialogTitle>
                <DialogDescription>
                    Enter marks for each student out of a maximum of {submission?.phase?.maxMarks}.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
                {members.map(member => (
                    <div key={member.uid} className="p-4 border rounded-md grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                        <div className="font-semibold">{member.name}<br/><span className="text-xs text-muted-foreground">{member.email}</span></div>
                        <div className="space-y-2">
                            <Label htmlFor={`marks-${member.uid}`}>Marks</Label>
                            <Input 
                                id={`marks-${member.uid}`} 
                                type="number" 
                                max={submission?.phase?.maxMarks} 
                                min={0}
                                onChange={(e) => handleGradeChange(member.uid, 'marks', e.target.value)}
                            />
                            <Label htmlFor={`remarks-${member.uid}`}>Remarks (Optional)</Label>
                            <Textarea 
                                id={`remarks-${member.uid}`}
                                onChange={(e) => handleGradeChange(member.uid, 'remarks', e.target.value)}
                                className="max-h-16 md:max-h-20 resize-none"
                            />
                        </div>
                    </div>
                ))}
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                <Button onClick={handleSubmitGrades} disabled={loading}>{loading ? "Submitting..." : "Submit Grades"}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  )
}

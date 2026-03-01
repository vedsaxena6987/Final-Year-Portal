// components/dashboard/admin/ManageSessions.jsx
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, updateDoc, doc, writeBatch, getDocs, where } from 'firebase/firestore';
import { toast } from 'sonner';
import { Calendar, Users, BookOpen, AlertTriangle, CheckCircle, GraduationCap } from 'lucide-react';

import { logger } from "../../../lib/logger";
export default function ManageSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [sessionToArchive, setSessionToArchive] = useState(null);

  // Form state for new session
  const [sessionName, setSessionName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    const q = query(collection(db, "sessions"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const sessionsList = await Promise.all(
        querySnapshot.docs.map(async (docSnap) => {
          const sessionData = docSnap.data();
          const sessionId = docSnap.id;

          // Calculate real-time stats for active session
          let stats = sessionData.stats || { totalStudents: 0, totalFaculty: 0, totalTeams: 0, totalSubmissions: 0 };

          if (sessionData.isActive) {
            try {
              // Count users by role for this session
              const [studentsSnap, facultySnap, teamsSnap, submissionsSnap] = await Promise.all([
                getDocs(query(collection(db, 'users'), where('sessionId', '==', sessionId), where('role', '==', 'student'))),
                getDocs(query(collection(db, 'users'), where('sessionId', '==', sessionId), where('role', '==', 'faculty'))),
                getDocs(query(collection(db, 'teams'), where('sessionId', '==', sessionId))),
                getDocs(query(collection(db, 'submissions'), where('sessionId', '==', sessionId)))
              ]);

              stats = {
                totalStudents: studentsSnap.size,
                totalFaculty: facultySnap.size,
                totalTeams: teamsSnap.size,
                totalSubmissions: submissionsSnap.size
              };
            } catch (error) {
              logger.error('Error fetching session stats:', error);
            }
          }

          return {
            id: sessionId,
            ...sessionData,
            startDate: sessionData.startDate?.toDate(),
            endDate: sessionData.endDate?.toDate(),
            createdAt: sessionData.createdAt?.toDate(),
            stats
          };
        })
      );

      setSessions(sessionsList);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!sessionName || !startDate || !endDate) {
      toast.error("Please fill out all required fields.");
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      toast.error("End date must be after start date.");
      return;
    }

    try {
      // Check if there's already an active session
      const activeSession = sessions.find(s => s.isActive);
      if (activeSession) {
        toast.error("There is already an active session. Please archive it first.");
        return;
      }

      // Create the session
      const sessionRef = await addDoc(collection(db, "sessions"), {
        name: sessionName,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        description: description,
        isActive: true,
        createdAt: new Date(),
        stats: {
          totalStudents: 0,
          totalFaculty: 0,
          totalTeams: 0,
          totalSubmissions: 0
        }
      });

      toast.success("New academic session created!", {
        description: "You can now create dynamic phases for this session."
      });

      // Reset form and close dialog
      setSessionName("");
      setStartDate("");
      setEndDate("");
      setDescription("");
      setOpen(false);
    } catch (error) {
      logger.error("Session creation error:", error);
      toast.error("Failed to create session.", { description: error.message });
    }
  };

  const handleActivateSession = async (sessionId) => {
    try {
      const batch = writeBatch(db);

      // Deactivate all sessions
      sessions.forEach(session => {
        const sessionRef = doc(db, "sessions", session.id);
        batch.update(sessionRef, { isActive: false });
      });

      // Activate the selected session
      const newActiveSessionRef = doc(db, "sessions", sessionId);
      batch.update(newActiveSessionRef, { isActive: true });

      await batch.commit();
      toast.success("Session activated successfully!");
    } catch (error) {
      toast.error("Failed to activate session.", { description: error.message });
    }
  };

  const handleArchiveSession = async () => {
    if (!sessionToArchive) return;

    try {
      // Get session stats before archiving
      const studentsQuery = query(collection(db, 'users'), where('role', '==', 'student'));
      const facultyQuery = query(collection(db, 'users'), where('role', '==', 'faculty'));
      const teamsQuery = query(collection(db, 'teams'));
      const submissionsQuery = query(collection(db, 'submissions'));

      const [studentsSnap, facultySnap, teamsSnap, submissionsSnap] = await Promise.all([
        getDocs(studentsQuery),
        getDocs(facultyQuery),
        getDocs(teamsQuery),
        getDocs(submissionsQuery)
      ]);

      const sessionRef = doc(db, "sessions", sessionToArchive.id);
      await updateDoc(sessionRef, {
        isActive: false,
        archivedAt: new Date(),
        finalStats: {
          totalStudents: studentsSnap.size,
          totalFaculty: facultySnap.size,
          totalTeams: teamsSnap.size,
          totalSubmissions: submissionsSnap.size
        }
      });

      toast.success("Session archived successfully!");
      setArchiveDialogOpen(false);
      setSessionToArchive(null);
    } catch (error) {
      toast.error("Failed to archive session.", { description: error.message });
    }
  };

  const getSessionStatus = (session) => {
    const now = new Date();
    const start = session.startDate;
    const end = session.endDate;

    if (session.isActive) {
      if (now < start) return { status: "upcoming", color: "bg-blue-500", badge: "default", text: "Upcoming" };
      if (now > end) return { status: "overdue", color: "bg-red-500", badge: "destructive", text: "Overdue" };
      return { status: "active", color: "bg-emerald-500", badge: "success", text: "Active" };
    }
    return { status: "archived", color: "bg-slate-400", badge: "secondary", text: "Archived" };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/50 p-4 rounded-xl backdrop-blur-sm border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">Academic Sessions</h2>
          <p className="text-sm text-slate-500">Manage academic year cycles and user rosters</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="btn-brand shadow-lg hover:shadow-xl transition-all duration-300">
              <Calendar className="h-4 w-4 mr-2" />
              Create New Session
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Academic Session</DialogTitle>
              <DialogDescription>
                Set up a new academic year cycle. Only one session can be active at a time.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="sessionName">Session Name *</Label>
                <Input
                  id="sessionName"
                  placeholder="e.g., 2025-2026"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endDate">End Date *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  placeholder="Additional details about this session..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Session</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Sessions Found</h3>
            <p className="text-muted-foreground mb-4 text-center max-w-sm">
              Create your first academic session to start managing the portal.
            </p>
            <Button onClick={() => setOpen(true)}>Create First Session</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {sessions.map((session) => {
            const statusInfo = getSessionStatus(session);
            const isActive = session.isActive;

            return (
              <Card
                key={session.id}
                className={`transition-all duration-300 hover:shadow-lg ${isActive ? "border-l-4 border-l-emerald-500 shadow-md ring-1 ring-emerald-100" : "hover:border-slate-300"}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`mt-1 p-2 rounded-lg ${isActive ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                        <Calendar className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <CardTitle className="text-xl font-bold text-slate-800">
                            {session.name}
                          </CardTitle>
                          <Badge variant={isActive ? "default" : "secondary"} className={isActive ? "bg-emerald-500 hover:bg-emerald-600" : ""}>
                            {statusInfo.text}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                          <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                            <Calendar className="h-3.5 w-3.5" />
                            {session.startDate?.toLocaleDateString()} - {session.endDate?.toLocaleDateString()}
                          </span>
                          {session.description && (
                            <span className="flex items-center gap-1.5">
                              <BookOpen className="h-3.5 w-3.5" />
                              {session.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-start">
                      {!isActive && statusInfo.status !== "archived" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleActivateSession(session.id)}
                          className="hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Activate
                        </Button>
                      )}

                      {isActive && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSessionToArchive(session);
                            setArchiveDialogOpen(true);
                          }}
                          className="shadow-sm hover:shadow"
                        >
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          Archive
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {session.stats && (
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 hover:bg-white hover:shadow-sm transition-all text-center">
                        <div className="text-2xl font-bold text-slate-700">{session.finalStats?.totalStudents || session.stats.totalStudents}</div>
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center justify-center gap-1 mt-1">
                          <GraduationCap className="h-3 w-3" /> Students
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 hover:bg-white hover:shadow-sm transition-all text-center">
                        <div className="text-2xl font-bold text-slate-700">{session.finalStats?.totalFaculty || session.stats.totalFaculty}</div>
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center justify-center gap-1 mt-1">
                          <Users className="h-3 w-3" /> Faculty
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 hover:bg-white hover:shadow-sm transition-all text-center">
                        <div className="text-2xl font-bold text-slate-700">{session.finalStats?.totalTeams || session.stats.totalTeams}</div>
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center justify-center gap-1 mt-1">
                          <Users className="h-3 w-3" /> Teams
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 hover:bg-white hover:shadow-sm transition-all text-center">
                        <div className="text-2xl font-bold text-slate-700">{session.finalStats?.totalSubmissions || session.stats.totalSubmissions}</div>
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center justify-center gap-1 mt-1">
                          <BookOpen className="h-3 w-3" /> Submissions
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Archive Confirmation Dialog */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Archive Session
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to archive "{sessionToArchive?.name}"? This will:
              <ul className="mt-2 list-disc list-inside space-y-1 text-sm">
                <li>Deactivate the session and preserve current statistics</li>
                <li>Prevent new user registrations for this session</li>
                <li>Keep all data for historical reference</li>
              </ul>
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleArchiveSession}>
              Archive Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// components/dashboard/admin/ManageTeams.jsx
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where, doc, getDoc, getDocs, setDoc, updateDoc, runTransaction, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Users, Upload, Download, Search, UserPlus, AlertCircle, CheckCircle2, KeyRound, Edit, AlertTriangle, Eye, Info, Award, ClipboardList, GraduationCap } from 'lucide-react';
import { useSession } from '@/context/SessionContext';

import { logger } from "../../../lib/logger";
export default function ManageTeams() {
  const { activeSession } = useSession();
  const [teams, setTeams] = useState([]);
  const [filteredTeams, setFilteredTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [csvUploadOpen, setCsvUploadOpen] = useState(false);
  const [csvData, setCsvData] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamGrades, setTeamGrades] = useState([]);
  const [teamPanel, setTeamPanel] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [editForm, setEditForm] = useState({
    projectNumber: '',
    projectTitle: '',
    leaderEmail: '',
    members: [],
    mentorEmail: ''
  });
  const [allUsers, setAllUsers] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeSession?.id) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "teams"),
      where('sessionId', '==', activeSession.id)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const teamsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));
      setTeams(teamsList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeSession]);

  // Fetch all users for edit dropdown
  useEffect(() => {
    const usersQuery = query(collection(db, "users"));
    const unsubscribe = onSnapshot(usersQuery, (querySnapshot) => {
      const usersList = querySnapshot.docs.map(doc => ({
        email: doc.id,
        ...doc.data()
      }));
      setAllUsers(usersList);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let filtered = teams;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(team =>
        team.projectNumber?.toString().includes(searchTerm) ||
        team.teamCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.projectTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.members?.some(email => email.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredTeams(filtered);
  }, [teams, searchTerm]);

  const handleCsvUpload = async () => {
    if (!csvData.trim()) {
      toast.error("Please enter CSV data.");
      return;
    }

    if (!activeSession) {
      toast.error("No active session found. Please create and activate a session first.");
      return;
    }

    setUploading(true);
    try {
      // Helper function to parse CSV line properly (handles quotes and removes them)
      const parseCSVLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];

          if (char === '"') {
            inQuotes = !inQuotes;
            // Don't add quotes to the result
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());

        // Remove any remaining quotes from each value
        return result.map(val => val.replace(/^["']|["']$/g, '').trim());
      };

      const lines = csvData.trim().split('\n').filter(line => line.trim());
      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

      // Validate headers - group_no, project_name, mentor_email, leader_email, member1_email, member2_email, member3_email
      const requiredHeaders = ['group_no', 'leader_email'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        toast.error(`Missing required headers: ${missingHeaders.join(', ')}`);
        setUploading(false);
        return;
      }

      // Get column indices
      const groupNoIdx = headers.indexOf('group_no');
      const leaderEmailIdx = headers.indexOf('leader_email');
      const member1EmailIdx = headers.indexOf('member1_email');
      const member2EmailIdx = headers.indexOf('member2_email');
      const member3EmailIdx = headers.indexOf('member3_email');
      const projectNameIdx = headers.indexOf('project_name');
      const mentorEmailIdx = headers.indexOf('mentor_email');

      let successCount = 0;
      let errors = [];
      const teamsToCreate = [];

      // Parse all teams first
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCSVLine(line);
        if (values.length < 2) {
          errors.push(`Line ${i + 1}: Invalid number of columns`);
          continue;
        }

        const groupNo = values[groupNoIdx]?.trim();
        const leaderEmail = values[leaderEmailIdx]?.trim().toLowerCase(); // Always lowercase
        const member1Email = member1EmailIdx >= 0 ? values[member1EmailIdx]?.trim().toLowerCase() : '';
        const member2Email = member2EmailIdx >= 0 ? values[member2EmailIdx]?.trim().toLowerCase() : '';
        const member3Email = member3EmailIdx >= 0 ? values[member3EmailIdx]?.trim().toLowerCase() : '';
        const projectName = projectNameIdx >= 0 && values[projectNameIdx] ? values[projectNameIdx].trim() : null;
        const mentorEmail = mentorEmailIdx >= 0 && values[mentorEmailIdx] ? values[mentorEmailIdx].trim().toLowerCase() : null;

        // Parse additional member emails (beyond leader)
        const additionalMembers = [member1Email, member2Email, member3Email].filter(e => e && e.length > 0);

        // All team members = leader + additional members (max 4 total)
        const allEmails = [leaderEmail, ...additionalMembers].filter(e => e);
        const invalidEmails = allEmails.filter(email => !email.includes('@gehu.ac.in') && !email.includes('@geu.ac.in'));
        if (invalidEmails.length > 0) {
          errors.push(`Line ${i + 1}: Invalid email domain(s): ${invalidEmails.join(', ')}`);
          continue;
        }

        // Check for duplicates within the same team
        const uniqueEmails = [...new Set(allEmails)];
        if (uniqueEmails.length !== allEmails.length) {
          errors.push(`Line ${i + 1}: Duplicate emails found in group ${groupNo}`);
          continue;
        }

        // Handle missing/invalid group numbers - will be auto-assigned later
        let parsedGroupNo = null;
        if (groupNo && !isNaN(parseInt(groupNo))) {
          parsedGroupNo = parseInt(groupNo);
        }

        // Validate mentor email if provided
        if (mentorEmail && !mentorEmail.includes('@gehu.ac.in') && !mentorEmail.includes('@geu.ac.in')) {
          errors.push(`Line ${i + 1}: Invalid mentor email domain: ${mentorEmail}`);
          continue;
        }

        teamsToCreate.push({
          lineNumber: i + 1,
          groupNo: parsedGroupNo, // null if invalid/missing
          projectName,
          leaderEmail,
          additionalMembers,
          mentorEmail,
          allEmails: uniqueEmails
        });
      }

      // Track duplicate students and mark teams with them
      const allStudentEmails = {};
      const teamsWithDuplicates = new Set();

      for (const team of teamsToCreate) {
        for (const email of team.allEmails) {
          if (allStudentEmails[email]) {
            errors.push(`Student ${email} appears in multiple teams (line ${team.lineNumber} and line ${allStudentEmails[email]})`);
            teamsWithDuplicates.add(team.lineNumber);
            teamsWithDuplicates.add(allStudentEmails[email]);
          } else {
            allStudentEmails[email] = team.lineNumber;
          }
        }
      }

      // Filter out teams with duplicate students - allow other teams to import
      const validTeams = teamsToCreate.filter(team => !teamsWithDuplicates.has(team.lineNumber));

      if (validTeams.length === 0) {
        toast.error('No valid teams to import', {
          description: `All ${teamsToCreate.length} teams have validation errors. Check console for details.`
        });
        logger.error('CSV Import Errors:', errors);
        setUploading(false);
        return;
      }

      if (teamsWithDuplicates.size > 0) {
        toast.warning(`Skipping ${teamsWithDuplicates.size} teams with duplicate students`, {
          description: `Importing ${validTeams.length} valid teams. Check console for details.`
        });
        logger.warn('Skipped teams with duplicate students:', Array.from(teamsWithDuplicates));
      }

      // Auto-assign group numbers for teams without valid ones
      let autoGroupCounter = 10000;
      for (const team of validTeams) {
        if (team.groupNo === null) {
          team.groupNo = autoGroupCounter;
          autoGroupCounter++;
        }
      }

      // Fetch all student user documents and validate UIDs
      const studentDataMap = {};
      const studentsNotFound = new Set();
      const invalidRoleStudents = new Set();
      const validStudentEmails = new Set();
      validTeams.forEach(team => team.allEmails.forEach(email => validStudentEmails.add(email)));

      for (const email of validStudentEmails) {
        try {
          const userDoc = await getDoc(doc(db, 'users', email));
          if (!userDoc.exists()) {
            errors.push(`Student ${email} not found in users collection. Import users first.`);
            studentsNotFound.add(email);
            continue;
          }

          const userData = userDoc.data();
          if (userData.role !== 'student') {
            errors.push(`User ${email} is not a student (role: ${userData.role})`);
            invalidRoleStudents.add(email);
            continue;
          }

          // Get user UID (might be placeholder from CSV or real from Auth)
          const userUid = userData.uid || email; // Fallback to email if no UID yet

          // Use user UID - if they haven't logged in yet, this will be updated when they do
          studentDataMap[email] = {
            email: email,
            uid: userUid,
            name: userData.name || 'Unknown',
            role: userData.role,
          };
        } catch (error) {
          errors.push(`Error fetching user ${email}: ${error.message}`);
          studentsNotFound.add(email);
        }
      }

      // Filter out teams with missing or invalid students
      const problemStudents = new Set([...studentsNotFound, ...invalidRoleStudents]);
      const teamsAfterStudentValidation = validTeams.filter(team => {
        const hasProblematicStudent = team.allEmails.some(email => problemStudents.has(email));
        if (hasProblematicStudent) {
          errors.push(`Line ${team.lineNumber}: Team skipped due to missing/invalid students`);
        }
        return !hasProblematicStudent;
      });

      if (teamsAfterStudentValidation.length === 0) {
        toast.error('No valid teams to import after student validation', {
          description: `All teams have missing or invalid students. Check console for details.`
        });
        logger.error('Student Data Errors:', errors);
        setUploading(false);
        return;
      }

      if (problemStudents.size > 0) {
        logger.warn(`Skipped ${validTeams.length - teamsAfterStudentValidation.length} teams due to missing/invalid students`);
      }

      // Validate mentor emails if provided (only for teams that passed student validation)
      const mentorEmails = teamsAfterStudentValidation
        .filter(t => t.mentorEmail)
        .map(t => t.mentorEmail);

      const mentorDataMap = {};
      const mentorsNotFound = new Set();

      for (const email of [...new Set(mentorEmails)]) {
        try {
          const userDoc = await getDoc(doc(db, 'users', email));
          if (!userDoc.exists()) {
            errors.push(`Mentor ${email} not found in users collection`);
            mentorsNotFound.add(email);
            continue;
          }

          const userData = userDoc.data();
          if (userData.role !== 'faculty') {
            errors.push(`User ${email} is not a faculty member (role: ${userData.role})`);
            mentorsNotFound.add(email);
            continue;
          }

          // Get user UID (might be placeholder from CSV or real from Auth)
          const userUid = userData.uid || email; // Fallback to email if no UID yet

          mentorDataMap[email] = {
            uid: userUid,
            email: email,
            name: userData.name || 'Unknown',
          };
        } catch (error) {
          errors.push(`Error fetching mentor ${email}: ${error.message}`);
          mentorsNotFound.add(email);
        }
      }

      // Final valid teams list (skip teams with invalid mentors, or clear mentor if invalid)
      const finalValidTeams = teamsAfterStudentValidation.map(team => {
        if (team.mentorEmail && mentorsNotFound.has(team.mentorEmail)) {
          errors.push(`Line ${team.lineNumber}: Mentor ${team.mentorEmail} not found, team will be created without mentor`);
          return { ...team, mentorEmail: null }; // Clear invalid mentor
        }
        return team;
      });

      if (errors.length > 0) {
        logger.warn('Import warnings:', errors);
      }

      // Create teams and update user documents (only final valid teams)
      for (const teamData of finalValidTeams) {
        try {
          const leader = studentDataMap[teamData.leaderEmail];
          if (!leader) {
            errors.push(`Leader ${teamData.leaderEmail} not found for group ${teamData.groupNo}`);
            continue;
          }

          // Use provided group number as project number
          const projectNumber = teamData.groupNo;

          // Generate team code from group number
          const teamCode = `G${projectNumber.toString().padStart(3, '0')}`;
          const teamId = `team_${activeSession.id}_${projectNumber}`;

          // Prepare team document
          const teamDoc = {
            name: `Group ${projectNumber}`,
            teamCode: teamCode,
            projectNumber: projectNumber,
            leaderId: leader.uid,
            leaderEmail: leader.email,
            leaderName: leader.name,
            members: teamData.allEmails,
            memberCount: teamData.allEmails.length,
            sessionId: activeSession.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            isImported: true,
            importedAt: serverTimestamp()
          };

          // Add optional project name
          if (teamData.projectName) {
            teamDoc.projectTitle = teamData.projectName;
          }

          // Add optional mentor (only if mentor exists and has valid data)
          if (teamData.mentorEmail) {
            const mentor = mentorDataMap[teamData.mentorEmail];
            if (mentor && mentor.email && mentor.name) {
              // CRITICAL: Always set mentorEmail (primary key for queries)
              teamDoc.mentorEmail = mentor.email;
              teamDoc.mentorName = mentor.name;

              // mentorId might be email (if mentor hasn't signed up) or UID (if signed up)
              // This is OK - authSyncService will update it to UID when mentor signs up
              if (mentor.uid) {
                teamDoc.mentorId = mentor.uid;
              }

              teamDoc.mentorAssignedAt = serverTimestamp();
            }
          }

          // Create team document (ensure no undefined values)
          const cleanTeamDoc = Object.fromEntries(
            Object.entries(teamDoc).filter(([_, v]) => v !== undefined)
          );
          await setDoc(doc(db, 'teams', teamId), cleanTeamDoc);

          // Update all member user documents with team info
          for (const memberEmail of teamData.allEmails) {
            const memberData = studentDataMap[memberEmail];
            if (memberData) {
              await setDoc(doc(db, 'users', memberEmail), {
                teamId: teamId,
                teamCode: teamCode,
                projectNumber: projectNumber,
                sessionId: activeSession.id,
                updatedAt: serverTimestamp()
              }, { merge: true });
            } else {
              logger.warn(`  ⚠️ No student data found for ${memberEmail}`);
            }
          }

          successCount++;
        } catch (error) {
          errors.push(`Error creating group ${teamData.groupNo}: ${error.message}`);
          logger.error(`Team creation error:`, error);
        }
      }

      if (errors.length > 0) {
        toast.warning(`Import completed with ${errors.length} error(s)`, {
          description: `${successCount} teams imported successfully`
        });
        logger.error('Team Import Errors:', errors);
      } else {
        toast.success(`Successfully imported ${successCount} team(s)!`);
      }

      setCsvData("");
      setCsvUploadOpen(false);
    } catch (error) {
      toast.error("Failed to import teams.", { description: error.message });
      logger.error('CSV Import Error:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleEditTeam = (team) => {
    setSelectedTeam(team);
    // Filter out leader from members array since leader is shown separately
    const additionalMembers = (team.members || []).filter(m => m !== team.leaderEmail);
    setEditForm({
      projectNumber: team.projectNumber || '',
      projectTitle: team.projectTitle || '',
      leaderEmail: team.leaderEmail || '',
      members: additionalMembers,
      mentorEmail: team.mentorEmail || ''
    });
    setEditDialogOpen(true);
  };

  const handleViewTeam = async (team) => {
    setSelectedTeam(team);
    setViewDialogOpen(true);
    setLoadingDetails(true);

    try {
      // Fetch grades for all team members
      const gradesQuery = query(
        collection(db, 'grades'),
        where('teamId', '==', team.id)
      );
      const gradesSnapshot = await getDocs(gradesQuery);
      const gradesData = gradesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTeamGrades(gradesData);

      // Fetch panel information if assigned
      if (team.panelId) {
        const panelDoc = await getDoc(doc(db, 'panels', team.panelId));
        if (panelDoc.exists()) {
          setTeamPanel({ id: panelDoc.id, ...panelDoc.data() });
        }
      } else {
        setTeamPanel(null);
      }
    } catch (error) {
      logger.error('Error fetching team details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSaveEdit = () => {
    // Show confirmation dialog with warnings
    setConfirmDialogOpen(true);
  };

  const handleConfirmSave = async () => {
    if (!selectedTeam) return;

    setSaving(true);
    try {
      const newProjectNumber = parseInt(editForm.projectNumber);

      // Validate group number
      if (isNaN(newProjectNumber) || newProjectNumber < 1) {
        toast.error("Invalid group number. Must be a positive number.");
        setSaving(false);
        return;
      }

      // Check if new group number is already used by another team
      if (newProjectNumber !== selectedTeam.projectNumber) {
        const existingTeam = teams.find(t =>
          t.projectNumber === newProjectNumber && t.id !== selectedTeam.id
        );
        if (existingTeam) {
          toast.error(`Group number ${newProjectNumber} is already in use by another team.`);
          setSaving(false);
          return;
        }
      }

      // Validate emails
      const allEmails = [editForm.leaderEmail, ...editForm.members.filter(m => m && m !== editForm.leaderEmail)];
      const invalidEmails = allEmails.filter(email =>
        !email.includes('@gehu.ac.in') && !email.includes('@geu.ac.in')
      );
      if (invalidEmails.length > 0) {
        toast.error(`Invalid email domain(s): ${invalidEmails.join(', ')}`);
        setSaving(false);
        return;
      }

      // Prepare update data
      const newTeamCode = `G${newProjectNumber.toString().padStart(3, '0')}`;
      const updateData = {
        projectNumber: newProjectNumber,
        teamCode: newTeamCode,
        projectTitle: editForm.projectTitle || null,
        leaderEmail: editForm.leaderEmail,
        members: allEmails,
        memberCount: allEmails.length,
        updatedAt: serverTimestamp()
      };

      // Add mentor if provided
      if (editForm.mentorEmail) {
        const mentorDoc = await getDoc(doc(db, 'users', editForm.mentorEmail));
        if (mentorDoc.exists()) {
          const mentorData = mentorDoc.data();
          if (mentorData.role === 'faculty') {
            updateData.mentorId = mentorData.uid || editForm.mentorEmail;
            updateData.mentorEmail = editForm.mentorEmail;
            updateData.mentorName = mentorData.name || 'Unknown';
            updateData.mentorAssignedAt = serverTimestamp();
          } else {
            toast.error(`${editForm.mentorEmail} is not a faculty member.`);
            setSaving(false);
            return;
          }
        } else {
          toast.error(`Mentor ${editForm.mentorEmail} not found.`);
          setSaving(false);
          return;
        }
      } else {
        // Remove mentor if cleared
        updateData.mentorId = null;
        updateData.mentorEmail = null;
        updateData.mentorName = null;
        updateData.mentorAssignedAt = null;
      }

      // Get leader info
      const leaderDoc = await getDoc(doc(db, 'users', editForm.leaderEmail));
      if (leaderDoc.exists()) {
        const leaderData = leaderDoc.data();
        updateData.leaderId = leaderData.uid || editForm.leaderEmail;
        updateData.leaderName = leaderData.name || 'Unknown';
      }

      // Update team document
      await setDoc(doc(db, 'teams', selectedTeam.id), updateData, { merge: true });

      // Update all member user documents with new team info
      for (const memberEmail of allEmails) {
        await setDoc(doc(db, 'users', memberEmail), {
          teamId: selectedTeam.id,
          teamCode: newTeamCode,
          projectNumber: newProjectNumber,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      // Remove teamId from old members who are no longer in the team
      const removedMembers = selectedTeam.members?.filter(m => !allEmails.includes(m)) || [];
      for (const memberEmail of removedMembers) {
        await setDoc(doc(db, 'users', memberEmail), {
          teamId: null,
          teamCode: null,
          projectNumber: null,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      toast.success("Team updated successfully!");
      setEditDialogOpen(false);
      setConfirmDialogOpen(false);
      setSelectedTeam(null);
    } catch (error) {
      toast.error("Failed to update team.", { description: error.message });
      logger.error('Team update error:', error);
    } finally {
      setSaving(false);
    }
  };

  const exportToCsv = () => {
    const csvContent = [
      "group_no,teamCode,leader_email,leader_name,member1_email,member2_email,member3_email,project_name,mentor_name,mentor_email,panel_number,createdAt",
      ...filteredTeams.map(team => {
        const members = team.members || [];
        const additionalMembers = members.filter(m => m !== team.leaderEmail);
        const createdAtStr = team.createdAt
          ? (team.createdAt instanceof Date ? team.createdAt.toISOString() : team.createdAt.toDate?.().toISOString() || '')
          : '';
        return `"${team.projectNumber || ''}","${team.teamCode || ''}","${team.leaderEmail || ''}","${team.leaderName || ''}","${additionalMembers[0] || ''}","${additionalMembers[1] || ''}","${additionalMembers[2] || ''}","${team.projectTitle || ''}","${team.mentorName || ''}","${team.mentorEmail || ''}","${team.panelNumber || ''}","${createdAtStr}"`;
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `teams-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const stats = {
    total: teams.length,
    withMentor: teams.filter(t => t.mentorId).length,
    withoutMentor: teams.filter(t => !t.mentorId).length,
    averageSize: teams.length > 0
      ? (teams.reduce((sum, t) => sum + (t.memberCount || 0), 0) / teams.length).toFixed(1)
      : 0
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (!activeSession) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No active session. Please create and activate a session first.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Mentor</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withMentor}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Without Mentor</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withoutMentor}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Team Size</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageSize}</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex justify-between items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search teams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex space-x-2">
          <Button variant="outline" onClick={exportToCsv}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>

          <Dialog open={csvUploadOpen} onOpenChange={setCsvUploadOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Bulk Import Teams</DialogTitle>
                <DialogDescription>
                  Import multiple teams at once using CSV format.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 overflow-y-auto flex-1 px-1 py-2">
                {/* Format Information */}
                <div className="space-y-2 text-sm bg-muted/50 p-3 rounded-md">
                  <div>
                    <strong className="text-foreground">CSV Format:</strong> group_no, mentor_email, project_name, leader_email, member1_email, member2_email, member3_email
                  </div>
                  <div className="text-xs text-muted-foreground">
                    • group_no is the group number (e.g., 1, 2, 3...)<br />
                    • leader_email is team leader's email (required)<br />
                    • member1_email, member2_email, member3_email are optional additional members<br />
                    • project_name and mentor_email are optional
                  </div>
                </div>

                {/* Format Example */}
                <div className="space-y-1">
                  <Label className="text-sm font-semibold">Example CSV:</Label>
                  <ScrollArea className="w-full h-24">
                    <pre className="p-2 bg-muted rounded text-[10px] leading-relaxed whitespace-pre overflow-x-auto">
                      {`group_no,mentor_email,project_name,leader_email,member1_email,member2_email,member3_email
1,f1@gehu.ac.in,AI Chatbot System,s1@gehu.ac.in,s2@gehu.ac.in,s3@gehu.ac.in,s4@gehu.ac.in
2,f2@gehu.ac.in,E-Commerce Platform,s5@gehu.ac.in,s6@gehu.ac.in,s7@gehu.ac.in,
3,,Health Tracker,s8@gehu.ac.in,s9@gehu.ac.in,s10@gehu.ac.in,`}</pre>
                  </ScrollArea>
                </div>

                {/* Warning Message */}
                <div className="flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
                  <KeyRound className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
                    <div><strong>Prerequisites:</strong></div>
                    <ul className="list-disc list-inside space-y-0.5 ml-1 text-[11px]">
                      <li>All students and faculty must be imported in "Manage Users" first</li>
                      <li>All users must have Auth accounts created (check Auth status in "Manage Users")</li>
                      <li>Team import will fail if any user lacks an Auth account</li>
                    </ul>
                  </div>
                </div>

                {/* CSV Data Input */}
                <div className="space-y-2">
                  <Label htmlFor="csvData">Paste CSV Data</Label>
                  <Textarea
                    id="csvData"
                    placeholder="group_no,mentor_email,project_name,leader_email,member1_email,member2_email,member3_email&#10;1,f1@gehu.ac.in,AI Chatbot,s1@gehu.ac.in,s2@gehu.ac.in,s3@gehu.ac.in,s4@gehu.ac.in"
                    value={csvData}
                    onChange={(e) => setCsvData(e.target.value)}
                    rows={6}
                    className="font-mono text-xs resize-none max-h-52 md:max-h-60"
                  />
                </div>

                {/* Format Rules - Collapsible */}
                <Alert className="p-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs space-y-2">
                    <div className="font-semibold">Import Rules:</div>
                    <ul className="list-disc list-inside space-y-0.5 text-[10px] leading-relaxed">
                      <li><strong>group_no</strong>: Group number (REQUIRED, e.g., 1, 2, 3...)</li>
                      <li><strong>mentor_email</strong>: Optional faculty email (leave empty if no mentor yet)</li>
                      <li><strong>project_name</strong>: Optional project title (e.g., "AI Chatbot System")</li>
                      <li><strong>leader_email</strong>: Team leader's email (REQUIRED)</li>
                      <li><strong>member1_email, member2_email, member3_email</strong>: Optional additional member emails</li>
                      <li>All emails must end with @gehu.ac.in</li>
                      <li>Each student can only be in ONE team</li>
                      <li>All students/faculty must be imported in "Users" first</li>
                      <li>Team codes are auto-generated as G001, G002, etc. based on group_no</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </div>
              <DialogFooter className="flex-shrink-0 mt-2">
                <Button variant="outline" onClick={() => setCsvUploadOpen(false)} disabled={uploading}>
                  Cancel
                </Button>
                <Button onClick={handleCsvUpload} disabled={uploading}>
                  {uploading ? "Importing..." : "Import Teams"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Teams Table */}
      <Card className="overflow-hidden border-none shadow-lg">
        <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-800">Team Management</CardTitle>
          <Badge variant="outline" className="bg-white">
            {filteredTeams.length} {filteredTeams.length === 1 ? 'Team' : 'Teams'}
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Group #</TableHead>
                  <TableHead className="w-[90px]">Code</TableHead>
                  <TableHead className="max-w-[180px]">Project Name</TableHead>
                  <TableHead>Leader</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Mentor</TableHead>
                  <TableHead className="w-[100px]">Created</TableHead>
                  <TableHead className="w-[90px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeams.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">
                        {searchTerm ? "No teams match your search" : "No teams found. Import teams to get started."}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTeams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell className="py-3">
                        <Badge variant="secondary" className="whitespace-nowrap">Group {team.projectNumber}</Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="font-mono text-xs">{team.teamCode}</span>
                      </TableCell>
                      <TableCell className="py-3 max-w-[180px]">
                        <div className="overflow-x-auto whitespace-nowrap font-medium text-sm pb-1 pr-2 no-scrollbar" title={team.projectTitle || 'Not specified'}>
                          {team.projectTitle || <span className="text-muted-foreground italic">Not specified</span>}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-sm truncate max-w-[150px]" title={team.leaderName}>{team.leaderName}</span>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[150px]" title={team.leaderEmail}>{team.leaderEmail}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="outline" className="whitespace-nowrap">{team.memberCount || team.members?.length || 0} members</Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        {team.mentorId ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-sm truncate max-w-[150px]" title={team.mentorName}>{team.mentorName || 'Unknown'}</span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[150px]" title={team.mentorEmail}>{team.mentorEmail}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-orange-600 font-medium bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                            Pending
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {team.createdAt?.toLocaleDateString() || 'N/A'}
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleViewTeam(team)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditTeam(team)}
                            title="Edit Team"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* View Team Details Modal - Premium Landscape Layout - 75% Screen Coverage */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="w-[95vw] max-w-none h-[85vh] p-0 overflow-hidden flex flex-col rounded-xl border-0 shadow-2xl" showCloseButton={false}>
          <DialogTitle className="sr-only">Team Details - {selectedTeam?.teamCode}</DialogTitle>
          {/* Premium Header with Gradient */}
          <div className="flex items-center justify-between px-8 py-5 border-b bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-slate-800 dark:bg-slate-200 flex items-center justify-center shadow-md">
                <Users className="h-6 w-6 text-white dark:text-slate-800" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">{selectedTeam?.teamCode}</h2>
                  {/* <Badge variant="secondary" className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                    Group {selectedTeam?.projectNumber}
                  </Badge> */}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedTeam?.projectTitle || 'Untitled Project'} • {selectedTeam?.memberCount || selectedTeam?.members?.length || 0} Members
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-800 hover:bg-slate-200/50" onClick={() => setViewDialogOpen(false)}>
                Close
              </Button>
              <Button size="sm" className="bg-slate-800 hover:bg-slate-700 text-white shadow-sm" onClick={() => { setViewDialogOpen(false); handleEditTeam(selectedTeam); }}>
                <Edit className="h-3.5 w-3.5 mr-2" />
                Edit Team
              </Button>
            </div>
          </div>

          {selectedTeam && (
            <Tabs defaultValue="basic" className="flex-1 flex flex-col overflow-hidden">
              {/* Refined Tab Navigation */}
              <div className="px-8 pt-4 pb-0 flex-shrink-0 border-b bg-white dark:bg-slate-950">
                <TabsList className="h-11 bg-transparent p-0 gap-0.5">
                  <TabsTrigger value="basic" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 rounded-lg px-5 py-2.5 gap-2 font-medium transition-all">
                    <Info className="h-4 w-4" /> Overview
                  </TabsTrigger>
                  <TabsTrigger value="members" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 rounded-lg px-5 py-2.5 gap-2 font-medium transition-all">
                    <Users className="h-4 w-4" /> Members
                  </TabsTrigger>
                  <TabsTrigger value="mentor" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 rounded-lg px-5 py-2.5 gap-2 font-medium transition-all">
                    <GraduationCap className="h-4 w-4" /> Mentor
                  </TabsTrigger>
                  <TabsTrigger value="panel" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 rounded-lg px-5 py-2.5 gap-2 font-medium transition-all">
                    <ClipboardList className="h-4 w-4" /> Panel
                  </TabsTrigger>
                  <TabsTrigger value="grades" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100 rounded-lg px-5 py-2.5 gap-2 font-medium transition-all">
                    <Award className="h-4 w-4" /> Grades
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto px-8 py-6 bg-slate-50/50 dark:bg-slate-900/50">

                {/* ── Tab 1: Overview ── */}
                <TabsContent value="basic" className="mt-0 h-full">
                  <div className="space-y-6">
                    {/* Row 1: Team Details */}
                    <div>
                      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Team Details</h3>
                      <div className="grid grid-cols-5 gap-4">
                        <div className="rounded-xl border bg-white dark:bg-slate-800 p-4 text-center shadow-sm">
                          <div className="text-xs text-slate-500 mb-1">Group #</div>
                          <div className="text-2xl font-bold text-slate-800 dark:text-white">{selectedTeam.projectNumber}</div>
                        </div>
                        <div className="rounded-xl border bg-white dark:bg-slate-800 p-4 text-center shadow-sm">
                          <div className="text-xs text-slate-500 mb-1">Code</div>
                          <div className="text-2xl font-bold font-mono text-slate-800 dark:text-white">{selectedTeam.teamCode}</div>
                        </div>
                        <div className="rounded-xl border bg-white dark:bg-slate-800 p-4 text-center shadow-sm">
                          <div className="text-xs text-slate-500 mb-1">Members</div>
                          <div className="text-2xl font-bold text-slate-800 dark:text-white">{selectedTeam.memberCount || selectedTeam.members?.length || 0}</div>
                        </div>
                        <div className="rounded-xl border bg-white dark:bg-slate-800 p-4 text-center shadow-sm">
                          <div className="text-xs text-slate-500 mb-1">Panel</div>
                          <div className="text-2xl font-bold text-slate-800 dark:text-white">{selectedTeam.panelNumber || '—'}</div>
                        </div>
                        <div className="rounded-xl border bg-white dark:bg-slate-800 p-4 text-center shadow-sm">
                          <div className="text-xs text-slate-500 mb-1">Created</div>
                          <div className="text-sm font-semibold text-slate-800 dark:text-white">
                            {selectedTeam.createdAt?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Project Title & Mentor */}
                    <div className="grid grid-cols-2 gap-6">
                      {/* Project Title */}
                      <div>
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Project Title</h3>
                        <div className="rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm h-[100px] flex items-center">
                          <div className="text-lg font-semibold text-slate-800 dark:text-white leading-snug">
                            {selectedTeam.projectTitle || <span className="text-slate-400 italic">Not specified</span>}
                          </div>
                        </div>
                      </div>

                      {/* Project Mentor */}
                      <div>
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Project Mentor</h3>
                        <div className="rounded-xl border bg-white dark:bg-slate-800 p-5 shadow-sm h-[100px] flex items-center">
                          {selectedTeam.mentorId ? (
                            <div className="flex items-center gap-4">
                              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center text-xl font-bold shadow-md">
                                {(selectedTeam.mentorName || 'M').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-lg text-slate-800 dark:text-white">{selectedTeam.mentorName}</div>
                                <div className="text-sm text-slate-500">{selectedTeam.mentorEmail}</div>
                              </div>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-orange-600 border-orange-300 px-4 py-2 text-sm">
                              Mentor Not Assigned
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Row 3: Abstract */}
                    <div>
                      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Project Abstract</h3>
                      <div className="rounded-xl border bg-white dark:bg-slate-800 p-6 shadow-sm min-h-[120px]">
                        {selectedTeam.abstract ? (
                          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{selectedTeam.abstract}</p>
                        ) : (
                          <p className="text-slate-400 italic">No abstract available for this project.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* ── Tab 2: Members ── */}
                <TabsContent value="members" className="mt-0 h-full">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Team Members</h3>
                    <Badge variant="outline">{selectedTeam.members?.length || 0} Total</Badge>
                  </div>
                  {selectedTeam.members && selectedTeam.members.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {selectedTeam.members.map((memberEmail, index) => {
                        const isLeader = memberEmail === selectedTeam.leaderEmail;
                        const user = allUsers.find(u => u.email === memberEmail);
                        return (
                          <div
                            key={memberEmail}
                            className={`p-4 rounded-lg border transition-all ${isLeader
                              ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-700'
                              : 'bg-muted/20 border-muted hover:border-muted-foreground/30'
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${isLeader ? 'bg-green-500 text-white' : 'bg-primary/10 text-primary'
                                }`}>
                                {(user?.name || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold truncate">{user?.name || 'Unknown'}</span>
                                  {isLeader && <Badge variant="default" className="bg-green-600 text-[10px] px-1.5 py-0">Leader</Badge>}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">{memberEmail}</div>
                              </div>
                              <div className="text-lg font-bold text-muted-foreground/40">#{index + 1}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[calc(100%-2rem)]">
                      <Users className="h-10 w-10 text-muted-foreground mb-2" />
                      <p className="text-muted-foreground text-sm">No members found</p>
                    </div>
                  )}
                </TabsContent>

                {/* ── Tab 3: Mentor ── */}
                <TabsContent value="mentor" className="mt-0 h-full">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Mentor Information</h3>
                  {selectedTeam.mentorId ? (
                    <div className="grid grid-cols-3 gap-5">
                      {/* Profile Card */}
                      <div className="col-span-1 rounded-lg border p-6 flex flex-col items-center text-center">
                        <div className="h-20 w-20 rounded-full bg-purple-500 text-white flex items-center justify-center text-3xl font-bold mb-4">
                          {(selectedTeam.mentorName || 'M').charAt(0).toUpperCase()}
                        </div>
                        <div className="text-lg font-bold">{selectedTeam.mentorName || 'Unknown'}</div>
                        <div className="text-sm text-muted-foreground mt-1">{selectedTeam.mentorEmail}</div>
                        <Badge variant="default" className="bg-purple-600 mt-3">Active Mentor</Badge>
                      </div>
                      {/* Details */}
                      <div className="col-span-2 space-y-3">
                        <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
                          <span className="text-sm text-muted-foreground">Full Name</span>
                          <span className="font-medium">{selectedTeam.mentorName || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
                          <span className="text-sm text-muted-foreground">Email</span>
                          <span className="font-medium text-sm">{selectedTeam.mentorEmail}</span>
                        </div>
                        {selectedTeam.mentorAssignedAt && (
                          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
                            <span className="text-sm text-muted-foreground">Assigned On</span>
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <span className="font-medium text-sm">
                                {new Date(selectedTeam.mentorAssignedAt.seconds * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[calc(100%-2rem)]">
                      <div className="h-16 w-16 rounded-full bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center mb-3">
                        <AlertCircle className="h-8 w-8 text-orange-500" />
                      </div>
                      <h4 className="text-lg font-semibold mb-1">No Mentor Assigned</h4>
                      <p className="text-sm text-muted-foreground">This team is waiting for mentor assignment</p>
                    </div>
                  )}
                </TabsContent>

                {/* ── Tab 4: Panel ── */}
                <TabsContent value="panel" className="mt-0 h-full">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Evaluation Panel</h3>
                  {loadingDetails ? (
                    <div className="flex items-center justify-center h-[calc(100%-2rem)]">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                    </div>
                  ) : teamPanel ? (
                    <div className="space-y-4">
                      {/* Panel Header */}
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant="secondary" className="text-base px-3 py-1">Panel {teamPanel.panelNumber}</Badge>
                        <span className="text-sm text-muted-foreground">{teamPanel.actualSize || teamPanel.facultyMembers?.length || 0} Faculty Members</span>
                      </div>

                      {/* Mentor-Evaluator Conflict Warning */}
                      {selectedTeam?.mentorId && teamPanel.facultyMembers?.some(f => f.uid === selectedTeam.mentorId || f.email === selectedTeam.mentorEmail) && (
                        <Alert variant="destructive" className="mb-4">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-sm">
                            <strong>Conflict Detected:</strong> The team's mentor ({selectedTeam.mentorName || selectedTeam.mentorEmail}) is also an evaluator on this panel.
                            This may create a conflict of interest during evaluation.
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Faculty Members Grid */}
                      {teamPanel.facultyMembers && teamPanel.facultyMembers.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                          {teamPanel.facultyMembers.map((faculty, index) => {
                            const isMentor = faculty.uid === selectedTeam?.mentorId || faculty.email === selectedTeam?.mentorEmail;
                            return (
                              <div
                                key={faculty.uid || faculty.email || index}
                                className={`flex items-center gap-3 p-4 rounded-lg border ${isMentor
                                  ? 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-700'
                                  : 'bg-muted/20'
                                  }`}
                              >
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isMentor ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                                  }`}>
                                  {(faculty.name || 'F').charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold truncate">{faculty.name || 'Unknown Faculty'}</span>
                                    {isMentor && (
                                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                        Mentor + Evaluator
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">{faculty.email}</div>
                                </div>
                                <Badge variant="outline" className="flex-shrink-0">#{index + 1}</Badge>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground text-sm">No faculty assigned to this panel</div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[calc(100%-2rem)]">
                      <ClipboardList className="h-12 w-12 text-muted-foreground mb-3" />
                      <h4 className="text-lg font-semibold mb-1">No Panel Assigned</h4>
                      <p className="text-sm text-muted-foreground">This team hasn't been assigned to an evaluation panel yet</p>
                    </div>
                  )}
                </TabsContent>

                {/* ── Tab 5: Grades ── */}
                <TabsContent value="grades" className="mt-0 h-full">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Academic Report Card</h3>
                    {teamGrades.length > 0 && (
                      <div className="flex gap-3 text-xs">
                        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green-500 inline-block" /> Present</span>
                        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block" /> Absent</span>
                      </div>
                    )}
                  </div>
                  {loadingDetails ? (
                    <div className="flex items-center justify-center h-[calc(100%-2rem)]">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                    </div>
                  ) : teamGrades.length > 0 ? (
                    <div className="space-y-4">
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="font-semibold w-[40px]">#</TableHead>
                              <TableHead className="font-semibold">Student</TableHead>
                              <TableHead className="font-semibold">Phase</TableHead>
                              <TableHead className="font-semibold text-center">Attendance</TableHead>
                              <TableHead className="font-semibold text-right">Marks</TableHead>
                              <TableHead className="font-semibold text-right">Max</TableHead>
                              <TableHead className="font-semibold text-right">%</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {teamGrades.map((grade, index) => {
                              const student = allUsers.find(u => u.email === grade.studentEmail);
                              const percentage = grade.maxMarks ? ((grade.marksObtained / grade.maxMarks) * 100).toFixed(1) : 'N/A';
                              const isAbsent = grade.attendance === false || grade.attendance === 'absent';
                              return (
                                <TableRow key={`${grade.id}-${index}`} className={isAbsent ? 'bg-red-50/50 dark:bg-red-950/10' : ''}>
                                  <TableCell className="text-muted-foreground text-xs">{index + 1}</TableCell>
                                  <TableCell>
                                    <div className="font-medium text-sm">{student?.name || 'Unknown'}</div>
                                    <div className="text-[10px] text-muted-foreground">{grade.studentEmail}</div>
                                  </TableCell>
                                  <TableCell><Badge variant="outline" className="text-xs">{grade.phaseName || 'Unknown'}</Badge></TableCell>
                                  <TableCell className="text-center">
                                    {isAbsent
                                      ? <Badge variant="destructive" className="text-xs">Absent</Badge>
                                      : <Badge variant="default" className="bg-green-600 text-xs">Present</Badge>
                                    }
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">{isAbsent ? '—' : (grade.marksObtained || 0)}</TableCell>
                                  <TableCell className="text-right text-muted-foreground">{grade.maxMarks || '—'}</TableCell>
                                  <TableCell className="text-right">
                                    <span className={`font-semibold ${isAbsent ? 'text-red-600' :
                                      parseFloat(percentage) >= 75 ? 'text-green-600' :
                                        parseFloat(percentage) >= 50 ? 'text-yellow-600' : 'text-red-600'
                                      }`}>
                                      {isAbsent ? '0%' : `${percentage}%`}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      {/* Summary row */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg border bg-muted/30 p-3 text-center">
                          <div className="text-2xl font-bold text-primary">{teamGrades.length}</div>
                          <div className="text-xs text-muted-foreground">Total Evaluations</div>
                        </div>
                        <div className="rounded-lg border bg-muted/30 p-3 text-center">
                          <div className="text-2xl font-bold text-green-600">{teamGrades.filter(g => g.attendance !== false && g.attendance !== 'absent').length}</div>
                          <div className="text-xs text-muted-foreground">Present</div>
                        </div>
                        <div className="rounded-lg border bg-muted/30 p-3 text-center">
                          <div className="text-2xl font-bold text-red-600">{teamGrades.filter(g => g.attendance === false || g.attendance === 'absent').length}</div>
                          <div className="text-xs text-muted-foreground">Absent</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[calc(100%-2rem)]">
                      <Award className="h-12 w-12 text-muted-foreground mb-3" />
                      <h4 className="text-lg font-semibold mb-1">No Grades Available</h4>
                      <p className="text-sm text-muted-foreground">This team hasn't received any evaluations yet</p>
                    </div>
                  )}
                </TabsContent>

              </div>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Team Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Team {selectedTeam?.teamCode}</DialogTitle>
            <DialogDescription>
              Update team information. Changes will affect team access, evaluations, and panel assignments.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-group-number">Group Number *</Label>
              <Input
                id="edit-group-number"
                type="number"
                value={editForm.projectNumber}
                onChange={(e) => setEditForm({ ...editForm, projectNumber: e.target.value })}
                placeholder="e.g., 1, 2, 3..."
              />
              <p className="text-xs text-muted-foreground">
                Changing this will update the team code (e.g., G001, G002)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-project-title">Project Title</Label>
              <Input
                id="edit-project-title"
                value={editForm.projectTitle}
                onChange={(e) => setEditForm({ ...editForm, projectTitle: e.target.value })}
                placeholder="e.g., AI Chatbot System"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-leader">Team Leader Email *</Label>
              <Input
                id="edit-leader"
                value={editForm.leaderEmail}
                onChange={(e) => setEditForm({ ...editForm, leaderEmail: e.target.value })}
                placeholder="leader@gehu.ac.in"
                list="students-list"
              />
              <datalist id="students-list">
                {allUsers.filter(u => u.role === 'student').map(u => (
                  <option key={u.email} value={u.email}>{u.name} - {u.email}</option>
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <Label>Additional Members (max 3)</Label>
              {[0, 1, 2].map(idx => (
                <Input
                  key={idx}
                  value={editForm.members[idx] || ''}
                  onChange={(e) => {
                    const newMembers = [...editForm.members];
                    newMembers[idx] = e.target.value;
                    setEditForm({ ...editForm, members: newMembers });
                  }}
                  placeholder={`member${idx + 1}@gehu.ac.in`}
                  list="students-list"
                />
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-mentor">Mentor Email (optional)</Label>
              <Input
                id="edit-mentor"
                value={editForm.mentorEmail}
                onChange={(e) => setEditForm({ ...editForm, mentorEmail: e.target.value })}
                placeholder="mentor@gehu.ac.in"
                list="faculty-list"
              />
              <datalist id="faculty-list">
                {allUsers.filter(u => u.role === 'faculty').map(u => (
                  <option key={u.email} value={u.email}>{u.name} - {u.email}</option>
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">
                Leave empty to remove mentor assignment
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Team Changes
            </DialogTitle>
            <DialogDescription>
              You are about to modify team information. Please review the potential impacts:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs space-y-2">
                <div><strong>Potential Side Effects:</strong></div>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  {editForm.projectNumber !== selectedTeam?.projectNumber?.toString() && (
                    <li>Changing group number affects sorting and display order</li>
                  )}
                  {editForm.leaderEmail !== selectedTeam?.leaderEmail && (
                    <li>Changing team leader transfers project ownership and permissions</li>
                  )}
                  {JSON.stringify(editForm.members) !== JSON.stringify(selectedTeam?.members?.filter(m => m !== selectedTeam?.leaderEmail)) && (
                    <li>Modifying members affects who can access team submissions and evaluations</li>
                  )}
                  {editForm.mentorEmail !== selectedTeam?.mentorEmail && (
                    <li>Changing mentor may affect panel assignments and evaluation access</li>
                  )}
                  <li className="text-amber-700 font-medium">Existing submissions and evaluations will remain linked to this team</li>
                </ul>
              </AlertDescription>
            </Alert>

            <p className="text-sm text-muted-foreground">
              Are you sure you want to proceed with these changes?
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Confirm & Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSession } from '@/context/SessionContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle, XCircle, Clock, FileText, Award, Users, ChevronDown, ChevronRight, Save, Crown } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import PanelEvaluationService from '@/services/panelEvaluationService';

import { logger } from "../../../lib/logger";
export default function PhaseTeamsView({ phase }) {
  const { userData } = useAuth();
  const { activeSession } = useSession();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedTeamId, setExpandedTeamId] = useState(null);
  const [teamMembers, setTeamMembers] = useState({});
  const [teamMarks, setTeamMarks] = useState({});
  const [teamFeedback, setTeamFeedback] = useState({});
  const [savingTeamId, setSavingTeamId] = useState(null);
  const [absentStudents, setAbsentStudents] = useState({});
  // Track current user's panel evaluation status per team (for panel phases only)
  const [currentUserPanelEvaluation, setCurrentUserPanelEvaluation] = useState({});
  const isMentorPhase = phase?.phaseType === 'mentor';
  const isPanelPhase = phase?.phaseType === 'panel';

  const enrichTeamData = async (teamData) => {
    if (!phase?.id) return;

    // Fetch submission for this phase
    const submissionsRef = collection(db, 'submissions');
    const submissionQuery = query(
      submissionsRef,
      where('teamId', '==', teamData.id),
      where('phaseId', '==', phase.id)
    );
    const submissionSnapshot = await getDocs(submissionQuery);

    if (!submissionSnapshot.empty) {
      const submissionData = submissionSnapshot.docs[0].data();
      teamData.submission = {
        id: submissionSnapshot.docs[0].id,
        ...submissionData
      };
      teamData.hasSubmission = true;
      teamData.submittedAt = submissionData.submittedAt;
      teamData.evaluationStatus = submissionData.evaluationStatus || submissionData.status || null;

      if (isPanelPhase) {
        teamData.panelEvaluationProgress = submissionData.panelEvaluationProgress || null;
        teamData.panelEvaluationSummary = submissionData.panelEvaluationSummary || null;
        teamData.isEvaluated = submissionData.evaluationStatus === 'evaluated';
        teamData.averageMarks = submissionData.panelEvaluationSummary?.teamAverage ?? null;

        // Fetch current user's panel evaluation status upfront
        if (userData?.uid) {
          const panelEval = await PanelEvaluationService.checkFacultyEvaluation(
            teamData.id,
            phase.id,
            userData.uid
          );
          teamData.currentUserPanelEval = panelEval;
        }
      }
    } else {
      teamData.hasSubmission = false;
      teamData.submission = null;
      teamData.evaluationStatus = null;

      if (isPanelPhase) {
        teamData.panelEvaluationProgress = null;
        teamData.panelEvaluationSummary = null;
        teamData.isEvaluated = false;
        teamData.averageMarks = null;
        teamData.currentUserPanelEval = { hasEvaluated: false, evaluationId: null, evaluation: null };
      }
    }

    if (!isPanelPhase) {
      const evaluationsRef = collection(db, 'evaluations');
      const evaluationQuery = query(
        evaluationsRef,
        where('teamId', '==', teamData.id),
        where('phaseId', '==', phase.id)
      );
      const evaluationSnapshot = await getDocs(evaluationQuery);

      if (!evaluationSnapshot.empty) {
        const evaluationData = evaluationSnapshot.docs[0].data();
        teamData.evaluation = {
          id: evaluationSnapshot.docs[0].id,
          ...evaluationData
        };
        teamData.isEvaluated = true;

        if (evaluationData.marks && evaluationData.marks.length > 0) {
          const totalMarks = evaluationData.marks.reduce((sum, m) => sum + m.marks, 0);
          teamData.averageMarks = totalMarks / evaluationData.marks.length;
        }
      } else {
        teamData.isEvaluated = false;
      }
    }

    if (teamData.leaderEmail) {
      const leaderRef = doc(db, 'users', teamData.leaderEmail);
      const leaderSnap = await getDoc(leaderRef);
      if (leaderSnap.exists()) {
        teamData.leaderName = leaderSnap.data().name;
      }
    }
  };

  // Fetch teams (mentored + panel assigned)
  useEffect(() => {
    const fetchTeams = async () => {
      if (!userData?.uid || !activeSession?.id || !phase?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true); // Ensure loading state is set
        const teamsData = [];
        const teamIds = new Set(); // Track team IDs to avoid duplicates

        // Check phase type to determine which teams to fetch
        const isMentorPhase = phase.phaseType === 'mentor';
        const isPanelPhase = phase.phaseType === 'panel';


        // 1. Fetch mentored teams (ONLY if it's a mentor phase)
        if (isMentorPhase) {
          const mentoredTeamsRef = collection(db, 'teams');
          const mentoredQuery = query(
            mentoredTeamsRef,
            where('sessionId', '==', activeSession.id),
            where('mentorEmail', '==', userData.email)
          );
          const mentoredSnapshot = await getDocs(mentoredQuery);

          // Batch: collect all teams first, then enrich in parallel
          const mentoredTeamsBatch = mentoredSnapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data(),
            isMentored: true
          }));
          await Promise.all(mentoredTeamsBatch.map(teamData => enrichTeamData(teamData)));
          mentoredTeamsBatch.forEach(teamData => {
            teamsData.push(teamData);
            teamIds.add(teamData.id);
          });
        }

        // 2. Fetch panel teams (ONLY if it's a panel phase)
        if (isPanelPhase) {
          const panelsRef = collection(db, 'panels');
          const panelsQuery = query(
            panelsRef,
            where('sessionId', '==', activeSession.id)
          );
          const panelsSnapshot = await getDocs(panelsQuery);

          const facultyPanels = [];
          panelsSnapshot.forEach(doc => {
            const panelData = doc.data();
            // Check both UID and email for data consistency (some panels store email as uid)
            const isMember = panelData.facultyMembers?.some(
              member => member.uid === userData.uid ||
                member.uid === userData.email ||
                member.email === userData.email
            );
            if (isMember) {
              facultyPanels.push(doc.id);
            }
          });


          if (facultyPanels.length > 0) {
            const panelTeamsRef = collection(db, 'teams');
            const panelTeamsQuery = query(
              panelTeamsRef,
              where('sessionId', '==', activeSession.id),
              where('panelId', 'in', facultyPanels.slice(0, 10))
            );
            const panelTeamsSnapshot = await getDocs(panelTeamsQuery);


            // Batch: collect teams first, mark both, then enrich in parallel
            const panelTeamsBatch = panelTeamsSnapshot.docs.map(docSnap => {
              const teamData = { id: docSnap.id, ...docSnap.data(), isPanelTeam: true };
              if (teamData.mentorEmail === userData.email) {
                teamData.isMentored = true;
                teamData.isBothMentorAndPanel = true;
              }
              return teamData;
            });

            await Promise.all(panelTeamsBatch.map(teamData => enrichTeamData(teamData)));

            panelTeamsBatch.forEach(teamData => {
              if (!teamIds.has(teamData.id)) {
                teamsData.push(teamData);
                teamIds.add(teamData.id);
              } else {
                const existingTeam = teamsData.find(t => t.id === teamData.id);
                if (existingTeam) {
                  existingTeam.isPanelTeam = true;
                  existingTeam.isBothMentorAndPanel = true;
                }
              }
            });
          } else {
          }
        }

        setTeams(teamsData);

        // Populate currentUserPanelEvaluation state from enriched team data
        if (isPanelPhase) {
          const panelEvalMap = {};
          teamsData.forEach(team => {
            if (team.currentUserPanelEval) {
              panelEvalMap[team.id] = team.currentUserPanelEval;
            }
          });
          setCurrentUserPanelEvaluation(panelEvalMap);
        }
      } catch (error) {
        logger.error('Error fetching teams:', error);
        toast.error('Failed to load teams');
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, [userData?.uid, activeSession?.id, phase?.id, phase?.phaseType]);

  // Refetch teams data (used after saving evaluation)
  const refetchTeams = async () => {
    setLoading(true);

    if (!userData?.uid || !activeSession?.id || !phase?.id) {
      setLoading(false);
      return;
    }

    try {
      const teamsData = [];
      const teamIds = new Set(); // Track team IDs to avoid duplicates

      // Check phase type to determine which teams to fetch
      const isMentorPhase = phase.phaseType === 'mentor';
      const isPanelPhase = phase.phaseType === 'panel';


      // 1. Fetch mentored teams (ONLY if it's a mentor phase)
      if (isMentorPhase) {
        const mentoredTeamsRef = collection(db, 'teams');
        const mentoredQuery = query(
          mentoredTeamsRef,
          where('sessionId', '==', activeSession.id),
          where('mentorEmail', '==', userData.email)
        );
        const mentoredSnapshot = await getDocs(mentoredQuery);

        // Batch: collect all teams first, then enrich in parallel
        const mentoredTeamsBatch = mentoredSnapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
          isMentored: true
        }));
        await Promise.all(mentoredTeamsBatch.map(teamData => enrichTeamData(teamData)));
        mentoredTeamsBatch.forEach(teamData => {
          teamsData.push(teamData);
          teamIds.add(teamData.id);
        });
      }

      // 2. Fetch panel teams (ONLY if it's a panel phase)
      if (isPanelPhase) {
        const panelsRef = collection(db, 'panels');
        const panelsQuery = query(
          panelsRef,
          where('sessionId', '==', activeSession.id)
        );
        const panelsSnapshot = await getDocs(panelsQuery);

        const facultyPanels = [];
        panelsSnapshot.forEach(doc => {
          const panelData = doc.data();
          // Check both UID and email for data consistency (some panels store email as uid)
          const isMember = panelData.facultyMembers?.some(
            member => member.uid === userData.uid ||
              member.uid === userData.email ||
              member.email === userData.email
          );
          if (isMember) {
            facultyPanels.push(doc.id);
          }
        });

        if (facultyPanels.length > 0) {
          const panelTeamsRef = collection(db, 'teams');
          const panelTeamsQuery = query(
            panelTeamsRef,
            where('sessionId', '==', activeSession.id),
            where('panelId', 'in', facultyPanels.slice(0, 10))
          );
          const panelTeamsSnapshot = await getDocs(panelTeamsQuery);

          // Batch: collect teams first, mark both, then enrich in parallel
          const panelTeamsBatch = panelTeamsSnapshot.docs.map(docSnap => {
            const teamData = { id: docSnap.id, ...docSnap.data(), isPanelTeam: true };
            if (teamData.mentorEmail === userData.email) {
              teamData.isMentored = true;
              teamData.isBothMentorAndPanel = true;
            }
            return teamData;
          });

          await Promise.all(panelTeamsBatch.map(teamData => enrichTeamData(teamData)));

          panelTeamsBatch.forEach(teamData => {
            if (!teamIds.has(teamData.id)) {
              teamsData.push(teamData);
              teamIds.add(teamData.id);
            } else {
              const existingTeam = teamsData.find(t => t.id === teamData.id);
              if (existingTeam) {
                existingTeam.isPanelTeam = true;
                existingTeam.isBothMentorAndPanel = true;
              }
            }
          });
        }
      }

      setTeams(teamsData);

      // Populate currentUserPanelEvaluation state from enriched team data
      if (isPanelPhase) {
        const panelEvalMap = {};
        teamsData.forEach(team => {
          if (team.currentUserPanelEval) {
            panelEvalMap[team.id] = team.currentUserPanelEval;
          }
        });
        setCurrentUserPanelEvaluation(panelEvalMap);
      }
    } catch (error) {
      logger.error('Error refetching teams:', error);
      toast.error('Failed to reload teams');
    } finally {
      setLoading(false);
    }
  };

  // Toggle team expansion
  const toggleTeamExpansion = async (teamId) => {
    if (expandedTeamId === teamId) {
      setExpandedTeamId(null);
      return;
    }

    setExpandedTeamId(teamId);

    const team = teams.find(t => t.id === teamId);
    if (!team?.members) return;

    try {
      // Fetch members if not already loaded
      let membersData = teamMembers[teamId];
      if (!membersData) {
        const memberPromises = team.members.map(async (email) => {
          const userRef = doc(db, 'users', email);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            return { email, ...userSnap.data() };
          }
          return { email, name: 'Unknown User' };
        });

        membersData = await Promise.all(memberPromises);
        setTeamMembers(prev => ({ ...prev, [teamId]: membersData }));
      }

      // Fetch evaluation data based on phase type
      if (isPanelPhase) {
        // Panel phase: Use PanelEvaluationService to get ONLY current user's evaluation
        const panelEval = await PanelEvaluationService.checkFacultyEvaluation(
          teamId,
          phase.id,
          userData.uid
        );

        // Store current user's panel evaluation status
        setCurrentUserPanelEvaluation(prev => ({
          ...prev,
          [teamId]: panelEval
        }));

        if (panelEval.hasEvaluated && panelEval.evaluation) {
          // Pre-fill ONLY this panelist's marks
          const marksMap = {};
          const absents = {};

          panelEval.evaluation.marks?.forEach(mark => {
            marksMap[mark.studentEmail] = mark.marks !== undefined ? mark.marks : '';
            if (mark.isAbsent) {
              absents[mark.studentEmail] = true;
            }
          });

          setTeamMarks(prev => ({ ...prev, [teamId]: marksMap }));
          setAbsentStudents(prev => ({ ...prev, [teamId]: absents }));
          setTeamFeedback(prev => ({ ...prev, [teamId]: panelEval.evaluation.feedback || '' }));
        } else {
          // Initialize empty marks for new evaluation
          const marksMap = {};
          membersData.forEach(member => {
            marksMap[member.email] = '';
          });
          setTeamMarks(prev => ({ ...prev, [teamId]: marksMap }));
          setAbsentStudents(prev => ({ ...prev, [teamId]: {} }));
          setTeamFeedback(prev => ({ ...prev, [teamId]: '' }));
        }
      } else {
        // Mentor phase: Use regular evaluations collection
        const evaluationsRef = collection(db, 'evaluations');
        const evaluationQuery = query(
          evaluationsRef,
          where('teamId', '==', teamId),
          where('phaseId', '==', phase.id)
        );
        const evaluationSnapshot = await getDocs(evaluationQuery);

        if (!evaluationSnapshot.empty) {
          const evaluationData = evaluationSnapshot.docs[0].data();
          const marksMap = {};
          const absents = {};

          evaluationData.marks?.forEach(mark => {
            // Handle marks properly - could be 0 which is valid
            marksMap[mark.studentEmail] = mark.marks !== undefined ? mark.marks : '';
            if (mark.isAbsent) {
              absents[mark.studentEmail] = true;
            }
          });

          setTeamMarks(prev => ({ ...prev, [teamId]: marksMap }));
          setAbsentStudents(prev => ({ ...prev, [teamId]: absents }));
          setTeamFeedback(prev => ({ ...prev, [teamId]: evaluationData.feedback || '' }));
        } else {
          // Initialize empty marks if no evaluation exists
          const marksMap = {};
          membersData.forEach(member => {
            marksMap[member.email] = '';
          });
          setTeamMarks(prev => ({ ...prev, [teamId]: marksMap }));
          setAbsentStudents(prev => ({ ...prev, [teamId]: {} }));
          setTeamFeedback(prev => ({ ...prev, [teamId]: '' }));
        }
      }
    } catch (error) {
      logger.error('Error fetching team members or evaluation:', error);
      toast.error('Failed to load team data');
    }
  };

  // Handle mark change
  const handleMarkChange = (teamId, email, value) => {
    const numValue = value === '' ? '' : parseFloat(value);

    if (numValue !== '' && (numValue < 0 || numValue > phase.maxMarks)) {
      toast.error(`Marks must be between 0 and ${phase.maxMarks}`);
      return;
    }

    setTeamMarks(prev => ({
      ...prev,
      [teamId]: {
        ...prev[teamId],
        [email]: numValue
      }
    }));
  };

  // Handle feedback change
  const handleFeedbackChange = (teamId, value) => {
    setTeamFeedback(prev => ({ ...prev, [teamId]: value }));
  };

  // Toggle absent status for a student
  const toggleAbsent = (teamId, email) => {
    setAbsentStudents(prev => ({
      ...prev,
      [teamId]: {
        ...(prev[teamId] || {}),
        [email]: !(prev[teamId]?.[email])
      }
    }));

    // If marking as absent, clear their marks
    if (!absentStudents[teamId]?.[email]) {
      setTeamMarks(prev => ({
        ...prev,
        [teamId]: {
          ...prev[teamId],
          [email]: 0
        }
      }));
    }
  };

  // Save evaluation
  const saveEvaluation = async (teamId) => {
    const team = teams.find(t => t.id === teamId);
    const members = teamMembers[teamId];
    const marks = teamMarks[teamId];
    const feedback = teamFeedback[teamId];
    const absents = absentStudents[teamId] || {};

    // Validate - ensure all students either have marks or are marked absent
    for (const member of members) {
      const isAbsent = absents[member.email];
      const hasMarks = marks[member.email] !== '' && marks[member.email] !== undefined;

      if (!isAbsent && !hasMarks) {
        toast.error(`Please enter marks for ${member.name} or mark them as absent`);
        return;
      }
    }

    if (!feedback?.trim()) {
      toast.error('Please provide feedback');
      return;
    }

    setSavingTeamId(teamId);

    try {
      // Prepare marks array with absent flag
      const marksArray = members.map(member => ({
        studentEmail: member.email,
        studentName: member.name,
        marks: absents[member.email] ? 0 : (marks[member.email] || 0),
        isAbsent: absents[member.email] || false
      }));

      const evaluationData = {
        teamId: team.id,
        phaseId: phase.id,
        phaseName: phase.phaseName || phase.name,
        maxMarks: phase.maxMarks,
        marks: marksArray,
        feedback: feedback.trim(),
        evaluatedBy: userData.uid,
        evaluatedAt: serverTimestamp(),
        isDraft: false,
        sessionId: team.sessionId
      };

      if (isPanelPhase) {
        // Panel phase: Use PanelEvaluationService to save to panelEvaluations collection
        const existingEvalId = currentUserPanelEvaluation[teamId]?.evaluationId || null;

        const panelEvalData = {
          teamId: team.id,
          phaseId: phase.id,
          phaseName: phase.phaseName || phase.name,
          evaluatorId: userData.uid,
          evaluatorEmail: userData.email,
          evaluatorName: userData.name,
          marks: marksArray,
          feedback: feedback.trim(),
          maxMarks: phase.maxMarks,
          sessionId: team.sessionId
        };

        const result = await PanelEvaluationService.submitPanelEvaluation(
          panelEvalData,
          existingEvalId
        );

        if (result.success) {
          toast.success(existingEvalId ? 'Your evaluation updated successfully' : 'Your evaluation submitted successfully');
          // Update local state with new evaluation info
          setCurrentUserPanelEvaluation(prev => ({
            ...prev,
            [teamId]: {
              hasEvaluated: true,
              evaluationId: result.evaluationId,
              evaluation: panelEvalData
            }
          }));
        } else {
          throw new Error(result.error || 'Failed to save panel evaluation');
        }
      } else {
        // Mentor phase: Use regular evaluations collection
        if (team.evaluation) {
          // Update existing evaluation
          const evalRef = doc(db, 'evaluations', team.evaluation.id);
          await updateDoc(evalRef, {
            ...evaluationData,
            updatedAt: serverTimestamp()
          });
          toast.success('Evaluation updated successfully');
        } else {
          // Create new evaluation
          await addDoc(collection(db, 'evaluations'), evaluationData);
          toast.success('Evaluation submitted successfully');
        }
      }

      // Create/Update individual grade records for each student
      for (const member of members) {
        const memberMarks = absents[member.email] ? 0 : (marks[member.email] || 0);
        const isAbsent = absents[member.email] || false;

        // Check if grade already exists for this student and phase
        const gradesQuery = query(
          collection(db, 'grades'),
          where('studentEmail', '==', member.email),
          where('phaseId', '==', phase.id),
          where('teamId', '==', team.id)
        );
        const gradesSnapshot = await getDocs(gradesQuery);

        const gradeData = {
          studentEmail: member.email,
          studentName: member.name,
          studentId: member.uid || '', // May need to fetch UID if not available
          teamId: team.id,
          teamName: `Project ${team.projectNumber}` || 'Unknown Team',
          projectNumber: team.projectNumber,
          phaseId: phase.id,
          phaseName: phase.phaseName || phase.name,
          maxMarks: phase.maxMarks,
          marks: memberMarks,
          isAbsent: isAbsent,
          feedback: feedback.trim(),
          evaluatedBy: userData.uid,
          evaluatedAt: serverTimestamp(),
          sessionId: team.sessionId
        };

        if (!gradesSnapshot.empty) {
          // Update existing grade
          const gradeDocId = gradesSnapshot.docs[0].id;
          await updateDoc(doc(db, 'grades', gradeDocId), {
            ...gradeData,
            updatedAt: serverTimestamp()
          });
        } else {
          // Create new grade record
          await addDoc(collection(db, 'grades'), gradeData);
        }
      }

      // Update submission status if exists
      if (team.submission?.id) {
        const submissionRef = doc(db, 'submissions', team.submission.id);
        await updateDoc(submissionRef, {
          status: 'evaluated',
          evaluationStatus: 'evaluated',
          evaluatedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      // Refresh teams data
      await refetchTeams();
      setExpandedTeamId(null);
    } catch (error) {
      logger.error('Error saving evaluation:', error);
      toast.error('Failed to save evaluation');
    } finally {
      setSavingTeamId(null);
    }
  };

  // Get initials for avatar
  const getInitials = (name) => {
    if (!name || name === 'Unknown' || name === 'Unknown User') return '?';
    const parts = name.trim().split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0]?.substring(0, 2).toUpperCase() || '?';
  };

  // Filter teams
  const filteredTeams = teams.filter(team => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'submitted') return team.hasSubmission;
    if (filterStatus === 'not_submitted') return !team.hasSubmission;
    if (filterStatus === 'evaluated') return team.isEvaluated;
    if (filterStatus === 'pending_evaluation') return team.hasSubmission && !team.isEvaluated;
    return true;
  });

  // Get submission status badge
  const getSubmissionBadge = (team) => {
    if (!team.hasSubmission) {
      return { icon: XCircle, text: 'Not Submitted', className: 'bg-gray-500 hover:bg-gray-600' };
    }

    if (isPanelPhase) {
      const status = team.evaluationStatus || 'submitted';
      const awaitingLabel = team.panelEvaluationProgress?.statusLabel;
      const statusMap = {
        evaluated: { icon: CheckCircle, text: 'Evaluated', className: 'bg-green-500 hover:bg-green-600' },
        awaiting_panelists: {
          icon: Clock,
          text: awaitingLabel || 'Awaiting Panelist',
          className: 'bg-amber-500 hover:bg-amber-600'
        },
        absent: { icon: XCircle, text: 'Marked Absent', className: 'bg-red-600 hover:bg-red-700' },
        revisions_requested: { icon: Clock, text: 'Revisions Requested', className: 'bg-orange-500 hover:bg-orange-600' },
        submitted: { icon: Clock, text: 'Submitted', className: 'bg-blue-500 hover:bg-blue-600' }
      };
      return statusMap[status] || statusMap.submitted;
    }

    if (team.isEvaluated) {
      return { icon: CheckCircle, text: 'Evaluated', className: 'bg-green-500 hover:bg-green-600' };
    }

    return { icon: Clock, text: 'Submitted', className: 'bg-blue-500 hover:bg-blue-600' };
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter and Stats */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">Filter by Status</label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams ({teams.length})</SelectItem>
              <SelectItem value="submitted">
                Submitted ({teams.filter(t => t.hasSubmission).length})
              </SelectItem>
              <SelectItem value="not_submitted">
                Not Submitted ({teams.filter(t => !t.hasSubmission).length})
              </SelectItem>
              <SelectItem value="evaluated">
                Evaluated ({teams.filter(t => t.isEvaluated).length})
              </SelectItem>
              <SelectItem value="pending_evaluation">
                Pending Evaluation ({teams.filter(t => t.hasSubmission && !t.isEvaluated).length})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quick Stats */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>{teams.filter(t => t.isEvaluated).length} Evaluated</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>{teams.filter(t => t.hasSubmission && !t.isEvaluated).length} Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span>{teams.filter(t => !t.hasSubmission).length} Not Submitted</span>
          </div>
        </div>
      </div>

      {/* Teams List - Collapsible Cards */}
      {filteredTeams.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No teams found for this filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTeams.map((team) => {
            const statusInfo = getSubmissionBadge(team);
            const StatusIcon = statusInfo.icon;
            const isExpanded = expandedTeamId === team.id;
            const members = teamMembers[team.id] || [];
            const marks = teamMarks[team.id] || {};
            const feedback = teamFeedback[team.id] || '';

            return (
              <Card key={team.id} className="overflow-hidden border-2 hover:border-teal-300 transition-colors">
                {/* Team Header - Always Visible */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleTeamExpansion(team.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      {/* Expand/Collapse Icon */}
                      <div className="shrink-0">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-teal-600" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        )}
                      </div>

                      {/* Team Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-lg truncate">
                            Project #{team.projectNumber || 'N/A'}
                          </h4>
                          <Badge variant="outline" className="text-xs shrink-0">
                            #{team.projectNumber}
                          </Badge>
                          {team.isMentored && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 shrink-0">
                              <Crown className="h-3 w-3 mr-1" />
                              Mentored
                            </Badge>
                          )}
                          {team.isPanelTeam && (
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 shrink-0">
                              <Users className="h-3 w-3 mr-1" />
                              Panel Team
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Leader: {team.leaderName || 'Unknown'}</span>
                          <span>•</span>
                          <span>{team.members?.length || 0} members</span>
                        </div>
                        {/* Panel phase: Show only current user's evaluation summary, not aggregate data from other panelists */}
                        {isPanelPhase && currentUserPanelEvaluation[team.id]?.hasEvaluated && currentUserPanelEvaluation[team.id]?.evaluation?.marks && (
                          <div className="text-xs mt-1 space-y-0.5">
                            <p className="text-gray-600">
                              Your Marks: {currentUserPanelEvaluation[team.id].evaluation.marks
                                .filter(m => !m.isAbsent)
                                .map(m => `${m.studentName?.split(' ')[0] || m.studentEmail?.split('@')[0]}: ${m.marks}`)
                                .join(' • ')}
                            </p>
                            {currentUserPanelEvaluation[team.id].evaluation.marks.some(m => m.isAbsent) && (
                              <p className="text-red-600">
                                You Marked Absent: {currentUserPanelEvaluation[team.id].evaluation.marks
                                  .filter(m => m.isAbsent)
                                  .map(m => m.studentName?.split(' ')[0] || m.studentEmail?.split('@')[0])
                                  .join(', ')}
                              </p>
                            )}
                          </div>
                        )}
                        {/* Show evaluation summary for mentor phases */}
                        {!isPanelPhase && team.isEvaluated && team.evaluation?.marks && (
                          <div className="text-xs mt-1 space-y-0.5">
                            <p className="text-gray-600">
                              Marks: {team.evaluation.marks
                                .filter(m => !m.isAbsent)
                                .map(m => `${m.studentName?.split(' ')[0] || m.studentEmail?.split('@')[0]}: ${m.marks}`)
                                .join(' • ')}
                            </p>
                            {team.evaluation.marks.some(m => m.isAbsent) && (
                              <p className="text-red-600">
                                Absent: {team.evaluation.marks
                                  .filter(m => m.isAbsent)
                                  .map(m => m.studentName?.split(' ')[0] || m.studentEmail?.split('@')[0])
                                  .join(', ')}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge className={statusInfo.className}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusInfo.text}
                        </Badge>

                        {isPanelPhase ? (
                          // Panel phase: Show current user's evaluation status
                          currentUserPanelEvaluation[team.id]?.hasEvaluated ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              You Evaluated
                            </Badge>
                          ) : team.hasSubmission ? (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                              <Clock className="h-3 w-3 mr-1" />
                              Your Eval Pending
                            </Badge>
                          ) : null
                        ) : (
                          // Mentor phase: Show overall evaluation status
                          team.isEvaluated ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Evaluated
                            </Badge>
                          ) : team.hasSubmission ? (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          ) : null
                        )}

                        {team.isEvaluated && team.averageMarks != null && (
                          <span className="text-lg font-bold text-teal-600">
                            {team.averageMarks.toFixed(1)} / {phase.maxMarks}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Content - Team Members & Marking */}
                {isExpanded && (
                  <CardContent className="border-t bg-gray-50 p-4">
                    {members.length === 0 ? (
                      <div className="text-center py-4 text-gray-500">
                        Loading team members...
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                          <h5 className="font-semibold flex items-center gap-2">
                            <Users className="h-4 w-4 text-teal-600" />
                            Team Members ({members.length})
                          </h5>
                          {team.submittedAt && (
                            <span className="text-sm text-gray-600">
                              Submitted: {format(team.submittedAt.toDate(), 'MMM dd, yyyy')}
                            </span>
                          )}
                        </div>

                        {/* Previously Evaluated Notice */}
                        {isPanelPhase ? (
                          // Panel phase: Show current user's evaluation status
                          currentUserPanelEvaluation[team.id]?.hasEvaluated && (
                            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                              <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                                <CheckCircle className="h-4 w-4" />
                                <span>You Previously Evaluated This Team</span>
                                {currentUserPanelEvaluation[team.id]?.evaluation?.submittedAt && (
                                  <span className="text-xs text-green-600 font-normal">
                                    on {format(currentUserPanelEvaluation[team.id].evaluation.submittedAt.toDate?.() || new Date(currentUserPanelEvaluation[team.id].evaluation.submittedAt), 'MMM dd, yyyy')}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-green-600">
                                Your feedback has been recorded. You can update your evaluation below.
                              </p>
                            </div>
                          )
                        ) : (
                          // Mentor phase: Show overall evaluation status
                          team.isEvaluated && team.evaluation && (
                            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                              <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                                <CheckCircle className="h-4 w-4" />
                                <span>Previously Evaluated</span>
                                {team.evaluation.evaluatedAt && (
                                  <span className="text-xs text-green-600 font-normal">
                                    on {format(team.evaluation.evaluatedAt.toDate?.() || new Date(team.evaluation.evaluatedAt), 'MMM dd, yyyy')}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-green-600">
                                Average: <strong>{team.averageMarks?.toFixed(1) || 'N/A'}</strong> / {phase.maxMarks}
                                {team.evaluation.feedback && (
                                  <span className="ml-3">• Feedback provided</span>
                                )}
                              </p>
                            </div>
                          )
                        )}

                        {/* Members List with Inline Marks */}
                        <div className="space-y-3">
                          {members.map((member) => {
                            const isLeader = member.email === team.leaderEmail;
                            const isAbsent = absentStudents[team.id]?.[member.email] || false;
                            const currentMarks = marks[member.email];
                            const hasMarks = currentMarks !== '' && currentMarks !== undefined;

                            return (
                              <div
                                key={member.email}
                                className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white border rounded-lg hover:shadow-sm transition-shadow ${isAbsent ? 'opacity-60 bg-red-50 border-red-200' :
                                  hasMarks ? 'bg-green-50 border-green-200' : ''
                                  }`}
                              >
                                {/* Member Info Row */}
                                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                  <Avatar className="h-10 w-10 sm:h-12 sm:w-12 shrink-0">
                                    <AvatarFallback className={isLeader ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}>
                                      {getInitials(member.name)}
                                    </AvatarFallback>
                                  </Avatar>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <p className="font-medium text-sm sm:text-base truncate">{member.name || 'Unknown'}</p>
                                      {isLeader && (
                                        <Badge className="text-xs bg-blue-600 shrink-0">
                                          <Crown className="h-3 w-3 mr-1" />
                                          Leader
                                        </Badge>
                                      )}
                                      {isAbsent && (
                                        <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-300 shrink-0">
                                          Absent
                                        </Badge>
                                      )}
                                      {hasMarks && !isAbsent && (
                                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300 shrink-0">
                                          <CheckCircle className="h-3 w-3 mr-1" />
                                          {currentMarks} / {phase.maxMarks}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-500 truncate">{member.email}</p>
                                  </div>
                                </div>

                                {/* Controls Row - stacks on mobile */}
                                <div className="flex items-center gap-3 sm:gap-4 shrink-0 pl-13 sm:pl-0">
                                  {/* Absent Checkbox */}
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      id={`absent-${team.id}-${member.email}`}
                                      checked={isAbsent}
                                      onCheckedChange={() => toggleAbsent(team.id, member.email)}
                                    />
                                    <Label
                                      htmlFor={`absent-${team.id}-${member.email}`}
                                      className="text-sm font-medium cursor-pointer"
                                    >
                                      Absent
                                    </Label>
                                  </div>

                                  {/* Marks Input */}
                                  <div className="flex items-center gap-2">
                                    <Label htmlFor={`marks-${team.id}-${member.email}`} className="text-sm font-medium">
                                      Marks:
                                    </Label>
                                    <div className="relative w-24 sm:w-32">
                                      <Input
                                        id={`marks-${team.id}-${member.email}`}
                                        type="number"
                                        value={currentMarks ?? ''}
                                        onChange={(e) => handleMarkChange(team.id, member.email, e.target.value)}
                                        placeholder="0"
                                        min="0"
                                        max={phase.maxMarks}
                                        step="0.5"
                                        className={`pr-10 sm:pr-12 text-sm ${hasMarks && !isAbsent ? 'border-green-300 bg-green-50' : ''}`}
                                        disabled={isAbsent}
                                      />
                                      <span className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-gray-500">
                                        / {phase.maxMarks}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <Separator className="my-4" />

                        {/* Feedback Section */}
                        <div className="space-y-2">
                          <Label htmlFor={`feedback-${team.id}`} className="font-medium">
                            Feedback <span className="text-red-500">*</span>
                          </Label>
                          <Textarea
                            id={`feedback-${team.id}`}
                            value={feedback}
                            onChange={(e) => handleFeedbackChange(team.id, e.target.value)}
                            placeholder="Provide detailed feedback on the team's work..."
                            rows={4}
                            className="resize-none"
                          />
                        </div>

                        {/* Submit Button */}
                        <div className="flex items-center justify-between pt-4 border-t">
                          <div className="text-sm text-gray-600">
                            {isPanelPhase ? (
                              // Panel phase: Show current user's status
                              currentUserPanelEvaluation[team.id]?.hasEvaluated ? (
                                <span className="flex items-center gap-1 text-green-600">
                                  <CheckCircle className="h-4 w-4" />
                                  You evaluated this team - update your marks below
                                </span>
                              ) : (
                                <span>Enter marks for all members to submit your evaluation</span>
                              )
                            ) : (
                              // Mentor phase: Show overall status
                              team.isEvaluated ? (
                                <span className="flex items-center gap-1 text-green-600">
                                  <CheckCircle className="h-4 w-4" />
                                  Previously evaluated - you can update it
                                </span>
                              ) : (
                                <span>Enter marks for all members to submit evaluation</span>
                              )
                            )}
                          </div>
                          <Button
                            onClick={() => saveEvaluation(team.id)}
                            disabled={savingTeamId === team.id || !team.hasSubmission}
                            className="gap-2"
                          >
                            {savingTeamId === team.id ? (
                              <>
                                <Clock className="h-4 w-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4" />
                                {isPanelPhase
                                  ? (currentUserPanelEvaluation[team.id]?.hasEvaluated ? 'Update Your Evaluation' : 'Submit Your Evaluation')
                                  : (team.isEvaluated ? 'Update Evaluation' : 'Submit Evaluation')
                                }
                              </>
                            )}
                          </Button>
                        </div>

                        {!team.hasSubmission && (
                          <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-3">
                            <strong>Note:</strong> This team hasn't submitted their work yet. You can only evaluate after submission.
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

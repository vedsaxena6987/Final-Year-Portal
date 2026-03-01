// components/dashboard/external/ExternalEvaluatorDashboard.jsx
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSession } from '@/context/SessionContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, writeBatch, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { FileText, Users, CheckCircle, Clock, Star, Eye, Calendar, ChevronLeft, ChevronRight, Menu, HelpCircle, Award, TrendingUp, Target, LogOut, Video, MapPin, Plus, X, AlertCircle, Trash2, User } from 'lucide-react';
import MeetingService from '@/services/meetingService';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import ProfileSection from '@/components/dashboard/ProfileSection';
import Footer from '@/components/dashboard/shared/Footer';

import { logger } from "../../../lib/logger";
export default function ExternalEvaluatorDashboard() {
  const { userData } = useAuth();
  const { activeSession } = useSession();
  const [assignedTeams, setAssignedTeams] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [externalPhases, setExternalPhases] = useState([]);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [memberGrades, setMemberGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [evaluationDialog, setEvaluationDialog] = useState(false);
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Member-wise evaluation state (similar to mentor pattern)
  const [memberEvaluations, setMemberEvaluations] = useState([]);
  const [teamFeedback, setTeamFeedback] = useState('');
  
  const [meetings, setMeetings] = useState([]);
  const [meetingDialog, setMeetingDialog] = useState(false);
  const [meetingForm, setMeetingForm] = useState({
    selectedTeams: [],
    meetingType: 'online',
    meetingLink: '',
    venue: '',
    scheduledDate: '',
    scheduledTime: '',
    endTime: '',
    agenda: ''
  });
  
  const [teamDetailsDialog, setTeamDetailsDialog] = useState(false);
  const [selectedTeamDetails, setSelectedTeamDetails] = useState(null);

  // Load sidebar collapse state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('externalDashboardSidebarCollapsed');
    if (saved !== null) {
      setSidebarCollapsed(JSON.parse(saved));
    }
  }, []);

  // Save sidebar collapse state to localStorage
  const toggleSidebar = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem('externalDashboardSidebarCollapsed', JSON.stringify(newState));
  };

  // Restore tab from URL on page load
  useEffect(() => {
    const tab = searchParams.get('tab');
    const validTabs = ['dashboard', 'assigned', 'meetings', 'evaluations', 'help', 'profile'];
    if (tab && validTabs.includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Logged out successfully');
      router.push('/login');
    } catch (error) {
      logger.error('Logout error:', error);
      toast.error('Failed to logout', { description: error.message });
    }
  };

  useEffect(() => {
    if (!userData?.email || userData.role !== 'external_evaluator' || !activeSession?.id) return;

    // Load external phases
    const phasesQuery = query(
      collection(db, 'phases'),
      where('phaseType', '==', 'external'),
      where('sessionId', '==', activeSession.id)
    );

    const unsubscribePhases = onSnapshot(phasesQuery, (snapshot) => {
      const phasesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate()
      }));
      setExternalPhases(phasesList);
      
      // Auto-select first active phase or first phase
      if (phasesList.length > 0 && !selectedPhase) {
        const activePhase = phasesList.find(p => {
          const now = new Date();
          return p.startDate <= now && p.endDate >= now;
        });
        setSelectedPhase(activePhase || phasesList[0]);
      }
    });

    // Listen for teams assigned to this external evaluator
    // Note: externalEvaluatorId is set to the evaluator's email (document ID in users collection)
    const teamsQuery = query(
      collection(db, 'teams'),
      where('externalEvaluatorId', '==', userData.email)
    );

    const unsubscribeTeams = onSnapshot(teamsQuery, async (snapshot) => {
      const teamsList = await Promise.all(
        snapshot.docs.map(async (teamDoc) => {
          const teamData = { id: teamDoc.id, ...teamDoc.data() };

          // Fetch team members details
          if (teamData.members && Array.isArray(teamData.members)) {
            const memberDetails = await Promise.all(
              teamData.members.map(async (memberEmail) => {
                try {
                  const userDoc = await getDoc(doc(db, "users", memberEmail));
                  return userDoc.exists() ? { email: memberEmail, ...userDoc.data() } : { email: memberEmail, name: "Unknown User" };
                } catch (error) {
                  logger.error(`Error fetching member ${memberEmail}:`, error);
                  return { email: memberEmail, name: "Error Loading User" };
                }
              })
            );
            teamData.memberDetails = memberDetails;
          }

          return teamData;
        })
      );

      setAssignedTeams(teamsList);
      setLoading(false);
    });

    // Listen for external phase submissions
    const submissionsQuery = query(
      collection(db, 'submissions')
    );

    const unsubscribeSubmissions = onSnapshot(submissionsQuery, (snapshot) => {
      const externalPhaseIds = externalPhases.map(p => p.id);
      const submissionsList = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          submittedAt: doc.data().submittedAt?.toDate()
        }))
        .filter(s => externalPhaseIds.includes(s.phaseId) || s.phaseType === 'external');
      setSubmissions(submissionsList);
    });

    // Listen for team-level evaluations (evaluations collection)
    const evaluationsQuery = query(
      collection(db, 'evaluations'),
      where('evaluatedBy', '==', userData.uid)
    );

    const unsubscribeEvaluations = onSnapshot(evaluationsQuery, (snapshot) => {
      const evaluationsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        evaluatedAt: doc.data().evaluatedAt?.toDate()
      }));
      setEvaluations(evaluationsList);
    });

    // Listen for member grades (grades collection)
    const gradesQuery = query(
      collection(db, 'grades'),
      where('evaluatedBy', '==', userData.uid)
    );

    const unsubscribeGrades = onSnapshot(gradesQuery, (snapshot) => {
      const gradesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        evaluatedAt: doc.data().evaluatedAt?.toDate()
      }));
      setMemberGrades(gradesList);
    });

    // Listen for meetings where this external evaluator is the faculty
    const meetingsQuery = query(
      collection(db, 'meetings'),
      where('facultyEmail', '==', userData.email)
    );

    const unsubscribeMeetings = onSnapshot(meetingsQuery, (snapshot) => {
      const meetingsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        scheduledDate: doc.data().scheduledDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate()
      }));
      setMeetings(meetingsList);
    });

    return () => {
      unsubscribePhases();
      unsubscribeTeams();
      unsubscribeSubmissions();
      unsubscribeEvaluations();
      unsubscribeGrades();
      unsubscribeMeetings();
    };
  }, [userData?.email, userData?.uid, userData?.role, activeSession?.id, selectedPhase?.id, externalPhases]);

  // Auto-calculate overall score when individual scores change
  useEffect(() => {
    setMemberEvaluations(prev => prev.map(member => {
      if (member.isAbsent) {
        return {
          ...member,
          technicalScore: 0,
          presentationScore: 0,
          innovationScore: 0,
          documentationScore: 0,
          overallScore: 0
        };
      }
      
      const scores = [
        parseFloat(member.technicalScore) || 0,
        parseFloat(member.presentationScore) || 0,
        parseFloat(member.innovationScore) || 0,
        parseFloat(member.documentationScore) || 0
      ];
      
      const avg = scores.reduce((sum, s) => sum + s, 0) / 4;
      return { ...member, overallScore: avg.toFixed(2) };
    }));
  }, [memberEvaluations.map(m => `${m.technicalScore}-${m.presentationScore}-${m.innovationScore}-${m.documentationScore}-${m.isAbsent}`).join(',')]);

  const handleStartEvaluation = async (team) => {
    if (!selectedPhase) {
      toast.error('Please select a phase to evaluate');
      return;
    }
    
    setSelectedTeam(team);

    // Initialize member evaluations
    const initialEvaluations = await Promise.all(
      team.memberDetails.map(async (member) => {
        // Check if grade already exists for this member
        const existingGradesQuery = query(
          collection(db, 'grades'),
          where('studentEmail', '==', member.email),
          where('phaseId', '==', selectedPhase.id),
          where('teamId', '==', team.id)
        );
        
        const gradesSnapshot = await getDocs(existingGradesQuery);
        
        if (!gradesSnapshot.empty) {
          const gradeData = gradesSnapshot.docs[0].data();
          return {
            studentEmail: member.email,
            studentName: member.name,
            technicalScore: gradeData.technicalScore || '',
            presentationScore: gradeData.presentationScore || '',
            innovationScore: gradeData.innovationScore || '',
            documentationScore: gradeData.documentationScore || '',
            overallScore: gradeData.overallScore || '',
            feedback: gradeData.feedback || '',
            isAbsent: gradeData.isAbsent || false
          };
        }
        
        return {
          studentEmail: member.email,
          studentName: member.name,
          technicalScore: '',
          presentationScore: '',
          innovationScore: '',
          documentationScore: '',
          overallScore: '',
          feedback: '',
          isAbsent: false
        };
      })
    );

    setMemberEvaluations(initialEvaluations);
    
    // Load team feedback if exists
    const existingEvaluation = evaluations.find(
      e => e.teamId === team.id && e.phaseId === selectedPhase.id
    );
    setTeamFeedback(existingEvaluation?.teamFeedback || '');

    setEvaluationDialog(true);
  };

  const handleMemberScoreChange = (memberEmail, field, value) => {
    setMemberEvaluations(prev =>
      prev.map(member =>
        member.studentEmail === memberEmail
          ? { ...member, [field]: value }
          : member
      )
    );
  };

  const handleMemberAbsentToggle = (memberEmail) => {
    setMemberEvaluations(prev =>
      prev.map(member =>
        member.studentEmail === memberEmail
          ? { ...member, isAbsent: !member.isAbsent }
          : member
      )
    );
  };

  const handleSubmitEvaluation = async () => {
    if (!selectedTeam || !selectedPhase) return;

    try {
      // Validate that all members are either evaluated or marked absent
      const unevaluatedMembers = memberEvaluations.filter(member => {
        if (member.isAbsent) return false;
        return !member.technicalScore || !member.presentationScore || 
               !member.innovationScore || !member.documentationScore;
      });

      if (unevaluatedMembers.length > 0) {
        toast.error(`Please evaluate all members or mark them as absent: ${unevaluatedMembers.map(m => m.studentName).join(', ')}`);
        return;
      }

      // Validate that feedback is provided (mandatory)
      const membersWithoutFeedback = memberEvaluations.filter(member => {
        if (member.isAbsent) return false; // Absent members don't need feedback
        const individualFeedback = member.feedback?.trim() || '';
        const hasFeedback = individualFeedback.length > 0 || teamFeedback.trim().length > 0;
        return !hasFeedback;
      });

      if (membersWithoutFeedback.length > 0) {
        toast.error('Please provide feedback (individual or team-level) for all evaluated members');
        return;
      }

      if (!teamFeedback.trim() && memberEvaluations.some(m => !m.isAbsent && !m.feedback?.trim())) {
        toast.error('Please provide either team-level feedback or individual feedback for each member');
        return;
      }

      // Validate scores for present members
      for (const member of memberEvaluations) {
        if (member.isAbsent) continue;
        
        const scores = {
          technical: parseFloat(member.technicalScore),
          presentation: parseFloat(member.presentationScore),
          innovation: parseFloat(member.innovationScore),
          documentation: parseFloat(member.documentationScore)
        };

        for (const [key, value] of Object.entries(scores)) {
          if (isNaN(value) || value < 0 || value > 100) {
            toast.error(`Invalid ${key} score for ${member.studentName}. Please enter 0-100.`);
            return;
          }
        }
      }

      const batch = writeBatch(db);

      // Save team-level evaluation (evaluations collection)
      const evaluationData = {
        teamId: selectedTeam.id,
        phaseId: selectedPhase.id,
        phaseName: selectedPhase.phaseName,
        maxMarks: selectedPhase.maxMarks || 100,
        marks: memberEvaluations.map(member => ({
          studentEmail: member.studentEmail,
          studentName: member.studentName,
          technicalScore: member.isAbsent ? 0 : parseFloat(member.technicalScore),
          presentationScore: member.isAbsent ? 0 : parseFloat(member.presentationScore),
          innovationScore: member.isAbsent ? 0 : parseFloat(member.innovationScore),
          documentationScore: member.isAbsent ? 0 : parseFloat(member.documentationScore),
          overallScore: member.isAbsent ? 0 : parseFloat(member.overallScore),
          feedback: member.feedback || '',
          isAbsent: member.isAbsent
        })),
        teamFeedback: teamFeedback.trim(),
        evaluatedBy: userData.uid,
        evaluatedAt: serverTimestamp(),
        sessionId: activeSession?.id
      };

      const evaluationRef = doc(collection(db, 'evaluations'));
      batch.set(evaluationRef, evaluationData);

      // Save individual grades (grades collection)
      for (const member of memberEvaluations) {
        const gradeData = {
          studentEmail: member.studentEmail,
          studentName: member.studentName,
          studentId: member.uid || '',
          teamId: selectedTeam.id,
          teamName: `Project ${selectedTeam.projectNumber}`,
          projectNumber: selectedTeam.projectNumber,
          phaseId: selectedPhase.id,
          phaseName: selectedPhase.phaseName,
          maxMarks: selectedPhase.maxMarks || 100,
          technicalScore: member.isAbsent ? 0 : parseFloat(member.technicalScore),
          presentationScore: member.isAbsent ? 0 : parseFloat(member.presentationScore),
          innovationScore: member.isAbsent ? 0 : parseFloat(member.innovationScore),
          documentationScore: member.isAbsent ? 0 : parseFloat(member.documentationScore),
          overallScore: member.isAbsent ? 0 : parseFloat(member.overallScore),
          feedback: member.feedback || teamFeedback.trim(),
          isAbsent: member.isAbsent,
          evaluatedBy: userData.uid,
          evaluatorName: userData.name || userData.email,
          evaluatedAt: serverTimestamp(),
          sessionId: activeSession?.id
        };

        // Check if grade already exists
        const existingGradesQuery = query(
          collection(db, 'grades'),
          where('studentEmail', '==', member.studentEmail),
          where('phaseId', '==', selectedPhase.id),
          where('teamId', '==', selectedTeam.id)
        );
        
        const gradesSnapshot = await getDocs(existingGradesQuery);
        
        if (!gradesSnapshot.empty) {
          const gradeDocId = gradesSnapshot.docs[0].id;
          batch.update(doc(db, 'grades', gradeDocId), {
            ...gradeData,
            updatedAt: serverTimestamp()
          });
        } else {
          batch.set(doc(collection(db, 'grades')), gradeData);
        }
      }

      await batch.commit();

      toast.success('External evaluation submitted successfully!');
      setEvaluationDialog(false);
      setSelectedTeam(null);
      setMemberEvaluations([]);
      setTeamFeedback('');
    } catch (error) {
      logger.error('Evaluation error:', error);
      toast.error('Failed to submit evaluation', { description: error.message });
    }
  };

  const getTeamSubmission = (teamId) => {
    if (!selectedPhase) return null;
    return submissions.find(s => s.teamId === teamId && s.phaseId === selectedPhase.id);
  };

  const getTeamEvaluation = (teamId) => {
    if (!selectedPhase) return null;
    return evaluations.find(e => e.teamId === teamId && e.phaseId === selectedPhase.id);
  };

  const getTeamMemberGrades = (teamId) => {
    if (!selectedPhase) return [];
    return memberGrades.filter(g => g.teamId === teamId && g.phaseId === selectedPhase.id);
  };

  const handleScheduleMeeting = () => {
    // Open meeting dialog without pre-selecting teams
    setMeetingForm({
      selectedTeams: [],
      meetingType: 'online',
      meetingLink: '',
      venue: '',
      scheduledDate: '',
      scheduledTime: '',
      endTime: '',
      agenda: ''
    });
    setMeetingDialog(true);
  };

  const toggleTeamSelection = (teamId) => {
    setMeetingForm(prev => ({
      ...prev,
      selectedTeams: prev.selectedTeams.includes(teamId)
        ? prev.selectedTeams.filter(id => id !== teamId)
        : [...prev.selectedTeams, teamId]
    }));
  };

  const toggleAllTeams = () => {
    if (meetingForm.selectedTeams.length === assignedTeams.length) {
      setMeetingForm(prev => ({ ...prev, selectedTeams: [] }));
    } else {
      setMeetingForm(prev => ({ 
        ...prev, 
        selectedTeams: assignedTeams.map(t => t.id) 
      }));
    }
  };

  const handleSubmitMeeting = async () => {
    try {
      if (meetingForm.selectedTeams.length === 0) {
        toast.error('Please select at least one team for the meeting');
        return;
      }

      if (!meetingForm.scheduledDate || !meetingForm.scheduledTime) {
        toast.error('Please select date and time for the meeting');
        return;
      }

      if (meetingForm.meetingType === 'online' && !meetingForm.meetingLink.trim()) {
        toast.error('Please provide a meeting link for online meetings');
        return;
      }

      if (meetingForm.meetingType === 'offline' && !meetingForm.venue.trim()) {
        toast.error('Please provide a venue for offline meetings');
        return;
      }

      if (!selectedPhase) {
        toast.error('Please select a phase before scheduling meeting');
        return;
      }

      const result = await MeetingService.createMeeting({
        phaseId: selectedPhase.id,
        phaseName: selectedPhase.phaseName,
        phaseType: 'external',
        facultyId: userData.uid,
        facultyName: userData.name,
        facultyEmail: userData.email,
        invitedTeams: meetingForm.selectedTeams,
        meetingType: meetingForm.meetingType,
        meetingLink: meetingForm.meetingLink,
        venue: meetingForm.venue,
        scheduledDate: new Date(meetingForm.scheduledDate),
        scheduledTime: meetingForm.scheduledTime,
        endTime: meetingForm.endTime,
        agenda: meetingForm.agenda
      });

      if (result.success) {
        toast.success(`Meeting scheduled successfully with ${meetingForm.selectedTeams.length} team(s)!`);
        setMeetingDialog(false);
        setMeetingForm({
          selectedTeams: [],
          meetingType: 'online',
          meetingLink: '',
          venue: '',
          scheduledDate: '',
          scheduledTime: '',
          endTime: '',
          agenda: ''
        });
      } else {
        toast.error('Failed to schedule meeting', { description: result.error });
      }
    } catch (error) {
      toast.error('Failed to schedule meeting', { description: error.message });
    }
  };

  const handleViewTeamDetails = (team) => {
    setSelectedTeam(team);
    setTeamDetailsDialog(true);
  };

  const stats = {
    totalAssigned: assignedTeams.length,
    completed: evaluations.length,
    pending: assignedTeams.length - evaluations.length,
    averageScore: evaluations.length > 0 ?
      Math.round(evaluations.reduce((sum, e) => sum + e.overallScore, 0) / evaluations.length) : 0
  };

  // Tab configuration
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Users },
    { id: 'assigned', label: 'Assigned Teams', icon: FileText },
    { id: 'meetings', label: 'Meetings', icon: Calendar },
    { id: 'evaluations', label: 'Evaluations', icon: Star },
    { id: 'help', label: 'Help', icon: HelpCircle },
  ];

  const activeTabConfig = tabs.find(t => t.id === activeTab);

  if (loading) {
    return (
      <div className="h-screen flex overflow-hidden bg-gray-50">
        {/* Loading Sidebar */}
        <div className="w-60 bg-white border-r border-gray-200 p-4 space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        {/* Loading Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Skeleton className="h-12 w-full" />
          <div className="flex-1 p-6 space-y-4">
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!userData || userData.role !== 'external_evaluator') {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md mx-4 shadow-xl border-red-200">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center mb-6">
              <FileText className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Access Restricted</h2>
            <p className="text-gray-600 leading-relaxed">
              This dashboard is exclusively for external evaluators. Please contact the administrator if you believe this is an error.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden bg-gray-50">
      {/* Mobile Hamburger Menu Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="md:hidden fixed top-3 left-3 z-50 bg-white hover:bg-purple-50 shadow-lg rounded-lg h-11 w-11 p-0 border border-gray-200 hover:border-purple-300 transition-all"
        aria-label="Toggle menu"
      >
        <Menu className={`h-5 w-5 transition-transform duration-200 ${mobileMenuOpen ? 'rotate-90' : ''}`} />
      </Button>

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-md z-40 animate-fadeIn"
          onClick={() => setMobileMenuOpen(false)}
          role="button"
          aria-label="Close menu"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setMobileMenuOpen(false);
          }}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={`
          ${sidebarCollapsed ? 'w-[60px]' : 'w-[240px]'}
          transition-all duration-300 ease-in-out
          bg-white border-r border-gray-200 flex flex-col
          fixed md:relative h-full z-50
          ${mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
          max-md:w-[280px]
        `}
        role="navigation"
        aria-label="External evaluator navigation"
      >
        {/* Mobile Close Button */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-3 right-3 z-10">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(false)}
              className="h-8 w-8 p-0 hover:bg-purple-50 rounded-full"
              aria-label="Close menu"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Evaluator Header */}
          <div className="p-4 border-b border-gray-200 bg-gradient-to-br from-white to-purple-50/20">
            {!sidebarCollapsed ? (
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md">
                    <Star className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-bold text-gray-900 truncate">{userData?.name || 'Evaluator'}</h2>
                  <p className="text-xs text-gray-500 truncate">External Evaluator</p>
                  <Badge variant="outline" className="mt-1 bg-purple-50 text-purple-700 border-purple-300 text-[10px] h-4 px-1.5">
                    {stats.completed}/{stats.totalAssigned} Completed
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md">
                  <Star className="h-5 w-5 text-white" />
                </div>
              </div>
            )}
          </div>

          {/* Phase Selector */}
          {!sidebarCollapsed && (
            <div className="p-3 border-b border-gray-200 bg-gray-50">
              <Label className="text-[10px] font-semibold text-gray-700 uppercase mb-1.5 block">
                Select External Phase
              </Label>
              {externalPhases.length === 0 ? (
                <div className="p-2 text-center bg-white rounded-md border border-gray-200">
                  <p className="text-xs text-gray-500">No external phases available</p>
                </div>
              ) : (
                <select
                  value={selectedPhase?.id || ''}
                  onChange={(e) => {
                    const phase = externalPhases.find(p => p.id === e.target.value);
                    setSelectedPhase(phase || null);
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Choose a phase...</option>
                  {externalPhases.map(phase => (
                    <option key={phase.id} value={phase.id}>
                      {phase.phaseName} - {phase.phaseStatus}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Navigation Menu */}
          <div className="p-3 space-y-1">
            {!sidebarCollapsed ? (
              <div className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                        transition-all duration-200 text-sm font-medium
                        ${isActive
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'text-gray-700 hover:bg-gray-100'
                        }
                      `}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1 text-left">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2 flex flex-col items-center">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <div key={tab.id} className="relative group">
                      <button
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                          w-10 h-10 flex items-center justify-center rounded-lg
                          transition-all duration-200
                          ${isActive
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'text-gray-600 hover:bg-gray-100'
                          }
                        `}
                        title={tab.label}
                      >
                        <Icon className="h-4 w-4" />
                      </button>

                      {/* Tooltip */}
                      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                        <div className="bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                          {tab.label}
                          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Logout Button */}
        <div className="flex-none p-3 border-t border-gray-200 hidden md:block">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className={`${sidebarCollapsed ? 'w-9 h-9 p-0' : 'w-full justify-center'} hover:bg-red-50 hover:text-red-700 text-red-600`}
          >
            {sidebarCollapsed ? (
              <LogOut className="h-4 w-4" />
            ) : (
              <>
                <LogOut className="h-4 w-4 mr-2" />
                <span className="text-xs">Logout</span>
              </>
            )}
          </Button>
        </div>

        {/* Collapse Toggle Button */}
        <div className="flex-none p-3 pt-0 hidden md:block">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className={`${sidebarCollapsed ? 'w-9 h-9 p-0' : 'w-full justify-center'} hover:bg-purple-50 hover:text-purple-700`}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>

      {/* Right Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header removed to avoid duplication with main DashboardPage header */}


        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-br from-gray-50 via-white to-gray-50/50 flex flex-col">
          <div className="flex-1">
            <div className="max-w-7xl mx-auto p-4 space-y-3">
              {/* Dashboard Tab */}
              {activeTab === 'dashboard' && (
                <div className="animate-fadeIn">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {/* Assigned Teams */}
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-lg p-4 border border-purple-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-5 w-5 text-purple-600" />
                        <span className="text-2xl font-bold text-purple-700">{stats.totalAssigned}</span>
                      </div>
                      <p className="text-xs font-semibold text-purple-700/80 uppercase">Assigned Teams</p>
                    </div>

                    {/* Completed */}
                    <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-lg p-4 border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="text-2xl font-bold text-green-700">{stats.completed}</span>
                      </div>
                      <p className="text-xs font-semibold text-green-700/80 uppercase">Completed</p>
                    </div>

                    {/* Pending */}
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-lg p-4 border border-orange-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-5 w-5 text-orange-600" />
                        <span className="text-2xl font-bold text-orange-700">{stats.pending}</span>
                      </div>
                      <p className="text-xs font-semibold text-orange-700/80 uppercase">Pending</p>
                    </div>

                    {/* Average Score */}
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg p-4 border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Award className="h-5 w-5 text-blue-600" />
                        <span className="text-2xl font-bold text-blue-700">{stats.averageScore}%</span>
                      </div>
                      <p className="text-xs font-semibold text-blue-700/80 uppercase">Avg Score</p>
                    </div>
                  </div>

                  {/* Recent Evaluations & Pending Teams */}
                  <div className="grid md:grid-cols-2 gap-3">
                    {/* Recent Evaluations */}
                    <Card className="border-purple-200">
                      <CardContent className="p-4">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Star className="h-4 w-4 text-purple-600" />
                          Recent Evaluations
                        </h3>
                        {evaluations.length === 0 ? (
                          <p className="text-xs text-gray-500 text-center py-4">No evaluations completed yet</p>
                        ) : (
                          <div className="space-y-2">
                            {evaluations.slice(0, 5).map((evaluation) => {
                              const team = assignedTeams.find(t => t.id === evaluation.teamId);
                              return (
                                <div key={evaluation.id} className="flex items-center justify-between p-2 rounded-md bg-purple-50 hover:bg-purple-100 transition-colors">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{team?.name || 'Unknown Team'}</p>
                                    <p className="text-xs text-gray-500">{evaluation.evaluatedAt?.toLocaleDateString()}</p>
                                  </div>
                                  <Badge className="bg-purple-600 hover:bg-purple-700 text-xs h-5">{evaluation.overallScore}%</Badge>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Pending Teams */}
                    <Card className="border-orange-200">
                      <CardContent className="p-4">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Clock className="h-4 w-4 text-orange-600" />
                          Pending Teams
                        </h3>
                        {stats.pending === 0 ? (
                          <p className="text-xs text-gray-500 text-center py-4">All teams evaluated!</p>
                        ) : (
                          <div className="space-y-2">
                            {assignedTeams.filter(team => !evaluations.find(e => e.teamId === team.id)).slice(0, 5).map((team) => (
                              <div key={team.id} className="flex items-center justify-between p-2 rounded-md bg-orange-50 hover:bg-orange-100 transition-colors">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">Project #{team.projectNumber}</p>
                                  <p className="text-xs text-gray-500">{team.projectTitle || 'No title'}</p>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setActiveTab('assigned');
                                    handleStartEvaluation(team);
                                  }}
                                  className="bg-purple-600 hover:bg-purple-700 h-7 text-xs"
                                >
                                  Evaluate
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* Assigned Teams Tab */}
              {activeTab === 'assigned' && (
                <div className="animate-fadeIn space-y-3">
                  {!selectedPhase ? (
                    <Card className="border-orange-200 bg-orange-50/30">
                      <CardContent className="flex flex-col items-center justify-center py-16 p-4">
                        <div className="h-20 w-20 rounded-full bg-orange-100 flex items-center justify-center mb-4">
                          <FileText className="h-10 w-10 text-orange-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Phase Selected</h3>
                        <p className="text-gray-600 text-center max-w-sm text-sm">
                          Please select an external phase to view assigned teams and start evaluations.
                        </p>
                      </CardContent>
                    </Card>
                  ) : assignedTeams.length === 0 ? (
                    <Card className="border-gray-200">
                      <CardContent className="flex flex-col items-center justify-center py-16 p-4">
                        <div className="h-20 w-20 rounded-full bg-purple-100 flex items-center justify-center mb-4">
                          <Users className="h-10 w-10 text-purple-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Teams Assigned</h3>
                        <p className="text-gray-600 text-center max-w-sm text-sm">
                          You don't have any teams assigned for this external phase yet. Check back later for assignments.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {assignedTeams.length} Team{assignedTeams.length !== 1 ? 's' : ''} Assigned
                        </h3>
                        <Button
                          onClick={handleScheduleMeeting}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          Schedule Meeting
                        </Button>
                      </div>
                      
                      <div className="grid gap-3">
                        {assignedTeams.map((team) => {
                          const submission = getTeamSubmission(team.id);
                          const evaluation = getTeamEvaluation(team.id);
                          const memberGradesForTeam = getTeamMemberGrades(team.id);
                          const totalMembers = team.memberDetails?.length || 0;
                          const evaluatedMembers = memberGradesForTeam.length;
                          const isFullyEvaluated = totalMembers > 0 && evaluatedMembers === totalMembers;

                          return (
                            <Card
                              key={team.id}
                              className={`transition-all duration-200 hover:shadow-lg border cursor-pointer ${isFullyEvaluated
                                ? 'border-green-200 bg-green-50/30'
                                : 'border-gray-200 bg-white hover:border-purple-300'
                                }`}
                              onClick={() => handleViewTeamDetails(team)}
                            >
                              <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <CardTitle className="text-base font-bold text-gray-900">Project #{team.projectNumber}</CardTitle>
                                      {isFullyEvaluated && (
                                        <Badge className="bg-green-600 text-white text-xs h-5">
                                          <CheckCircle className="h-3 w-3 mr-1" />
                                          Fully Evaluated
                                        </Badge>
                                      )}
                                      {evaluatedMembers > 0 && !isFullyEvaluated && (
                                        <Badge className="bg-blue-600 text-white text-xs h-5">
                                          {evaluatedMembers}/{totalMembers} Evaluated
                                        </Badge>
                                      )}
                                      {submission && (
                                        <Badge variant="outline" className="text-xs h-5 border-purple-300 text-purple-700">
                                          <FileText className="h-3 w-3 mr-1" />
                                          Submitted
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="text-xs text-gray-600 space-y-1">
                                      <div className="flex items-start gap-2">
                                        <span className="font-semibold min-w-20">Project:</span>
                                        <span className="text-gray-900">{team.projectTitle || 'Not provided'}</span>
                                      </div>
                                      <div className="flex items-start gap-2">
                                        <span className="font-semibold min-w-20">Members:</span>
                                        <span>{team.memberDetails?.map(m => m.name).join(', ') || 'Loading...'}</span>
                                      </div>
                                      {submission && (
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold min-w-20">Submitted:</span>
                                          <span className="text-purple-600 font-medium">{submission.submittedAt?.toLocaleDateString()}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                      onClick={() => handleStartEvaluation(team)}
                                      size="sm"
                                      variant={isFullyEvaluated ? "secondary" : "default"}
                                      className={isFullyEvaluated
                                        ? "bg-gray-100 hover:bg-gray-200 text-gray-700 h-8 text-xs"
                                        : "bg-purple-600 hover:bg-purple-700 text-white h-8 text-xs"
                                      }
                                    >
                                      {isFullyEvaluated ? "Edit Evaluation" : evaluatedMembers > 0 ? "Continue" : "Evaluate"}
                                    </Button>
                                  </div>
                                </div>
                              </CardHeader>

                              {team.projectAbstract && (
                                <CardContent className="pt-0">
                                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <p className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide mb-1">Abstract</p>
                                    <p className="text-xs text-gray-700 leading-relaxed line-clamp-2">{team.projectAbstract}</p>
                                  </div>
                                </CardContent>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Meetings Tab */}
              {activeTab === 'meetings' && (
                <div className="animate-fadeIn space-y-3">
                  {meetings.length === 0 ? (
                    <Card className="border-gray-200">
                      <CardContent className="flex flex-col items-center justify-center py-16 p-4">
                        <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                          <Calendar className="h-10 w-10 text-blue-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Meetings Scheduled</h3>
                        <p className="text-gray-600 text-center max-w-sm text-sm">
                          Schedule meetings with teams from the "Assigned Teams" tab to discuss their projects.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-3">
                      {meetings
                        .sort((a, b) => (b.scheduledDate?.getTime() || 0) - (a.scheduledDate?.getTime() || 0))
                        .map((meeting) => {
                          // Get all teams invited to this meeting
                          const invitedTeams = meeting.invitedTeams
                            ?.map(teamId => assignedTeams.find(t => t.id === teamId))
                            .filter(Boolean) || [];
                          const isPast = meeting.scheduledDate && meeting.scheduledDate < new Date();

                          return (
                            <Card
                              key={meeting.id}
                              className={`border ${isPast ? 'border-gray-200 bg-gray-50/50' : 'border-blue-200 bg-blue-50/30'}`}
                            >
                              <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <CardTitle className="text-base font-bold text-gray-900">
                                        {meeting.title || 'Meeting'}
                                      </CardTitle>
                                      <Badge className={isPast ? 'bg-gray-500' : 'bg-blue-600'} variant="default">
                                        {isPast ? 'Completed' : 'Upcoming'}
                                      </Badge>
                                    </div>
                                    
                                    {/* Show invited teams */}
                                    {invitedTeams.length > 0 && (
                                      <div className="flex items-start gap-2">
                                        <Users className="h-3.5 w-3.5 text-gray-500 mt-0.5" />
                                        <div>
                                          <span className="text-xs font-semibold text-gray-700">Teams:</span>
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {invitedTeams.map(team => (
                                              <Badge key={team.id} variant="outline" className="text-xs h-5">
                                                {team.name || `Project ${team.projectNumber}`}
                                              </Badge>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    <div className="text-xs text-gray-600 space-y-1">
                                      <div className="flex items-center gap-2">
                                        <Calendar className="h-3.5 w-3.5 text-gray-500" />
                                        <span className="font-semibold">Date:</span>
                                        <span className="text-gray-900">
                                          {meeting.scheduledDate?.toLocaleDateString('en-US', {
                                            weekday: 'short',
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                          })}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Clock className="h-3.5 w-3.5 text-gray-500" />
                                        <span className="font-semibold">Time:</span>
                                        <span className="text-gray-900">{meeting.scheduledTime}</span>
                                        {meeting.endTime && (
                                          <span className="text-gray-500">- {meeting.endTime}</span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {meeting.meetingType === 'online' ? (
                                          <>
                                            <Video className="h-3.5 w-3.5 text-blue-600" />
                                            <span className="font-semibold">Online Meeting</span>
                                          </>
                                        ) : (
                                          <>
                                            <MapPin className="h-3.5 w-3.5 text-orange-600" />
                                            <span className="font-semibold">Venue:</span>
                                            <span className="text-gray-900">{meeting.venue}</span>
                                          </>
                                        )}
                                      </div>
                                      {meeting.agenda && (
                                        <div className="flex items-start gap-2 mt-2">
                                          <FileText className="h-3.5 w-3.5 text-gray-500 mt-0.5" />
                                          <div>
                                            <span className="font-semibold">Agenda:</span>
                                            <p className="text-gray-700 mt-0.5">{meeting.agenda}</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {meeting.meetingType === 'online' && meeting.meetingLink && (
                                    <Button
                                      size="sm"
                                      onClick={() => window.open(meeting.meetingLink, '_blank')}
                                      className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs"
                                    >
                                      <Video className="h-3.5 w-3.5 mr-1.5" />
                                      Join
                                    </Button>
                                  )}
                                </div>
                              </CardHeader>
                            </Card>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}

              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div className="animate-fadeIn">
                  <ProfileSection />
                </div>
              )}

              {/* Evaluations Tab */}
              {activeTab === 'evaluations' && (
                <div className="animate-fadeIn space-y-3">
                  {evaluations.length === 0 ? (
                    <Card className="border-gray-200">
                      <CardContent className="flex flex-col items-center justify-center py-16 p-4">
                        <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
                          <Star className="h-10 w-10 text-green-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Evaluations Completed</h3>
                        <p className="text-gray-600 text-center max-w-sm text-sm">
                          Completed evaluations will appear here once you submit your assessments.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-3">
                      {evaluations.map((evaluation) => {
                        const team = assignedTeams.find(t => t.id === evaluation.teamId);

                        return (
                          <Card key={evaluation.id} className="border-green-200 bg-green-50/30">
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <CardTitle className="text-base font-bold text-gray-900">{team?.name || 'Unknown Team'}</CardTitle>
                                  <p className="text-xs text-gray-600 flex items-center gap-2">
                                    <Calendar className="h-3 w-3" />
                                    {evaluation.evaluatedAt?.toLocaleDateString()}
                                  </p>
                                </div>
                                <Badge className="bg-purple-600 hover:bg-purple-700 text-white text-base px-3 py-1">
                                  {evaluation.overallScore}%
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-200">
                                  <p className="text-[10px] font-semibold text-blue-700 uppercase mb-1">Technical</p>
                                  <p className="text-xl font-bold text-blue-900">{evaluation.technicalScore}%</p>
                                </div>
                                <div className="bg-purple-50 p-2.5 rounded-lg border border-purple-200">
                                  <p className="text-[10px] font-semibold text-purple-700 uppercase mb-1">Presentation</p>
                                  <p className="text-xl font-bold text-purple-900">{evaluation.presentationScore}%</p>
                                </div>
                                <div className="bg-orange-50 p-2.5 rounded-lg border border-orange-200">
                                  <p className="text-[10px] font-semibold text-orange-700 uppercase mb-1">Innovation</p>
                                  <p className="text-xl font-bold text-orange-900">{evaluation.innovationScore}%</p>
                                </div>
                                <div className="bg-teal-50 p-2.5 rounded-lg border border-teal-200">
                                  <p className="text-[10px] font-semibold text-teal-700 uppercase mb-1">Documentation</p>
                                  <p className="text-xl font-bold text-teal-900">{evaluation.documentationScore}%</p>
                                </div>
                              </div>

                              {evaluation.feedback && (
                                <div className="space-y-1.5">
                                  <p className="text-[10px] font-semibold text-gray-700 uppercase">Feedback</p>
                                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <p className="text-xs text-gray-700 leading-relaxed">{evaluation.feedback}</p>
                                  </div>
                                </div>
                              )}

                              {evaluation.recommendations && (
                                <div className="space-y-1.5">
                                  <p className="text-[10px] font-semibold text-gray-700 uppercase">Recommendations</p>
                                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                                    <p className="text-xs text-purple-900 leading-relaxed">{evaluation.recommendations}</p>
                                  </div>
                                </div>
                              )}

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStartEvaluation(team)}
                                className="w-full h-8 text-xs hover:bg-purple-50 border-purple-200"
                              >
                                Edit Evaluation
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Help Tab */}
              {activeTab === 'help' && (
                <div className="animate-fadeIn space-y-4">
                  {/* Header Card */}
                  <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-violet-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-purple-100 p-2.5 rounded-xl">
                          <HelpCircle className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-gray-900">External Evaluator Help Center</h3>
                          <p className="text-xs text-gray-600">CSE Final Year Project - External Evaluation Guide</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Your Role */}
                  <Card className="border-orange-200">
                    <CardContent className="p-4">
                      <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="text-orange-500">🎯</span> Your Role as External Evaluator
                      </h4>
                      <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="space-y-2 text-xs text-gray-700">
                          <p>You are an <strong>industry expert</strong> invited to evaluate final year CSE projects during the <strong>8th semester External Phase</strong> — the final evaluation before project completion.</p>
                          <div className="mt-3 p-2 bg-white rounded border border-orange-100">
                            <p className="font-semibold text-orange-900 mb-1">Key Points:</p>
                            <ul className="space-y-1 text-gray-600">
                              <li>• You evaluate teams at the <strong>end of 8th semester</strong> (final phase)</li>
                              <li>• Each <strong>team member is evaluated individually</strong> (not as a team)</li>
                              <li>• Students have already been evaluated by mentors and internal panels</li>
                              <li>• Your evaluation is the <strong>final assessment</strong> before project submission</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Evaluation Process */}
                  <Card className="border-purple-200">
                    <CardContent className="p-4">
                      <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="text-purple-500">📋</span> Evaluation Process
                      </h4>
                      <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <ol className="space-y-2 text-xs text-gray-700 list-decimal list-inside">
                          <li><strong>Review Assigned Teams</strong> — Check the "Assigned Teams" tab for teams you need to evaluate</li>
                          <li><strong>Access Project Materials</strong> — Click "View" to open project documentation and submissions</li>
                          <li><strong>Conduct Evaluation</strong> — Meet with the team (presentation/demo) and assess their work</li>
                          <li><strong>Score Each Category</strong> — Provide scores across 4 evaluation criteria</li>
                          <li><strong>Submit Feedback</strong> — Include detailed feedback and recommendations for improvement</li>
                        </ol>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Scoring Criteria */}
                  <Card className="border-blue-200">
                    <CardContent className="p-4">
                      <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="text-blue-500">⭐</span> Scoring Criteria
                      </h4>
                      <div className="grid gap-2 text-xs">
                        <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="font-bold text-blue-900">Technical Implementation (0-100)</p>
                          <p className="text-gray-600">Code quality, system architecture, functionality completeness, and technical complexity</p>
                        </div>
                        <div className="p-2 bg-purple-50 rounded-lg border border-purple-200">
                          <p className="font-bold text-purple-900">Presentation Quality (0-100)</p>
                          <p className="text-gray-600">Clarity of explanation, professionalism, demo effectiveness, and Q&A handling</p>
                        </div>
                        <div className="p-2 bg-orange-50 rounded-lg border border-orange-200">
                          <p className="font-bold text-orange-900">Innovation & Creativity (0-100)</p>
                          <p className="text-gray-600">Originality of idea, problem-solving approach, and creative solutions implemented</p>
                        </div>
                        <div className="p-2 bg-teal-50 rounded-lg border border-teal-200">
                          <p className="font-bold text-teal-900">Documentation Quality (0-100)</p>
                          <p className="text-gray-600">Completeness, clarity, professional formatting, and technical accuracy</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* FAQs */}
                  <Card className="border-green-200">
                    <CardContent className="p-4">
                      <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="text-green-500">❓</span> Frequently Asked Questions
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="p-2 bg-gray-50 rounded-lg">
                          <p className="font-semibold text-gray-900">Can I edit an evaluation after submission?</p>
                          <p className="text-gray-600 mt-0.5">Yes, you can edit evaluations anytime by clicking "Edit Evaluation" on the team card.</p>
                        </div>
                        <div className="p-2 bg-gray-50 rounded-lg">
                          <p className="font-semibold text-gray-900">What is the Overall Score?</p>
                          <p className="text-gray-600 mt-0.5">A comprehensive final score (0-100) that represents your overall assessment of the project.</p>
                        </div>
                        <div className="p-2 bg-gray-50 rounded-lg">
                          <p className="font-semibold text-gray-900">How do I access project submissions?</p>
                          <p className="text-gray-600 mt-0.5">Click the "View" button on any team card to open their Google Drive submission link.</p>
                        </div>
                        <div className="p-2 bg-gray-50 rounded-lg">
                          <p className="font-semibold text-gray-900">What evaluation phases exist before mine?</p>
                          <p className="text-gray-600 mt-0.5">Students go through mentor phases (faculty mentor) and panel phases (internal faculty panel) before your external evaluation.</p>
                        </div>
                        <div className="p-2 bg-gray-50 rounded-lg">
                          <p className="font-semibold text-gray-900">Do I evaluate the team or individuals?</p>
                          <p className="text-gray-600 mt-0.5">Each team member receives individual marks based on their contribution and understanding of the project.</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Contact Support */}
                  <Card className="border-gray-200 bg-gradient-to-r from-gray-50 to-slate-50">
                    <CardContent className="p-4">
                      <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <span className="text-gray-500">💬</span> Need Help?
                      </h4>
                      <p className="text-xs text-gray-600">
                        For technical issues or questions about the evaluation process, use the contact links in the footer below.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>

          {/* Footer - inside scrollable area, below sidebar level */}
          <Footer showPhoneNumbers={true} />
        </div>
      </main>

      {/* Evaluation Dialog - Member-wise */}
      <Dialog open={evaluationDialog} onOpenChange={setEvaluationDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b border-gray-200 pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900">
              External Evaluation - Project #{selectedTeam?.projectNumber}
            </DialogTitle>
            <DialogDescription className="text-gray-600 mt-2 text-sm">
              {selectedTeam?.projectTitle && <div className="font-medium text-gray-900 mb-1">{selectedTeam.projectTitle}</div>}
              Evaluate each team member individually. All members must be evaluated or marked as absent.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Member-wise Evaluations */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-700 uppercase flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Individual Member Evaluations ({memberEvaluations.length} members)
              </h3>
              
              <Accordion type="multiple" className="w-full space-y-2">
                {memberEvaluations.map((member, index) => {
                  const hasScores = member.technicalScore || member.presentationScore || 
                                  member.innovationScore || member.documentationScore;
                  const isComplete = member.isAbsent || (hasScores && member.overallScore);

                  return (
                    <AccordionItem
                      key={member.studentEmail}
                      value={member.studentEmail}
                      className={`border rounded-lg ${
                        isComplete 
                          ? 'border-green-300 bg-green-50/30' 
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-4">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-gray-900">{member.studentName}</span>
                            {isComplete && (
                              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-xs">
                                {member.isAbsent ? 'Absent' : `${member.overallScore}%`}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              id={`absent-${member.studentEmail}`}
                              checked={member.isAbsent}
                              onCheckedChange={() => handleMemberAbsentToggle(member.studentEmail)}
                              className="h-4 w-4"
                            />
                            <Label 
                              htmlFor={`absent-${member.studentEmail}`}
                              className="text-xs text-gray-600 cursor-pointer"
                            >
                              Mark Absent
                            </Label>
                          </div>
                        </div>
                      </AccordionTrigger>
                      
                      <AccordionContent className="px-4 pb-4 pt-2">
                        <div className="space-y-3">
                          {/* Score Inputs */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label htmlFor={`technical-${index}`} className="text-xs font-medium text-gray-700">
                                Technical Implementation
                              </Label>
                              <Input
                                id={`technical-${index}`}
                                type="number"
                                min="0"
                                max="100"
                                disabled={member.isAbsent}
                                value={member.technicalScore}
                                onChange={(e) => handleMemberScoreChange(member.studentEmail, 'technicalScore', e.target.value)}
                                className="bg-blue-50 border-blue-200 focus:border-blue-400 focus:ring-blue-400 h-9 disabled:opacity-50"
                                placeholder="0-100"
                              />
                            </div>
                            
                            <div className="space-y-1.5">
                              <Label htmlFor={`presentation-${index}`} className="text-xs font-medium text-gray-700">
                                Presentation Quality
                              </Label>
                              <Input
                                id={`presentation-${index}`}
                                type="number"
                                min="0"
                                max="100"
                                disabled={member.isAbsent}
                                value={member.presentationScore}
                                onChange={(e) => handleMemberScoreChange(member.studentEmail, 'presentationScore', e.target.value)}
                                className="bg-purple-50 border-purple-200 focus:border-purple-400 focus:ring-purple-400 h-9 disabled:opacity-50"
                                placeholder="0-100"
                              />
                            </div>
                            
                            <div className="space-y-1.5">
                              <Label htmlFor={`innovation-${index}`} className="text-xs font-medium text-gray-700">
                                Innovation & Creativity
                              </Label>
                              <Input
                                id={`innovation-${index}`}
                                type="number"
                                min="0"
                                max="100"
                                disabled={member.isAbsent}
                                value={member.innovationScore}
                                onChange={(e) => handleMemberScoreChange(member.studentEmail, 'innovationScore', e.target.value)}
                                className="bg-orange-50 border-orange-200 focus:border-orange-400 focus:ring-orange-400 h-9 disabled:opacity-50"
                                placeholder="0-100"
                              />
                            </div>
                            
                            <div className="space-y-1.5">
                              <Label htmlFor={`documentation-${index}`} className="text-xs font-medium text-gray-700">
                                Documentation Quality
                              </Label>
                              <Input
                                id={`documentation-${index}`}
                                type="number"
                                min="0"
                                max="100"
                                disabled={member.isAbsent}
                                value={member.documentationScore}
                                onChange={(e) => handleMemberScoreChange(member.studentEmail, 'documentationScore', e.target.value)}
                                className="bg-teal-50 border-teal-200 focus:border-teal-400 focus:ring-teal-400 h-9 disabled:opacity-50"
                                placeholder="0-100"
                              />
                            </div>
                          </div>

                          {/* Overall Score (Auto-calculated) */}
                          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                            <Label className="text-xs font-semibold text-purple-900 uppercase mb-1.5 block">
                              Overall Score (Average)
                            </Label>
                            <div className="text-2xl font-bold text-purple-700">
                              {member.isAbsent ? '0' : member.overallScore || '-'}%
                            </div>
                          </div>

                          {/* Individual Feedback */}
                          <div className="space-y-1.5">
                            <Label htmlFor={`feedback-${index}`} className="text-xs font-medium text-gray-700">
                              Individual Feedback <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                              id={`feedback-${index}`}
                              placeholder="Specific feedback for this member..."
                              disabled={member.isAbsent}
                              value={member.feedback}
                              onChange={(e) => handleMemberScoreChange(member.studentEmail, 'feedback', e.target.value)}
                              rows={2}
                              className="bg-white border-gray-300 focus:border-purple-400 focus:ring-purple-400 resize-none text-sm disabled:opacity-50"
                            />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>

            {/* Team-level Feedback */}
            <div className="space-y-1.5 pt-4 border-t border-gray-200">
              <Label htmlFor="team-feedback" className="text-xs font-semibold text-gray-700 uppercase flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" />
                Team-level Feedback <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-gray-500">Provide team feedback OR individual feedback for each member</p>
              <Textarea
                id="team-feedback"
                placeholder="Overall feedback for the entire team project..."
                value={teamFeedback}
                onChange={(e) => setTeamFeedback(e.target.value)}
                rows={4}
                className="bg-white border-gray-300 focus:border-purple-400 focus:ring-purple-400 resize-none text-sm"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-gray-200 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setEvaluationDialog(false);
                setSelectedTeam(null);
                setMemberEvaluations([]);
                setTeamFeedback('');
              }}
              className="bg-white hover:bg-gray-100 border-gray-300 h-9 text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitEvaluation}
              className="bg-purple-600 hover:bg-purple-700 text-white h-9 text-sm"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Submit Evaluation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Meeting Dialog - Multi-team Selection */}
      <Dialog open={meetingDialog} onOpenChange={setMeetingDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="border-b border-gray-200 pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900">
              Schedule Meeting
            </DialogTitle>
            <DialogDescription className="text-gray-600 mt-2 text-sm">
              Select one or more teams and schedule an evaluation meeting to review their projects.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Team Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-gray-700">
                  Select Teams ({meetingForm.selectedTeams.length} selected)
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleAllTeams}
                  className="h-7 text-xs"
                >
                  {meetingForm.selectedTeams.length === assignedTeams.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                {assignedTeams.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">No teams assigned</p>
                ) : (
                  assignedTeams.map(team => (
                    <div
                      key={team.id}
                      className="flex items-center gap-3 p-2 rounded-md bg-white border border-gray-200 hover:border-purple-300 transition-colors"
                    >
                      <Checkbox
                        id={`team-${team.id}`}
                        checked={meetingForm.selectedTeams.includes(team.id)}
                        onCheckedChange={() => toggleTeamSelection(team.id)}
                        className="h-4 w-4"
                      />
                      <Label
                        htmlFor={`team-${team.id}`}
                        className="flex-1 text-sm cursor-pointer"
                      >
                        <span className="font-semibold">Project #{team.projectNumber}</span>
                        {team.projectTitle && (
                          <span className="text-gray-600"> - {team.projectTitle}</span>
                        )}
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Meeting Type */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">Meeting Type</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMeetingForm(prev => ({ ...prev, meetingType: 'online' }))}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                    meetingForm.meetingType === 'online'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-200 bg-white'
                  }`}
                >
                  <Video className={`h-5 w-5 ${
                    meetingForm.meetingType === 'online' ? 'text-blue-600' : 'text-gray-400'
                  }`} />
                  <span className={`text-sm font-medium ${
                    meetingForm.meetingType === 'online' ? 'text-blue-900' : 'text-gray-600'
                  }`}>
                    Online Meeting
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMeetingForm(prev => ({ ...prev, meetingType: 'offline' }))}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                    meetingForm.meetingType === 'offline'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-orange-200 bg-white'
                  }`}
                >
                  <MapPin className={`h-5 w-5 ${
                    meetingForm.meetingType === 'offline' ? 'text-orange-600' : 'text-gray-400'
                  }`} />
                  <span className={`text-sm font-medium ${
                    meetingForm.meetingType === 'offline' ? 'text-orange-900' : 'text-gray-600'
                  }`}>
                    In-Person
                  </span>
                </button>
              </div>
            </div>

            {/* Meeting Link or Venue */}
            {meetingForm.meetingType === 'online' ? (
              <div className="space-y-2">
                <Label htmlFor="meetingLink" className="text-sm font-medium text-gray-700">
                  Meeting Link *
                </Label>
                <Input
                  id="meetingLink"
                  placeholder="https://teams.microsoft.com/... or https://zoom.us/..."
                  value={meetingForm.meetingLink}
                  onChange={(e) => setMeetingForm(prev => ({ ...prev, meetingLink: e.target.value }))}
                  className="bg-white border-gray-300 focus:border-blue-400 focus:ring-blue-400"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="venue" className="text-sm font-medium text-gray-700">
                  Venue *
                </Label>
                <Input
                  id="venue"
                  placeholder="e.g., Room 301, CS Department"
                  value={meetingForm.venue}
                  onChange={(e) => setMeetingForm(prev => ({ ...prev, venue: e.target.value }))}
                  className="bg-white border-gray-300 focus:border-orange-400 focus:ring-orange-400"
                />
              </div>
            )}

            {/* Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="date" className="text-sm font-medium text-gray-700">
                  Date *
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={meetingForm.scheduledDate}
                  onChange={(e) => setMeetingForm(prev => ({ ...prev, scheduledDate: e.target.value }))}
                  className="bg-white border-gray-300 focus:border-purple-400 focus:ring-purple-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time" className="text-sm font-medium text-gray-700">
                  Start Time *
                </Label>
                <Input
                  id="time"
                  type="time"
                  value={meetingForm.scheduledTime}
                  onChange={(e) => setMeetingForm(prev => ({ ...prev, scheduledTime: e.target.value }))}
                  className="bg-white border-gray-300 focus:border-purple-400 focus:ring-purple-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime" className="text-sm font-medium text-gray-700">
                  End Time
                </Label>
                <Input
                  id="endTime"
                  type="time"
                  value={meetingForm.endTime}
                  onChange={(e) => setMeetingForm(prev => ({ ...prev, endTime: e.target.value }))}
                  className="bg-white border-gray-300 focus:border-purple-400 focus:ring-purple-400"
                />
              </div>
            </div>

            {/* Agenda */}
            <div className="space-y-2">
              <Label htmlFor="agenda" className="text-sm font-medium text-gray-700">
                Agenda (Optional)
              </Label>
              <Textarea
                id="agenda"
                placeholder="Meeting agenda and topics to discuss..."
                value={meetingForm.agenda}
                onChange={(e) => setMeetingForm(prev => ({ ...prev, agenda: e.target.value }))}
                rows={3}
                className="bg-white border-gray-300 focus:border-purple-400 focus:ring-purple-400 resize-none text-sm max-h-28 md:max-h-32"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-gray-200 pt-4">
            <Button
              variant="outline"
              onClick={() => setMeetingDialog(false)}
              className="bg-white hover:bg-gray-100 border-gray-300 h-9 text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitMeeting}
              className="bg-blue-600 hover:bg-blue-700 text-white h-9 text-sm"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Team Details Dialog */}
      <Dialog open={teamDetailsDialog} onOpenChange={setTeamDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="border-b border-gray-200 pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900">
              Project #{selectedTeam?.projectNumber} - Details
            </DialogTitle>
            <DialogDescription className="text-gray-600 mt-2 text-sm">
              Complete project information, team members, and submitted deliverables for {selectedPhase?.phaseName || 'this phase'}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Project Information */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-700 uppercase flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" />
                Project Information
              </h3>
              
              <div className="bg-gradient-to-br from-purple-50 to-purple-100/30 rounded-lg p-4 border border-purple-200 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-semibold text-gray-700 min-w-24">Title:</span>
                  <span className="text-sm font-semibold text-gray-900">{selectedTeam?.projectTitle || 'Not provided'}</span>
                </div>
                {selectedTeam?.projectAbstract && (
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-semibold text-gray-700 min-w-24">Abstract:</span>
                    <span className="text-xs text-gray-700 leading-relaxed">{selectedTeam.projectAbstract}</span>
                  </div>
                )}
                {selectedTeam?.mentorDetails && (
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-semibold text-gray-700 min-w-24">Mentor:</span>
                    <span className="text-xs text-gray-900">{selectedTeam.mentorDetails.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Team Members */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-700 uppercase flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Team Members ({selectedTeam?.memberDetails?.length || 0})
              </h3>
              
              <div className="grid gap-2">
                {selectedTeam?.memberDetails?.map((member, index) => {
                  const memberGrade = memberGrades.find(
                    g => g.studentEmail === member.email && g.teamId === selectedTeam.id && g.phaseId === selectedPhase?.id
                  );
                  
                  return (
                    <div
                      key={member.email}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        memberGrade
                          ? 'border-green-200 bg-green-50/30'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-gray-900">{member.name}</div>
                        <div className="text-xs text-gray-600">{member.email}</div>
                      </div>
                      {memberGrade && (
                        <Badge className="bg-green-600 text-white text-xs">
                          {memberGrade.isAbsent ? 'Absent' : `${memberGrade.overallScore}%`}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Phase Submissions */}
            {selectedPhase && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-700 uppercase flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" />
                  Submissions for {selectedPhase.phaseName}
                </h3>
                
                {(() => {
                  const teamSubmissions = submissions.filter(
                    s => s.teamId === selectedTeam?.id && s.phaseId === selectedPhase.id
                  );
                  
                  if (teamSubmissions.length === 0) {
                    return (
                      <div className="p-8 text-center border border-gray-200 rounded-lg bg-gray-50">
                        <p className="text-xs text-gray-500">No submissions yet for this phase</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="space-y-2">
                      {teamSubmissions.map(submission => (
                        <div
                          key={submission.id}
                          className="flex items-start justify-between p-3 rounded-lg border border-purple-200 bg-purple-50/30 hover:bg-purple-50 transition-colors"
                        >
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-purple-600 flex-shrink-0" />
                              <span className="text-sm font-medium text-gray-900 truncate">
                                {submission.fileName || 'Submission'}
                              </span>
                            </div>
                            {submission.notes && (
                              <p className="text-xs text-gray-600 ml-6">{submission.notes}</p>
                            )}
                            <div className="text-xs text-gray-500 ml-6">
                              Submitted: {submission.submittedAt?.toLocaleDateString()} at {submission.submittedAt?.toLocaleTimeString()}
                            </div>
                            {/* Display submission links */}
                            {submission.fileUrls && submission.fileUrls.length > 0 && (
                              <div className="ml-6 space-y-1 mt-2">
                                {submission.fileUrls.map((link, idx) => (
                                  <a
                                    key={idx}
                                    href={link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                  >
                                    <Eye className="h-3 w-3" />
                                    {submission.fileUrls.length > 1 ? `Link ${idx + 1}` : 'View Submission'}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                          {submission.fileUrls && submission.fileUrls.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(submission.fileUrls[0], '_blank')}
                              className="bg-white hover:bg-purple-50 border-purple-200 text-purple-700 h-8 text-xs flex-shrink-0"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1.5" />
                              View
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-gray-200 pt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setTeamDetailsDialog(false)}
              className="bg-white hover:bg-gray-100 border-gray-300 h-9 text-sm"
            >
              Close
            </Button>
            <Button
              onClick={() => {
                setTeamDetailsDialog(false);
                handleStartEvaluation(selectedTeam);
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white h-9 text-sm"
            >
              <Star className="h-4 w-4 mr-2" />
              Evaluate Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

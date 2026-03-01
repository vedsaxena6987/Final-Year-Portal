"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSession } from '@/context/SessionContext';
import { useTeamData } from '@/hooks/useTeamData';
import { usePhases } from '@/hooks/usePhases';
import { usePendingInvitations } from '@/hooks/usePendingInvitations';
import { useStudentGrades } from '@/hooks/useStudentGrades';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, FileText, GraduationCap, Star, Activity, ChevronLeft, ChevronRight, Menu, Clock, CheckCircle, XCircle, AlertTriangle, HelpCircle, LogOut, User, CalendarClock, UserX, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

import { logger } from "../../../lib/logger";
// Import student components
import PendingInvitations from '@/components/dashboard/student/PendingInvitations';
import MentorshipStatus from '@/components/dashboard/student/MentorshipStatus';
import MeetingAnnouncements from '@/components/dashboard/MeetingAnnouncements';
import MyMeetings from '@/components/dashboard/student/MyMeetings';
import PhaseCardWithSubmission from '@/components/dashboard/student/PhaseCardWithSubmission';
import MyGrades from '@/components/dashboard/student/MyGrades';
import ProjectDetails from '@/components/dashboard/student/ProjectDetails';
import PanelDetailsCard from '@/components/dashboard/student/PanelDetailsCard';
import ProfileSection from '@/components/dashboard/ProfileSection';
import PanelEvaluationService from '@/services/panelEvaluationService';
import Footer from '@/components/dashboard/shared/Footer';
import UserProfileDialog from '@/components/dashboard/shared/UserProfileDialog';

export default function StudentDashboardPage() {
  const router = useRouter();
  const { userData, loading } = useAuth();
  const { activeSession, loading: sessionLoading } = useSession();
  const { team, members, loading: teamLoading } = useTeamData();
  // CRITICAL: Only fetch phases when session is ready - prevents bad request errors
  const { phases, loading: phasesLoading } = usePhases(activeSession?.id || null);
  const { pendingCount } = usePendingInvitations(userData?.teamId);
  const { grades } = useStudentGrades();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mentorDetails, setMentorDetails] = useState(null);
  const [panelEvaluationStatus, setPanelEvaluationStatus] = useState({}); // { phaseId: { panelMembers: [], ... } }
  const [profileDialog, setProfileDialog] = useState({ isOpen: false, email: null, name: null });

  // Load sidebar collapse state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('studentDashboardSidebarCollapsed');
    if (saved !== null) {
      setSidebarCollapsed(JSON.parse(saved));
    }
  }, []);

  // Save sidebar collapse state to localStorage
  const toggleSidebar = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem('studentDashboardSidebarCollapsed', JSON.stringify(newState));
  };

  // Fetch mentor details
  useEffect(() => {
    const fetchMentorDetails = async () => {
      if (!team?.mentorEmail) {
        setMentorDetails(null);
        return;
      }

      try {
        const { doc: fsDoc, getDoc } = await import('firebase/firestore');
        const mentorRef = fsDoc(db, 'users', team.mentorEmail);
        const mentorSnap = await getDoc(mentorRef);
        if (mentorSnap.exists()) {
          setMentorDetails(mentorSnap.data());
        }
      } catch (error) {
        logger.error('Error fetching mentor details:', error);
      }
    };

    fetchMentorDetails();
  }, [team?.mentorEmail]);

  // Fetch panel evaluation status for panel phases
  useEffect(() => {
    const fetchPanelEvaluationStatus = async () => {
      if (!team?.id || !team?.panelId || !phases?.length || !userData?.email) return;

      try {
        const panelPhases = phases.filter(p => p.phaseType === 'panel');
        const statusMap = {};

        for (const phase of panelPhases) {
          const details = await PanelEvaluationService.getStudentEvaluationDetails(
            team.id,
            phase.id,
            team.panelId,
            userData.email
          );
          statusMap[phase.id] = {
            ...details,
            phaseName: phase.phaseName || phase.name
          };
        }

        setPanelEvaluationStatus(statusMap);
      } catch (error) {
        logger.error('Error fetching panel evaluation status:', error);
      }
    };

    fetchPanelEvaluationStatus();
  }, [team?.id, team?.panelId, phases, userData?.email]);

  // Handle logout
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

  // Check leadership using both UID and email for backward compatibility
  // Old imports may have email in leaderId, new teams use UID
  const isLeader = userData?.uid === team?.leaderId ||
    userData?.email?.toLowerCase() === team?.leaderEmail?.toLowerCase();

  // Tab configuration
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Users },
    { id: 'members', label: 'Team Members', icon: Users },
    { id: 'workflow', label: 'Project Workflow', icon: Activity },
    { id: 'phases', label: 'Phases', icon: FileText },
    { id: 'meetings', label: 'My Meetings', icon: CalendarClock },
    { id: 'details', label: 'Project Details', icon: GraduationCap },
    { id: 'grades', label: 'My Grades', icon: Star },
    { id: 'help', label: 'Help', icon: HelpCircle },
  ];

  const activeTabConfig = tabs.find(t => t.id === activeTab);

  // Get workflow status for rendering
  const getWorkflowStatus = () => {
    if (!team) return null;

    if (!team.mentorId) {
      return { stage: 'mentor', status: 'pending', label: 'Select Mentor' };
    }

    const submittedPhaseIds = team.submittedPhaseIds || [];
    const nextPhase = phases.find(p => !submittedPhaseIds.includes(p.id));
    if (nextPhase) {
      return { stage: 'phase', status: 'in_progress', label: nextPhase.phaseName || nextPhase.title, phase: nextPhase };
    }

    return { stage: 'complete', status: 'approved', label: 'All Phases Complete' };
  };

  // Calculate days left for current phase
  const getDaysLeft = () => {
    if (!workflowStatus?.phase?.endDate) return 'N/A';
    
    const now = new Date();
    const deadline = workflowStatus.phase.endDate;
    const diffTime = deadline - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // If deadline passed, show N/A
    if (diffDays < 0) return 'N/A';
    
    return diffDays;
  };

  // Get status badge info
  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return { variant: 'default', icon: CheckCircle, text: 'Approved', className: 'bg-green-500 hover:bg-green-600' };
      case 'rejected':
        return { variant: 'destructive', icon: XCircle, text: 'Rejected', className: 'bg-red-500 hover:bg-red-600' };
      case 'pending':
      case 'pending_review':
        return { variant: 'secondary', icon: Clock, text: 'Pending', className: 'bg-yellow-500 hover:bg-yellow-600 text-white' };
      case 'revisions_requested':
      case 'feedback_provided':
        return { variant: 'outline', icon: AlertTriangle, text: 'Revisions Needed', className: 'bg-orange-500 hover:bg-orange-600 text-white' };
      default:
        return { variant: 'secondary', icon: Clock, text: 'Not Submitted', className: 'bg-gray-500 hover:bg-gray-600 text-white' };
    }
  };

  // Workflow rendering logic
  const renderWorkflowContent = () => {
    if (!team || !userData?.teamId) return null;

    // Stage 1: Mentor Selection and Approval Process
    if (!team.mentorId) {
      return <MentorshipStatus team={team} />;
    }

    // Stage 2: Dynamic Phases
    if (phases.length > 0) {
      const submittedPhaseIds = team.submittedPhaseIds || [];
      const nextPhase = phases.find(p => !submittedPhaseIds.includes(p.id));

      if (nextPhase) {
        return (
          <PhaseCardWithSubmission
            phase={nextPhase}
            teamId={userData.teamId}
            teamName={team.name}
            team={team}
            isLeader={isLeader}
            index={0}
          />
        );
      }
    }

    // Stage 3: All Complete
    return (
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-gray-900 mb-2">All Phases Complete!</h3>
          <p className="text-sm text-gray-600">Congratulations! All phase submissions are complete.</p>
        </CardContent>
      </Card>
    );
  };

  // Redirect to login if not authenticated (before early returns to maintain hooks order)
  useEffect(() => {
    if (!loading && !userData) {
      router.push('/login');
    }
  }, [userData, loading, router]);

  // CRITICAL: Wait for ALL contexts to load before rendering
  // This prevents race conditions where components try to access undefined data
  const isFullyLoaded = !loading && !sessionLoading && !teamLoading && !phasesLoading;
  
  if (!isFullyLoaded) {
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

  if (!userData) {
    return null;
  }

  if (!team) {
    return null;
  }

  const workflowStatus = getWorkflowStatus();
  const statusInfo = getStatusBadge(workflowStatus?.status || 'not_submitted');
  const StatusIcon = statusInfo.icon;

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Mobile Hamburger Menu Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="md:hidden fixed top-3 left-3 z-50 bg-white hover:bg-teal-50 shadow-lg rounded-lg h-11 w-11 p-0 border border-gray-200 hover:border-teal-300 transition-all"
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
          ${sidebarCollapsed ? 'w-[60px]' : 'w-60'}
          transition-all duration-300 ease-in-out
          bg-white border-r border-gray-200 flex flex-col
          fixed md:relative h-full z-50
          ${mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
          max-md:w-[280px]
        `}
        role="navigation"
        aria-label="Student dashboard navigation"
      >
        {/* Mobile Close Button */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-3 right-3 z-10">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(false)}
              className="h-8 w-8 p-0 hover:bg-teal-50 rounded-full"
              aria-label="Close menu"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Team Header */}
          <div className="p-4 border-b border-gray-200 bg-gradient-to-br from-white to-teal-50/20">
            {!sidebarCollapsed ? (
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-md">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  {team.projectNumber && (
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full px-1.5 py-0.5 shadow-sm border border-teal-200">
                      <span className="text-[8px] font-bold text-teal-700">#{team.projectNumber}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-bold text-gray-900 truncate">Project #{team.projectNumber || 'N/A'}</h2>
                  <p className="text-xs text-gray-500 truncate">{team.projectTitle || 'No project title'}</p>
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-md">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  {team.projectNumber && (
                    <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full px-1 py-0.5 shadow-sm border border-teal-200">
                      <span className="text-[7px] font-bold text-teal-700">#{team.projectNumber}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Navigation Menu */}
          <div className="p-3 space-y-1">
            {!sidebarCollapsed ? (
              <div className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const showNotification = isLeader && tab.id === 'members' && pendingCount > 0;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                        transition-all duration-200 text-sm font-medium relative
                        ${isActive
                          ? 'bg-teal-600 text-white shadow-md'
                          : 'text-gray-700 hover:bg-gray-100'
                        }
                      `}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{tab.label}</span>
                      {showNotification && (
                        <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2 flex flex-col items-center">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const showNotification = isLeader && tab.id === 'members' && pendingCount > 0;
                  return (
                    <div key={tab.id} className="relative group">
                      <button
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                          w-10 h-10 flex items-center justify-center rounded-lg
                          transition-all duration-200 relative
                          ${isActive
                            ? 'bg-teal-600 text-white shadow-md'
                            : 'text-gray-600 hover:bg-gray-100'
                          }
                        `}
                        title={tab.label}
                      >
                        <Icon className="h-4 w-4" />
                        {showNotification && (
                          <span className="absolute top-0.5 right-0.5 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                          </span>
                        )}
                      </button>

                      {/* Tooltip */}
                      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                        <div className="bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                          {tab.label}
                          {showNotification && (
                            <span className="ml-1.5 inline-flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4">
                              {pendingCount}
                            </span>
                          )}
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
        <div className="flex-none p-3 border-t border-gray-200">
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
            className={`${sidebarCollapsed ? 'w-9 h-9 p-0' : 'w-full justify-center'} hover:bg-teal-50 hover:text-teal-700`}
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
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Right Window Header */}
        <header className="flex-none h-12 bg-white border-b border-gray-200 shadow-sm relative">
          <div className="h-full px-3 md:px-6 flex items-center justify-between gap-2">
            {/* Left Section: Breadcrumb + Active Tab */}
            <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0 ml-12 md:ml-0">
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 md:gap-2 text-sm min-w-0">
                <span className="font-bold text-gray-900 truncate max-w-[100px] md:max-w-[200px]">
                  Project #{team.projectNumber || 'N/A'}
                </span>
              </div>              {/* Divider */}
              <div className="h-6 w-px bg-gray-300 hidden sm:block"></div>

              {/* Active Tab Title with Icon */}
              <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                {activeTabConfig && (
                  <>
                    <div className="p-1 bg-teal-50 rounded">
                      {(() => {
                        const Icon = activeTabConfig.icon;
                        return <Icon className="h-3.5 w-3.5 text-teal-600" />;
                      })()}
                    </div>
                    <span className="text-xs md:text-sm font-semibold text-gray-700 hidden xs:inline">
                      {activeTabConfig.label}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Right Section: Quick Actions */}
            <div className="flex items-center gap-2 md:gap-3 shrink-0">
              {/* User Account Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 hover:bg-teal-50 rounded-lg flex items-center gap-2"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-teal-600 text-white text-xs font-bold">
                        {userData?.name?.charAt(0)?.toUpperCase() || 'S'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-gray-700 hidden md:inline max-w-[100px] truncate">
                      {userData?.name?.split(' ')[0] || 'Student'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{userData?.name || 'Student'}</p>
                      <p className="text-xs leading-none text-muted-foreground">{userData?.email || ''}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setActiveTab('profile')} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setActiveTab('help')} className="cursor-pointer">
                    <HelpCircle className="mr-2 h-4 w-4" />
                    <span>Help</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Teal Accent Line */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-500 to-transparent opacity-50"></div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-br from-gray-50 via-white to-gray-50/50 flex flex-col">
          <div className="flex-1 w-full">
            {/* Meeting Announcements Banner - Shows on all tabs */}
            <MeetingAnnouncements userRole="student" teamId={userData?.teamId} />

            <div className="max-w-7xl mx-auto p-4 space-y-3">
              {/* Dashboard Tab */}
              {activeTab === 'dashboard' && (
                <div className="animate-fadeIn">
                  <div className="space-y-3">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Members Count */}
                      <div className="bg-gradient-to-br from-teal-50 to-teal-100/50 rounded-lg p-4 border border-teal-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="h-5 w-5 text-teal-600" />
                          <span className="text-2xl font-bold text-teal-700">{members?.length || 0}</span>
                        </div>
                        <p className="text-xs font-semibold text-teal-700/80 uppercase">Team Members</p>
                      </div>

                      {/* Phases Evaluated Count */}
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg p-4 border border-blue-200">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-5 w-5 text-blue-600" />
                          <span className="text-2xl font-bold text-blue-700">
                            {grades?.length || 0}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-blue-700/80 uppercase">Evaluated</p>
                      </div>

                      {/* Current Phase */}
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-lg p-4 border border-purple-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="h-5 w-5 text-purple-600" />
                          <span className="text-base font-bold text-purple-700 truncate">
                            {workflowStatus?.label.split(' ').slice(0, 2).join(' ') || 'N/A'}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-purple-700/80 uppercase">Current Phase</p>
                      </div>

                      {/* Days to Deadline */}
                      <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-lg p-4 border border-orange-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-5 w-5 text-orange-600" />
                          <span className="text-2xl font-bold text-orange-700">{getDaysLeft()}</span>
                        </div>
                        <p className="text-xs font-semibold text-orange-700/80 uppercase">Days Left</p>
                      </div>
                    </div>

                    {/* Main Content Grid */}
                    <div className="grid md:grid-cols-2 gap-3">
                      {/* Team Members Card */}
                      <Card className="border-gray-200">
                        <CardContent className="p-4">
                          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center justify-between">
                            <span>Team Members</span>
                            <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-300 text-xs">
                              {members?.length || 0}/4
                            </Badge>
                          </h3>
                          <ul className="space-y-2">
                            {members?.map((member, index) => (
                              <li key={member.email || member.uid || index} className="flex items-center justify-between p-2 rounded-md bg-slate-50 hover:bg-slate-100 transition-colors">
                                <div className="flex items-center gap-2 cursor-pointer" onClick={() => setProfileDialog({ isOpen: true, email: member.email, name: member.name })}>
                                  <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                                    <span className="text-xs font-bold text-teal-700">{member.name?.charAt(0) || '?'}</span>
                                  </div>
                                  <span className="text-sm font-medium text-gray-900 underline-offset-4 hover:underline">{member.name}</span>
                                </div>
                                {member.uid === team.leaderId && (
                                  <Badge className="bg-teal-600 hover:bg-teal-700 text-xs h-5">Leader</Badge>
                                )}
                              </li>
                            ))}
                          </ul>
                          {isLeader && members.length < 4 && team.teamCode && (
                            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <p className="text-xs text-gray-600 mb-2 font-medium">Team Code:</p>
                              <code className="block bg-white px-3 py-2 rounded-md font-mono text-sm font-bold text-center border border-blue-300">
                                {team.teamCode}
                              </code>
                              <p className="text-[10px] text-gray-500 mt-2 text-center">
                                {4 - members.length} slot{4 - members.length !== 1 ? 's' : ''} remaining
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Current Workflow Status Card */}
                      <Card className="border-gray-200">
                        <CardContent className="p-4">
                          <h3 className="text-sm font-semibold text-gray-900 mb-3">Current Workflow Status</h3>
                          <div className="space-y-3">
                            {/* Mentor Status */}
                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                              <span className="text-xs font-medium text-gray-600">Mentor</span>
                              {team.mentorEmail ? (
                                <div
                                  className="flex items-center gap-1 cursor-pointer hover:bg-gray-100 p-1 rounded transition-colors"
                                  onClick={() => setProfileDialog({
                                    isOpen: true,
                                    email: team.mentorEmail,
                                    name: mentorDetails?.name || team.mentorEmail.split('@')[0]
                                  })}
                                >
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                  <span className="text-xs font-medium text-gray-900 border-b border-dotted border-gray-400">
                                    {mentorDetails?.name || team.mentorEmail.split('@')[0]}
                                  </span>
                                </div>
                              ) : team.pendingMentorshipRequest ? (
                                <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs h-5">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Pending
                                </Badge>
                              ) : (
                                <Badge className="bg-gray-500 hover:bg-gray-600 text-white text-xs h-5">
                                  Select Mentor
                                </Badge>
                              )}
                            </div>

                            {/* Phases Progress */}
                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                              <span className="text-xs font-medium text-gray-600">Phases Evaluated</span>
                              <Badge className="bg-blue-500 hover:bg-blue-600 text-xs h-5">
                                {grades?.length || 0} / {phases.length || 0}
                              </Badge>
                            </div>

                            {/* Panel Evaluation Details - Show per-panelist status */}
                            {Object.keys(panelEvaluationStatus).length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <p className="text-xs font-semibold text-gray-700 mb-2">Panel Evaluation Details</p>
                                {Object.entries(panelEvaluationStatus).map(([phaseId, status]) => {
                                  const panelMembers = status.panelMembers || [];
                                  const evaluatedMembers = panelMembers.filter(m => m.hasEvaluated);
                                  const absentMarkers = panelMembers.filter(m =>
                                    m.hasEvaluated && m.studentData?.isAbsent
                                  );

                                  return (
                                    <div key={phaseId} className="space-y-2 mb-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-medium text-gray-600">
                                          {status.phaseName}
                                        </span>
                                        <Badge variant="outline" className="text-[10px] h-4">
                                          {evaluatedMembers.length}/{panelMembers.length}
                                        </Badge>
                                      </div>

                                      {/* Show evaluated faculty */}
                                      {evaluatedMembers.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                          {evaluatedMembers.map(member => (
                                            <div
                                              key={member.uid}
                                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] cursor-pointer hover:opacity-80 transition-opacity ${member.studentData?.isAbsent
                                                ? 'bg-red-100 text-red-700 border border-red-200'
                                                : 'bg-green-100 text-green-700 border border-green-200'
                                                }`}
                                              onClick={() => setProfileDialog({
                                                isOpen: true,
                                                email: member.email,
                                                name: member.name
                                              })}
                                            >
                                              {member.studentData?.isAbsent ? (
                                                <UserX className="h-2.5 w-2.5" />
                                              ) : (
                                                <CheckCircle className="h-2.5 w-2.5" />
                                              )}
                                              <span>{member.name?.split(' ')[0] || 'Faculty'}</span>
                                              {member.studentData?.isAbsent && (
                                                <span className="font-medium">(Absent)</span>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {/* Show pending faculty */}
                                      {panelMembers.filter(m => !m.hasEvaluated).length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                          {panelMembers.filter(m => !m.hasEvaluated).map(member => (
                                            <div
                                              key={member.uid}
                                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 text-[10px] cursor-pointer hover:bg-gray-200 transition-colors"
                                              onClick={() => setProfileDialog({
                                                isOpen: true,
                                                email: member.email,
                                                name: member.name
                                              })}
                                            >
                                              <Clock className="h-2.5 w-2.5" />
                                              <span>{member.name?.split(' ')[0] || 'Faculty'}</span>
                                              <span className="text-gray-400">(Pending)</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              )}

              {/* Team Members Tab */}
              {activeTab === 'members' && (
                <div className="animate-fadeIn space-y-3">
                  {/* Team Members List */}
                  <Card className="border-teal-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-teal-600" />
                          <h3 className="text-sm font-semibold text-gray-900">Team Members</h3>
                        </div>
                        <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-300 text-xs h-5">
                          {members?.length || 0}/4
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        {members?.map((member, index) => (
                          <div key={member.email || index} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                                <span className="text-sm font-bold text-teal-700">{member.name?.charAt(0) || '?'}</span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{member.name}</p>
                                <p className="text-xs text-gray-500">{member.email}</p>
                              </div>
                            </div>
                            {member.uid === team.leaderId && (
                              <Badge className="bg-teal-600 hover:bg-teal-700 text-xs h-5">Leader</Badge>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Team Code for Leader */}
                      {isLeader && members.length < 4 && team.teamCode && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-xs text-gray-600 mb-2 font-medium">Share Team Code:</p>
                          <code className="block bg-white px-3 py-2 rounded-md font-mono text-sm font-bold text-center border border-blue-300">
                            {team.teamCode}
                          </code>
                          <p className="text-[10px] text-gray-500 mt-2 text-center">
                            {4 - members.length} slot{4 - members.length !== 1 ? 's' : ''} remaining
                          </p>
                        </div>
                      )}

                      {/* Pending Invitations for Leader */}
                      {isLeader && (
                        <div className="mt-4 pt-4 border-t">
                          <PendingInvitations teamId={userData?.teamId} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Project Workflow Tab */}
              {activeTab === 'workflow' && (
                <div className="animate-fadeIn space-y-3">
                  {renderWorkflowContent()}
                </div>
              )}

              {/* Phases Tab */}
              {activeTab === 'phases' && (
                <div className="animate-fadeIn space-y-3">
                  <Card className="border-teal-200">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <FileText className="h-5 w-5 text-teal-600" />
                        <h3 className="text-base font-semibold text-gray-900">Project Phases</h3>
                      </div>

                      {team.panelId && (
                        <div className="mb-4">
                          <PanelDetailsCard team={team} teamId={userData?.teamId} phases={phases} />
                        </div>
                      )}

                      {phases.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                          <p className="text-sm font-medium">No phases defined yet</p>
                          <p className="text-xs mt-1">Phases will appear here once set by admin</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {phases.map((phase, index) => (
                            <PhaseCardWithSubmission
                              key={phase.id}
                              phase={phase}
                              teamId={userData?.teamId}
                              teamName={team?.teamName}
                              team={team}
                              isLeader={isLeader}
                              index={index}
                            />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* My Meetings Tab */}
              {activeTab === 'meetings' && (
                <div className="animate-fadeIn">
                  <Card className="border-teal-200">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <CalendarClock className="h-5 w-5 text-teal-600" />
                        <h3 className="text-base font-semibold text-gray-900">My Team's Meetings</h3>
                      </div>
                      <MyMeetings teamId={userData?.teamId} />
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Project Details Tab */}
              {activeTab === 'details' && (
                <div className="animate-fadeIn">
                  <ProjectDetails team={{ id: userData?.teamId, ...team }} />
                </div>
              )}

              {/* My Grades Tab */}
              {activeTab === 'grades' && (
                <div className="animate-fadeIn">
                  <MyGrades />
                </div>
              )}

              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div className="animate-fadeIn">
                  <ProfileSection />
                </div>
              )}

              {/* Help Tab */}
              {activeTab === 'help' && (
                <div className="animate-fadeIn space-y-4">
                  {/* Header */}
                  <Card className="border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-teal-100 p-2.5 rounded-xl">
                          <HelpCircle className="h-5 w-5 text-teal-600" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-gray-900">Student Help Center</h3>
                          <p className="text-xs text-gray-600">CSE Final Year Project Portal Guide</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Project Workflow Overview */}
                  <Card className="border-blue-200">
                    <CardContent className="p-4">
                      <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="text-blue-500">🎯</span> Complete Project Workflow
                      </h4>
                      <div className="space-y-4">
                        {/* Initial Setup */}
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <h5 className="text-xs font-bold text-blue-900 mb-2 uppercase tracking-wide">Phase 0: Initial Setup</h5>
                          <ol className="space-y-1.5 text-xs text-gray-700 list-decimal list-inside">
                            <li><strong>Create/Join Team</strong> — Form a team of up to 4 members (one leader)</li>
                            <li><strong>Select Mentor</strong> — Choose a faculty mentor for your project</li>
                            <li><strong>Abstract Approval</strong> — Submit your project abstract for mentor approval</li>
                          </ol>
                          <p className="text-xs text-blue-700 mt-2 italic">
                            ⚠️ You cannot proceed to evaluation phases until your abstract is approved by your mentor. If your mentor
                            rejects the abstract or requests a revision, update your abstract based on the feedback and resubmit it until
                            it is approved.
                          </p>
                        </div>

                        {/* 7th Semester */}
                        <div className="p-3 bg-violet-50 rounded-lg border border-violet-200">
                          <h5 className="text-xs font-bold text-violet-900 mb-2 uppercase tracking-wide">7th Semester (3 Phases)</h5>
                          <div className="space-y-2 text-xs text-gray-700">
                            <div className="flex items-start gap-2">
                              <span className="bg-violet-200 text-violet-800 px-1.5 py-0.5 rounded text-[10px] font-bold">1</span>
                              <div><strong>Mentor Phase</strong> — Your mentor evaluates your initial progress and documentation</div>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="bg-violet-200 text-violet-800 px-1.5 py-0.5 rounded text-[10px] font-bold">2</span>
                              <div><strong>Panel Phase</strong> — Present to an evaluation panel (all panelists must evaluate you)</div>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="bg-violet-200 text-violet-800 px-1.5 py-0.5 rounded text-[10px] font-bold">3</span>
                              <div><strong>Panel Phase</strong> — Present to an evaluation panel (all panelists must evaluate you)</div>
                            </div>
                          </div>
                        </div>

                        {/* 8th Semester */}
                        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                          <h5 className="text-xs font-bold text-emerald-900 mb-2 uppercase tracking-wide">8th Semester (2 Phases)</h5>
                          <div className="space-y-2 text-xs text-gray-700">
                            <div className="flex items-start gap-2">
                              <span className="bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-bold">1</span>
                              <div><strong>Panel Phase</strong> — Internal panel viva (all panelists must evaluate you)</div>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-bold">2</span>
                              <div><strong>External Phase</strong> — Final evaluation by an external industry expert</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Panel Evaluation Info */}
                  <Card className="border-amber-200">
                    <CardContent className="p-4">
                      <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="text-amber-500">👥</span> Understanding Panel Evaluations
                      </h4>
                      <div className="space-y-2 text-xs text-gray-700">
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                          <ul className="space-y-1.5">
                            <li>• <strong>All panelists must evaluate you</strong> — Your evaluation is only complete when every panel member has graded you</li>
                            <li>• <strong>Individual marks</strong> — Each team member receives individual marks (not team marks)</li>
                            <li>• <strong>Attendance matters</strong> — If marked absent by a panelist, you must arrange a re-evaluation with them</li>
                            <li>• <strong>Track your progress</strong> — Check which panelists have evaluated you in the Panel Overview section</li>
                            <li>• <strong>Average marks</strong> — Your final panel phase marks are the average of all panelist evaluations</li>
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* FAQs */}
                  <Card className="border-teal-200">
                    <CardContent className="p-4">
                      <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="text-teal-500">❓</span> Frequently Asked Questions
                      </h4>
                      <div className="space-y-3 text-xs">
                        <div className="p-2 bg-gray-50 rounded-lg">
                          <p className="font-semibold text-gray-900">How do I join a team?</p>
                          <p className="text-gray-600 mt-0.5">Ask your team leader to send you an invitation. Accept it from the pending invitations section on your dashboard.</p>
                        </div>
                        <div className="p-2 bg-gray-50 rounded-lg">
                          <p className="font-semibold text-gray-900">Can I change my mentor after approval?</p>
                          <p className="text-gray-600 mt-0.5">Contact the admin to request a mentor change. This requires approval from both the old and new mentor.</p>
                        </div>
                        <div className="p-2 bg-gray-50 rounded-lg">
                          <p className="font-semibold text-gray-900">What if I miss a deadline?</p>
                          <p className="text-gray-600 mt-0.5">Contact your mentor immediately. Some phases allow late submissions or extensions with admin approval.</p>
                        </div>
                        <div className="p-2 bg-gray-50 rounded-lg">
                          <p className="font-semibold text-gray-900">How are my final marks calculated?</p>
                          <p className="text-gray-600 mt-0.5">Marks from all phases are combined. Panel phases use the average of all panelist marks. Check the "My Grades" tab for details.</p>
                        </div>
                        <div className="p-2 bg-gray-50 rounded-lg">
                          <p className="font-semibold text-gray-900">What if a panelist marks me absent?</p>
                          <p className="text-gray-600 mt-0.5">You need to contact that specific panelist to schedule a re-evaluation. Your panel evaluation won't be complete until all panelists have evaluated you.</p>
                        </div>
                        <div className="p-2 bg-gray-50 rounded-lg">
                          <p className="font-semibold text-gray-900">Who evaluates in the External Phase?</p>
                          <p className="text-gray-600 mt-0.5">An external industry expert assigned by the department evaluates your final project in the 8th semester.</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Contact Support */}
                  <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
                    <CardContent className="p-4">
                      <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <span className="text-green-500">💬</span> Need More Help?
                      </h4>
                      <p className="text-xs text-gray-600">
                        For technical issues or questions not covered above, use the contact links in the footer below to reach out to the development team.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

          </div>

          {/* Footer - inside scrollable area, below sidebar level */}
          <Footer showPhoneNumbers={false} />
        </div>
      </div>

      <UserProfileDialog
        isOpen={profileDialog.isOpen}
        onClose={() => setProfileDialog(prev => ({ ...prev, isOpen: false }))}
        email={profileDialog.email}
        name={profileDialog.name}
      />
    </div >
  );
}

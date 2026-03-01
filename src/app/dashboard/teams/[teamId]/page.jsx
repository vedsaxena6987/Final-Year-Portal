"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Users, FileText, GraduationCap, CheckCircle, XCircle, Clock, AlertTriangle, ChevronLeft, ChevronRight, Menu, Star, Activity } from 'lucide-react';
import { toast } from 'sonner';
import TeamInfoTab from '@/components/dashboard/faculty/TeamInfoTab';
import TeamMarksTab from '@/components/dashboard/faculty/TeamMarksTab';
import TeamSubmissionsTab from '@/components/dashboard/faculty/TeamSubmissionsTab';
import TeamActivitiesTab from '@/components/dashboard/faculty/TeamActivitiesTab';

import { logger } from "../../../../lib/logger";
export default function TeamDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { userData } = useAuth();
  const [team, setTeam] = useState(null);
  const [leader, setLeader] = useState(null);
  const [mentor, setMentor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('info');

  const teamId = params.teamId;

  // Load sidebar collapse state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('teamDetailSidebarCollapsed');
    if (saved !== null) {
      setSidebarCollapsed(JSON.parse(saved));
    }
  }, []);

  // Save sidebar collapse state to localStorage
  const toggleSidebar = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem('teamDetailSidebarCollapsed', JSON.stringify(newState));
  };

  // Fetch team data
  useEffect(() => {
    if (!teamId || !userData?.uid || !userData?.email) {
      setLoading(false);
      return;
    }

    const teamRef = doc(db, 'teams', teamId);

    const unsubscribe = onSnapshot(teamRef, async (docSnap) => {
      try {
        if (!docSnap.exists()) {
          toast.error('Team not found');
          router.push('/dashboard');
          return;
        }

        const teamData = { id: docSnap.id, ...docSnap.data() };
        setTeam(teamData);

        // Check if faculty has access (mentor or panel member)
        // Use email-based comparison for consistency (mentorEmail is the canonical field)
        const isMentor = teamData.mentorEmail === userData.email || teamData.mentorId === userData.uid;
        let isPanelMember = false;

        if (teamData.panelId) {
          const panelRef = doc(db, 'panels', teamData.panelId);
          const panelSnap = await getDoc(panelRef);
          if (panelSnap.exists()) {
            const panelData = panelSnap.data();
            isPanelMember = panelData.facultyMembers?.some(
              member => member.uid === userData.uid || member.email === userData.email
            );
          }
        }

        if (!isMentor && !isPanelMember) {
          toast.error('You do not have access to this team');
          router.push('/dashboard');
          return;
        }

        setHasAccess(true);

        // Fetch leader and mentor details in PARALLEL for faster loading
        const detailsPromises = [];
        
        if (teamData.leaderEmail) {
          detailsPromises.push(
            getDoc(doc(db, 'users', teamData.leaderEmail))
              .then(snap => snap.exists() ? setLeader(snap.data()) : null)
              .catch(err => logger.error('Error fetching leader:', err))
          );
        }

        if (teamData.mentorEmail) {
          detailsPromises.push(
            getDoc(doc(db, 'users', teamData.mentorEmail))
              .then(snap => snap.exists() ? setMentor(snap.data()) : null)
              .catch(err => logger.error('Error fetching mentor:', err))
          );
        }

        await Promise.all(detailsPromises);
        setLoading(false);
      } catch (error) {
        logger.error('Error processing team data:', error);
        setLoading(false);
      }
    }, (error) => {
      // Silently handle permission denied during logout
      if (error.code === 'permission-denied') {
        logger.log('Permission denied - user may have logged out');
      } else {
        logger.error('Error fetching team:', error);
        toast.error('Failed to load team details');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [teamId, userData?.uid, userData?.email, router]);

  // Get status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return { variant: 'default', icon: CheckCircle, text: 'Approved', className: 'bg-green-500 hover:bg-green-600' };
      case 'rejected':
        return { variant: 'destructive', icon: XCircle, text: 'Rejected', className: 'bg-red-500 hover:bg-red-600' };
      case 'pending':
        return { variant: 'secondary', icon: Clock, text: 'Pending', className: 'bg-yellow-500 hover:bg-yellow-600 text-white' };
      case 'under_review':
        return { variant: 'outline', icon: AlertTriangle, text: 'Under Review', className: 'bg-orange-500 hover:bg-orange-600 text-white' };
      default:
        return { variant: 'secondary', icon: Clock, text: 'Not Submitted', className: 'bg-gray-500 hover:bg-gray-600 text-white' };
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex overflow-hidden bg-gray-50">
        {/* Loading Sidebar */}
        <div className="w-60 bg-white border-r border-gray-200 p-4 space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        {/* Loading Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Skeleton className="h-12 w-full" />
          <div className="flex-1 p-6 space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!hasAccess || !team) {
    return null;
  }

  const statusInfo = getStatusBadge(team.abstractStatus);
  const StatusIcon = statusInfo.icon;

  // Tab configuration
  const tabs = [
    { id: 'info', label: 'Team Info', icon: Users },
    { id: 'marks', label: 'Marks', icon: Star },
    { id: 'submissions', label: 'Submissions', icon: FileText },
    { id: 'activities', label: 'Activities', icon: Activity },
  ];

  const activeTabConfig = tabs.find(t => t.id === activeTab);

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Mobile Hamburger Menu Button - Enhanced */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="md:hidden fixed top-3 left-3 z-50 bg-white hover:bg-teal-50 shadow-lg rounded-lg h-11 w-11 p-0 border border-gray-200 hover:border-teal-300 transition-all"
        aria-label="Toggle menu"
      >
        <Menu className={`h-5 w-5 transition-transform duration-200 ${mobileMenuOpen ? 'rotate-90' : ''}`} />
      </Button>

      {/* Mobile Backdrop - Enhanced */}
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

      {/* Left Sidebar - Enhanced Mobile */}
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
        aria-label="Team sidebar navigation"
      >
        {/* Mobile Close Button (X) - Only visible on mobile when menu is open */}
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
        {/* Back Button */}
        <div className="flex-none p-2 border-b border-gray-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className={`${sidebarCollapsed ? 'w-9 h-6 p-0' : 'w-full justify-start gap-2'} hover:bg-teal-50 hover:text-teal-700 transition-colors`}
            title="Back to Teams"
          >
            <ArrowLeft className="h-4 w-4" />
            {!sidebarCollapsed && <span className="text-sm font-medium">Back to Teams</span>}
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Team Header - Compact */}
          <div className="p-4 border-b border-gray-200 bg-gradient-to-br from-white to-teal-50/20">
            {!sidebarCollapsed ? (
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-md">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-white rounded-full px-1.5 py-0.5 shadow-sm border border-teal-200">
                    <span className="text-[8px] font-bold text-teal-700">#{team.projectNumber}</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-bold text-gray-900 truncate">{team.teamName}</h2>
                  <p className="text-xs text-gray-500 truncate">{team.projectTitle || 'No project title'}</p>
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-md">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full px-1 py-0.5 shadow-sm border border-teal-200">
                    <span className="text-[7px] font-bold text-teal-700">#{team.projectNumber}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Menu - Clean */}
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
                          ? 'bg-teal-600 text-white shadow-md' 
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
                            ? 'bg-teal-600 text-white shadow-md' 
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

        {/* Collapse Toggle Button */}
        <div className="flex-none p-3 border-t border-gray-200 hidden md:block">
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
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Right Window Header - Enhanced Mobile */}
        <header className="flex-none h-12 bg-white border-b border-gray-200 shadow-sm relative">
          <div className="h-full px-3 md:px-6 flex items-center justify-between gap-2">
            {/* Left Section: Breadcrumb + Active Tab - Mobile Optimized */}
            <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0 ml-12 md:ml-0">
              {/* Breadcrumb - Mobile Optimized */}
              <div className="flex items-center gap-1.5 md:gap-2 text-sm min-w-0">
                <span className="font-bold text-gray-900 truncate max-w-[100px] md:max-w-[200px]" title={team.teamName}>
                  {team.teamName}
                </span>
                <span className="text-gray-400 hidden sm:inline">/</span>
                <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-300 text-xs h-5 px-1.5 flex-shrink-0 hidden sm:flex">
                  #{team.projectNumber}
                </Badge>
              </div>

              {/* Divider - Hidden on mobile */}
              <div className="h-6 w-px bg-gray-300 hidden sm:block"></div>

              {/* Active Tab Title with Icon - Mobile Optimized */}
              <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
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

            {/* Right Section: Status Badges + Quick Actions - Mobile Optimized */}
            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              {/* Status Badges - Responsive */}
              <div className="flex items-center gap-1 md:gap-1.5">
                {/* Primary Status - Compact on mobile */}
                <Badge className={`${statusInfo.className} text-[10px] md:text-xs h-6 px-1.5 md:px-2 shadow-sm`}>
                  <StatusIcon className="h-3 w-3 md:mr-1" />
                  <span className="hidden sm:inline ml-1">{statusInfo.text}</span>
                </Badge>

                {/* Secondary Badges - Hidden on small mobile, icon-only on tablet */}
                {team.isMentored && (
                  <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-300 text-[10px] md:text-xs h-6 px-1.5 md:px-2 hidden sm:flex">
                    <GraduationCap className="h-3 w-3 md:mr-1" />
                    <span className="hidden md:inline ml-1">Mentored</span>
                  </Badge>
                )}
                {team.isPanelTeam && (
                  <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-300 text-[10px] md:text-xs h-6 px-1.5 md:px-2 hidden lg:flex">
                    <Users className="h-3 w-3 md:mr-1" />
                    <span className="hidden md:inline ml-1">Panel</span>
                  </Badge>
                )}
              </div>

              {/* Divider - Hidden on mobile */}
              <div className="h-6 w-px bg-gray-300 hidden md:block"></div>

              {/* Tab-Specific Quick Actions - Mobile Touch-Friendly */}
              <div className="flex items-center gap-1">
                {activeTab === 'info' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 md:h-7 md:w-auto md:px-2 p-0 text-xs hover:bg-teal-50 hover:text-teal-700 rounded-lg"
                    title="Edit Team Info"
                    aria-label="Edit Team Info"
                  >
                    <FileText className="h-4 w-4 md:h-3.5 md:w-3.5" />
                  </Button>
                )}
                
                {activeTab === 'marks' && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 md:h-7 md:w-auto md:px-2 p-0 md:p-2 text-xs hover:bg-teal-50 hover:text-teal-700 rounded-lg"
                      title="Add Marks"
                      aria-label="Add Marks"
                    >
                      <Star className="h-4 w-4 md:h-3.5 md:w-3.5" />
                      <span className="hidden lg:inline ml-1">Add</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 md:h-7 md:w-auto md:px-2 p-0 text-xs hover:bg-teal-50 hover:text-teal-700 rounded-lg hidden sm:flex"
                      title="Export Marks"
                      aria-label="Export Marks"
                    >
                      <FileText className="h-4 w-4 md:h-3.5 md:w-3.5" />
                    </Button>
                  </>
                )}

                {activeTab === 'submissions' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 md:h-7 md:w-auto md:px-2 p-0 md:p-2 text-xs hover:bg-teal-50 hover:text-teal-700 rounded-lg"
                    title="View All Submissions"
                    aria-label="View All Submissions"
                  >
                    <FileText className="h-4 w-4 md:h-3.5 md:w-3.5" />
                    <span className="hidden lg:inline ml-1">View All</span>
                  </Button>
                )}

                {activeTab === 'activities' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 md:h-7 md:w-auto md:px-2 p-0 text-xs hover:bg-teal-50 hover:text-teal-700 rounded-lg"
                    title="Filter Activities"
                    aria-label="Filter Activities"
                  >
                    <Activity className="h-4 w-4 md:h-3.5 md:w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Subtle Teal Accent Line */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-500 to-transparent opacity-50"></div>
        </header>

        {/* Optimized Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-br from-gray-50 via-white to-gray-50/50">
          {/* Content Container with Compact Styling */}
          <div className="h-full">
            {/* Compact wrapper for tab content */}
            <div className="max-w-7xl mx-auto p-4 space-y-3">
              {activeTab === 'info' && (
                <div className="animate-fadeIn">
                  <TeamInfoTab team={team} leader={leader} mentor={mentor} />
                </div>
              )}
              {activeTab === 'marks' && (
                <div className="animate-fadeIn">
                  <TeamMarksTab teamId={team.id} teamMembers={team.members} />
                </div>
              )}
              {activeTab === 'submissions' && (
                <div className="animate-fadeIn">
                  <TeamSubmissionsTab teamId={team.id} sessionId={team.sessionId} />
                </div>
              )}
              {activeTab === 'activities' && (
                <div className="animate-fadeIn">
                  <TeamActivitiesTab teamId={team.id} team={team} />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

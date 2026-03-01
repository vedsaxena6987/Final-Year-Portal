// src/components/dashboard/faculty/FacultyTasks.jsx - Premium Dashboard Home
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSession } from '@/context/SessionContext';
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from 'next/navigation';
import {
  Users,
  GraduationCap,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  FileText,
  CalendarCheck,
  Layers,
  UserCheck,
  Shield
} from 'lucide-react';
import FacultyQuickActions from './FacultyQuickActions';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { PanelService } from '@/services/panelService';

import { logger } from "../../../lib/logger";
export default function FacultyTasks({ setActiveTab }) {
  const router = useRouter();
  const { userData, loading } = useAuth();
  const { activeSession } = useSession();
  const [stats, setStats] = useState({
    pendingRequests: 0,
    totalMentored: 0,
    completedEvaluations: 0,
    activeTeams: 0,
    pendingAbstracts: 0
  });
  const [panelInfo, setPanelInfo] = useState(null);
  const [mentoredTeams, setMentoredTeams] = useState([]);
  const [panelTeams, setPanelTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [internalTab, setInternalTab] = useState('mentor');

  // Fetch panel information for this faculty
  useEffect(() => {
    const fetchPanelInfo = async () => {
      if (!userData?.panelId) {
        setPanelInfo(null);
        return;
      }

      try {
        const panel = await PanelService.getPanelDetails(userData.panelId);
        if (panel) {
          setPanelInfo({
            panelNumber: panel.panelNumber || 'N/A',
            facultyCount: panel.facultyMembers?.length || 0
          });
        }
      } catch (error) {
        logger.error('Error fetching panel info:', error);
        setPanelInfo(null);
      }
    };

    fetchPanelInfo();
  }, [userData?.panelId]);

  // Fetch mentor and panel teams
  useEffect(() => {
    if (!userData?.email || !userData?.uid || !activeSession?.id) {
      setTeamsLoading(false);
      return;
    }

    const teamsRef = collection(db, 'teams');

    // Query mentored teams
    const mentoredQuery = query(
      teamsRef,
      where('sessionId', '==', activeSession.id),
      where('mentorEmail', '==', userData.email)
    );

    const unsubscribeMentored = onSnapshot(mentoredQuery, async (snapshot) => {
      const mentored = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      // Batch fetch all leader names in parallel
      const { getDoc, doc: fsDoc } = await import('firebase/firestore');
      const emailsToFetch = [...new Set(mentored.map(t => t.leaderEmail).filter(Boolean))];
      const userPromises = emailsToFetch.map(email =>
        getDoc(fsDoc(db, 'users', email)).catch(() => null)
      );
      const userSnapshots = await Promise.all(userPromises);

      // Build email -> name map
      const userNameMap = {};
      emailsToFetch.forEach((email, i) => {
        if (userSnapshots[i]?.exists()) {
          userNameMap[email] = userSnapshots[i].data().name;
        }
      });

      // Apply names to teams
      mentored.forEach(team => {
        if (team.leaderEmail && userNameMap[team.leaderEmail]) {
          team.leaderName = userNameMap[team.leaderEmail];
        }
      });

      setMentoredTeams(mentored);
      setTeamsLoading(false);
    }, (error) => {
      // Silently handle permission denied during logout
      if (error.code === 'permission-denied') {
        logger.log('Permission denied - user may have logged out');
      } else {
        logger.error('Error fetching mentored teams:', error);
      }
      setTeamsLoading(false);
    });

    // Fetch panel teams
    const fetchPanelTeams = async () => {
      try {
        const panelsRef = collection(db, 'panels');
        const panelsQuery = query(
          panelsRef,
          where('sessionId', '==', activeSession.id)
        );
        const { getDocs } = await import('firebase/firestore');
        const panelsSnapshot = await getDocs(panelsQuery);
        const facultyPanels = [];

        panelsSnapshot.forEach(docSnap => {
          const panelData = docSnap.data();
          const isMember = panelData.facultyMembers?.some(
            member => member.uid === userData.uid ||
              member.uid === userData.email ||
              member.email === userData.email
          );
          if (isMember) {
            facultyPanels.push(docSnap.id);
          }
        });

        if (facultyPanels.length > 0) {
          const panelTeamsQuery = query(
            teamsRef,
            where('sessionId', '==', activeSession.id),
            where('panelId', 'in', facultyPanels.slice(0, 10))
          );

          const unsubscribePanel = onSnapshot(panelTeamsQuery, async (snapshot) => {
            const panel = snapshot.docs.map(docSnap => ({
              id: docSnap.id,
              ...docSnap.data()
            }));

            // Batch fetch all user names in parallel
            const { getDoc, doc: fsDoc } = await import('firebase/firestore');
            const emailsToFetch = new Set();
            panel.forEach(t => {
              if (t.leaderEmail) emailsToFetch.add(t.leaderEmail);
              if (t.mentorEmail && t.mentorEmail !== userData.email) {
                emailsToFetch.add(t.mentorEmail);
              }
            });

            const emailsArray = Array.from(emailsToFetch);
            const userPromises = emailsArray.map(email =>
              getDoc(fsDoc(db, 'users', email)).catch(() => null)
            );
            const userSnapshots = await Promise.all(userPromises);

            // Build email -> name map
            const userNameMap = {};
            emailsArray.forEach((email, i) => {
              if (userSnapshots[i]?.exists()) {
                userNameMap[email] = userSnapshots[i].data().name;
              }
            });

            // Apply names to teams
            panel.forEach(team => {
              if (team.leaderEmail && userNameMap[team.leaderEmail]) {
                team.leaderName = userNameMap[team.leaderEmail];
              }
              if (team.mentorEmail && userNameMap[team.mentorEmail]) {
                team.mentorName = userNameMap[team.mentorEmail];
              }
            });

            setPanelTeams(panel);
          });

          return unsubscribePanel;
        }
      } catch (error) {
        logger.error('Error fetching panel teams:', error);
      }
      return null;
    };

    let unsubscribePanel = null;
    fetchPanelTeams().then(unsub => { unsubscribePanel = unsub; });

    return () => {
      unsubscribeMentored();
      if (unsubscribePanel) unsubscribePanel();
    };
  }, [userData?.email, activeSession?.id]);

  useEffect(() => {
    if (!userData?.uid) return;

    // Listen to mentorship requests for stats
    const requestsQuery = query(
      collection(db, 'mentorship_requests'),
      where('mentorEmail', '==', userData.email)
    );

    const teamsQuery = query(
      collection(db, 'teams'),
      where('mentorEmail', '==', userData.email)
    );

    const unsubscribeRequests = onSnapshot(requestsQuery, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const pending = requests.filter(r => r.status === 'pending').length;

      setStats(prev => ({ ...prev, pendingRequests: pending }));
    }, (error) => {
      // Handle permission errors gracefully during logout
      if (error.code === 'permission-denied') {
      } else {
        logger.error('Error fetching mentorship requests:', error);
      }
    });

    const unsubscribeTeams = onSnapshot(teamsQuery, async (snapshot) => {
      const teams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const activeTeams = teams.filter(t => t.abstractStatus !== 'rejected').length;

      setStats(prev => ({
        ...prev,
        totalMentored: teams.length,
        activeTeams: activeTeams
      }));

      // Count pending abstract submissions
      if (teams.length > 0) {
        const teamIds = teams.map(t => t.id);
        const { query: fsQuery, where: fsWhere, getDocs } = await import('firebase/firestore');

        // Get abstract phase
        const phasesQuery = fsQuery(
          collection(db, 'phases'),
          fsWhere('type', '==', 'abstract')
        );
        const phasesSnapshot = await getDocs(phasesQuery);

        if (!phasesSnapshot.empty) {
          const abstractPhaseId = phasesSnapshot.docs[0].id;

          // Query pending submissions
          const submissionsQuery = fsQuery(
            collection(db, 'submissions'),
            fsWhere('teamId', 'in', teamIds.slice(0, 10)), // Firestore 'in' limit is 10
            fsWhere('phaseId', '==', abstractPhaseId),
            fsWhere('evaluationStatus', '==', 'pending')
          );
          const submissionsSnapshot = await getDocs(submissionsQuery);

          setStats(prev => ({
            ...prev,
            pendingAbstracts: submissionsSnapshot.size
          }));
        }
      }
    }, (error) => {
      // Handle permission errors gracefully during logout
      if (error.code === 'permission-denied') {
      } else {
        logger.error('Error fetching teams:', error);
      }
    });

    return () => {
      unsubscribeRequests();
      unsubscribeTeams();
    };
  }, [userData?.uid]);

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Skeleton for metrics */}
        <div className="grid-responsive-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card-stat">
              <div className="flex items-center gap-3">
                <div className="skeleton-faculty w-10 h-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton-faculty h-6 w-12" />
                  <div className="skeleton-faculty h-3 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Skeleton for quick actions */}
        <div className="grid-responsive-2">
          <div className="skeleton-card h-48" />
          <div className="skeleton-card h-48" />
        </div>
      </div>
    );
  }

  if (!userData || userData.role !== 'faculty') {
    return (
      <div className="empty-state py-16">
        <div className="empty-state-icon">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h2 className="empty-state-title">Access Restricted</h2>
        <p className="empty-state-text">
          This dashboard is exclusively for faculty members.
        </p>
      </div>
    );
  }

  const metrics = [
    {
      label: "Pending Requests",
      value: stats.pendingRequests,
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-gradient-to-br from-amber-50 via-amber-50/80 to-orange-50",
      iconBg: "bg-gradient-to-br from-amber-100 to-orange-100",
      borderColor: "border-amber-100",
      showBadge: stats.pendingRequests > 0,
      priority: stats.pendingRequests > 0 ? 'high' : null,
      shadowColor: "shadow-amber-100"
    },
    {
      label: "Active Teams",
      value: stats.activeTeams,
      icon: Users,
      color: "text-teal-600",
      bgColor: "bg-gradient-to-br from-teal-50 via-teal-50/80 to-cyan-50",
      iconBg: "bg-gradient-to-br from-teal-100 to-cyan-100",
      borderColor: "border-teal-100",
      shadowColor: "shadow-teal-100"
    },
    {
      label: "Total Mentored",
      value: stats.totalMentored,
      icon: GraduationCap,
      color: "text-emerald-600",
      bgColor: "bg-gradient-to-br from-emerald-50 via-emerald-50/80 to-green-50",
      iconBg: "bg-gradient-to-br from-emerald-100 to-green-100",
      borderColor: "border-emerald-100",
      shadowColor: "shadow-emerald-100"
    },
    // Panel Teams tile - only show if faculty is assigned to a panel
    ...(panelInfo ? [{
      label: `Panel ${panelInfo.panelNumber} Teams`,
      value: panelInfo.teamCount,
      icon: Layers,
      color: "text-indigo-600",
      bgColor: "bg-gradient-to-br from-indigo-50 via-indigo-50/80 to-blue-50",
      iconBg: "bg-gradient-to-br from-indigo-100 to-blue-100",
      borderColor: "border-indigo-100",
      shadowColor: "shadow-indigo-100",
      subtitle: `${panelInfo.facultyCount} panelists`
    }] : []),
    {
      label: "Evaluations",
      value: stats.completedEvaluations,
      icon: CheckCircle,
      color: "text-violet-600",
      bgColor: "bg-gradient-to-br from-violet-50 via-violet-50/80 to-purple-50",
      iconBg: "bg-gradient-to-br from-violet-100 to-purple-100",
      borderColor: "border-violet-100",
      shadowColor: "shadow-violet-100"
    }
  ];

  // Check if there are urgent items
  const hasUrgentItems = stats.pendingRequests > 0 || stats.pendingAbstracts > 0;

  return (
    <div className="space-y-4">
      {/* Greeting & Today's Focus */}
      <div className="mb-4 animate-fade-in-up">
        <h1 className="text-xl font-bold text-gray-900 mb-1 tracking-tight">
          Good {getGreeting()}, {userData?.name?.split(' ')[0] || 'Professor'} 👋
        </h1>
        <p className="text-sm text-gray-600 font-medium">
          {hasUrgentItems
            ? `You have ${stats.pendingRequests + stats.pendingAbstracts} items requiring attention`
            : "You're all caught up! No urgent tasks today."
          }
        </p>
      </div>

      {/* Teams Tabs Section - Moved to Top */}
      <div>
        <Tabs value={internalTab} onValueChange={setInternalTab} className="w-full">
          <TabsList className="w-full justify-start h-12 bg-white border border-gray-200 rounded-xl p-1 gap-1 shadow-sm">
            <TabsTrigger
              value="mentor"
              className="flex-1 rounded-lg h-10 text-sm font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200"
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Mentor Teams ({mentoredTeams.length})
            </TabsTrigger>
            <TabsTrigger
              value="panel"
              className="flex-1 rounded-lg h-10 text-sm font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200"
            >
              <Shield className="h-4 w-4 mr-2" />
              Panel Teams ({panelTeams.length})
            </TabsTrigger>
          </TabsList>

          {/* Mentor Teams Tab */}
          <TabsContent value="mentor" className="mt-4">
            {teamsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(i => (
                  <Card key={i} className="p-4">
                    <Skeleton className="h-12 w-12 rounded-xl mb-2" />
                    <Skeleton className="h-6 w-16 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </Card>
                ))}
              </div>
            ) : mentoredTeams.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="p-4 bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-teal-100 rounded-xl">
                        <Users className="h-5 w-5 text-teal-600" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-teal-900">{mentoredTeams.length}</div>
                        <div className="text-xs text-teal-700 font-medium">Total Teams</div>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-emerald-100 rounded-xl">
                        <CheckCircle className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-emerald-900">
                          {mentoredTeams.filter(t => t.abstractStatus !== 'rejected').length}
                        </div>
                        <div className="text-xs text-emerald-700 font-medium">Active Teams</div>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-blue-100 rounded-xl">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-900">
                          {mentoredTeams.filter(t => t.abstractStatus === 'approved').length}
                        </div>
                        <div className="text-xs text-blue-700 font-medium">Approved</div>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-amber-100 rounded-xl">
                        <Clock className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-amber-900">
                          {mentoredTeams.filter(t => t.abstractStatus === 'pending' || !t.abstractStatus).length}
                        </div>
                        <div className="text-xs text-amber-700 font-medium">Pending</div>
                      </div>
                    </div>
                  </Card>
                </div>
                <Card className="p-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveTab('teams')}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold mb-1">View All Mentor Teams</h3>
                      <p className="text-xs opacity-90">Click to see detailed team information and manage submissions</p>
                    </div>
                    <Users className="h-6 w-6 opacity-80" />
                  </div>
                </Card>
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
                <GraduationCap className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-gray-700 mb-1">No Mentored Teams</h3>
                <p className="text-xs text-gray-500">You are not currently mentoring any teams.</p>
              </div>
            )}
          </TabsContent>

          {/* Panel Teams Tab */}
          <TabsContent value="panel" className="mt-4">
            {teamsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(i => (
                  <Card key={i} className="p-4">
                    <Skeleton className="h-12 w-12 rounded-xl mb-2" />
                    <Skeleton className="h-6 w-16 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </Card>
                ))}
              </div>
            ) : panelTeams.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-purple-100 rounded-xl">
                        <Shield className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-purple-900">{panelTeams.length}</div>
                        <div className="text-xs text-purple-700 font-medium">Total Teams</div>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-violet-100 rounded-xl">
                        <CheckCircle className="h-5 w-5 text-violet-600" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-violet-900">
                          {panelTeams.filter(t => t.abstractStatus !== 'rejected').length}
                        </div>
                        <div className="text-xs text-violet-700 font-medium">Active Teams</div>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 bg-gradient-to-br from-fuchsia-50 to-pink-50 border-fuchsia-200">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-fuchsia-100 rounded-xl">
                        <FileText className="h-5 w-5 text-fuchsia-600" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-fuchsia-900">
                          {panelTeams.filter(t => t.panelId).length}
                        </div>
                        <div className="text-xs text-fuchsia-700 font-medium">Assigned</div>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 bg-gradient-to-br from-rose-50 to-red-50 border-rose-200">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-rose-100 rounded-xl">
                        <Clock className="h-5 w-5 text-rose-600" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-rose-900">
                          {panelTeams.filter(t => t.abstractStatus === 'pending' || !t.abstractStatus).length}
                        </div>
                        <div className="text-xs text-rose-700 font-medium">Pending</div>
                      </div>
                    </div>
                  </Card>
                </div>
                {panelInfo && (
                  <Card className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-100 rounded-xl">
                          <Layers className="h-6 w-6 text-indigo-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-indigo-900">Panel {panelInfo.panelNumber}</h3>
                          <p className="text-xs text-indigo-700">{panelInfo.facultyCount} faculty members • {panelTeams.length} teams assigned</p>
                        </div>
                      </div>
                      <Badge className="bg-indigo-600 text-white border-0">Active</Badge>
                    </div>
                  </Card>
                )}
                <Card className="p-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveTab('teams')}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold mb-1">View All Panel Teams</h3>
                      <p className="text-xs opacity-90">Click to see detailed team information and evaluate submissions</p>
                    </div>
                    <Shield className="h-6 w-6 opacity-80" />
                  </div>
                </Card>
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
                <Shield className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-gray-700 mb-1">No Panel Teams</h3>
                <p className="text-xs text-gray-500">You are not assigned to evaluate any panel teams.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Quick Actions Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <Card
          className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 cursor-pointer hover:shadow-md transition-shadow group"
          onClick={() => setActiveTab('requests')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl group-hover:scale-110 transition-transform">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-blue-900">Requests</div>
              {stats.pendingRequests > 0 && (
                <Badge className="bg-amber-500 text-white text-xs mt-1">{stats.pendingRequests} pending</Badge>
              )}
            </div>
          </div>
        </Card>

        <Card
          className="p-4 bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-200 cursor-pointer hover:shadow-md transition-shadow group"
          onClick={() => setActiveTab('teams')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 rounded-xl group-hover:scale-110 transition-transform">
              <Users className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-teal-900">All Teams</div>
              <div className="text-xs text-teal-700">
                {mentoredTeams.length} mentored • {panelTeams.length} panel
              </div>
            </div>
          </div>
        </Card>

        <Card
          className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 cursor-pointer hover:shadow-md transition-shadow group"
          onClick={() => setActiveTab('abstracts')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-xl group-hover:scale-110 transition-transform">
              <FileText className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-purple-900">Abstracts</div>
              {stats.pendingAbstracts > 0 && (
                <Badge className="bg-blue-500 text-white text-xs mt-1">{stats.pendingAbstracts} pending</Badge>
              )}
            </div>
          </div>
        </Card>

        <Card
          className="p-4 bg-gradient-to-br from-violet-50 to-indigo-50 border-violet-200 cursor-pointer hover:shadow-md transition-shadow group"
          onClick={() => setActiveTab('phases')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-xl group-hover:scale-110 transition-transform">
              <CalendarCheck className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-violet-900">Phases</div>
              <div className="text-xs text-violet-700">Evaluations</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// Helper function for greeting
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

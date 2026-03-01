"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSession } from '@/context/SessionContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Search, GraduationCap, FileText, CheckCircle, XCircle, Clock, AlertTriangle, Filter } from 'lucide-react';
import { toast } from 'sonner';
import UserProfileDialog from '@/components/dashboard/shared/UserProfileDialog';

import { logger } from "../../../lib/logger";
export default function TeamsListView() {
  const router = useRouter();
  const { userData } = useAuth();
  const { activeSession } = useSession();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [profileDialog, setProfileDialog] = useState({ isOpen: false, email: null, name: null });

  // Fetch mentored teams and panel-assigned teams
  useEffect(() => {
    if (!userData?.uid || !activeSession?.id) return;

    let unsubscribePanel = null; // Track panel listener for cleanup

    const teamsRef = collection(db, 'teams');

    // Query 1: Mentored teams (using email as primary identifier)
    const mentoredQuery = query(
      teamsRef,
      where('sessionId', '==', activeSession.id),
      where('mentorEmail', '==', userData.email)
    );

    // Subscribe to mentored teams
    const unsubscribeMentored = onSnapshot(mentoredQuery, async (snapshot) => {
      const mentoredTeams = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        isMentored: true
      }));

      // Collect all unique emails for batch lookup
      const emailsToFetch = new Set();
      mentoredTeams.forEach(team => {
        if (team.leaderEmail) emailsToFetch.add(team.leaderEmail);
        if (team.mentorEmail && team.mentorEmail !== userData.email) {
          emailsToFetch.add(team.mentorEmail);
        }
      });

      // Batch fetch all user data in parallel
      const emailsArray = Array.from(emailsToFetch);
      const userPromises = emailsArray.map(email =>
        getDoc(doc(db, 'users', email)).catch(() => null)
      );
      const userSnapshots = await Promise.all(userPromises);

      // Build email -> name map
      const userNameMap = {};
      emailsArray.forEach((email, i) => {
        if (userSnapshots[i]?.exists()) {
          userNameMap[email] = userSnapshots[i].data().name;
        }
      });

      // Apply user names to teams
      mentoredTeams.forEach(team => {
        if (team.leaderEmail && userNameMap[team.leaderEmail]) {
          team.leaderName = userNameMap[team.leaderEmail];
        }
        if (team.mentorEmail === userData.email || team.mentorId === userData.uid) {
          team.mentorName = userData.name || 'You';
        } else if (team.mentorEmail && userNameMap[team.mentorEmail]) {
          team.mentorName = userNameMap[team.mentorEmail];
        }
        // Use abstractStatus as initial status (skip expensive submissions query for listing)
        team.submissionStatus = team.abstractStatus || 'not_submitted';
      });

      // Fetch panel-assigned teams (pass unsubscribePanel reference)
      const newUnsubscribePanel = await fetchPanelTeams(mentoredTeams);
      if (newUnsubscribePanel) {
        // Clean up previous panel listener if it exists
        if (unsubscribePanel) {
          unsubscribePanel();
        }
        unsubscribePanel = newUnsubscribePanel;
      }
    }, (error) => {
      // Handle permission errors gracefully during logout
      if (error.code === 'permission-denied') {
        setLoading(false);
      } else {
        logger.error('Error fetching mentored teams:', error);
        toast.error('Failed to load teams');
        setLoading(false);
      }
    });

    return () => {
      unsubscribeMentored();
      if (unsubscribePanel) {
        unsubscribePanel();
      }
    };
  }, [userData?.uid, activeSession?.id]);

  // Fetch panel-assigned teams
  const fetchPanelTeams = async (mentoredTeams) => {
    if (!userData?.uid || !activeSession?.id) return;

    try {

      // Find panels where faculty is a member
      const panelsRef = collection(db, 'panels');
      const panelsQuery = query(
        panelsRef,
        where('sessionId', '==', activeSession.id)
      );

      const panelsSnapshot = await getDocs(panelsQuery);
      const facultyPanels = [];

      panelsSnapshot.forEach(docSnap => {
        const panelData = docSnap.data();
        panelData.facultyMembers?.forEach(m => {
        });

        // Check both UID and email for data consistency (some panels store email as uid)
        const isMember = panelData.facultyMembers?.some(
          member => member.uid === userData.uid ||
            member.uid === userData.email ||
            member.email === userData.email
        );
        if (isMember) {
          facultyPanels.push(docSnap.id);
        }
      });


      if (facultyPanels.length === 0) {
        setTeams(mentoredTeams);
        setLoading(false);
        return;
      }

      // Fetch teams assigned to these panels (excluding already mentored teams)
      const mentoredTeamIds = mentoredTeams.map(t => t.id);
      const teamsRef = collection(db, 'teams');
      const panelTeamsQuery = query(
        teamsRef,
        where('sessionId', '==', activeSession.id),
        where('panelId', 'in', facultyPanels.slice(0, 10)) // Firestore 'in' limit
      );

      const unsubscribePanel = onSnapshot(panelTeamsQuery, async (snapshot) => {
        // First pass: collect all teams and mark duplicates
        const rawPanelTeams = [];
        snapshot.docs.forEach(docSnap => {
          const teamData = { id: docSnap.id, ...docSnap.data(), isPanelTeam: true };

          // Check if this team is also mentored (mark as both)
          if (mentoredTeamIds.includes(docSnap.id)) {
            const mentoredTeam = mentoredTeams.find(t => t.id === docSnap.id);
            if (mentoredTeam) {
              mentoredTeam.isPanelTeam = true;
              mentoredTeam.isBothMentorAndPanel = true;
            }
            return; // Don't add duplicate
          }
          rawPanelTeams.push(teamData);
        });

        // Collect all unique emails for batch lookup
        const emailsToFetch = new Set();
        rawPanelTeams.forEach(team => {
          if (team.leaderEmail) emailsToFetch.add(team.leaderEmail);
          if (team.mentorEmail) emailsToFetch.add(team.mentorEmail);
        });

        // Batch fetch all user data in parallel
        const emailsArray = Array.from(emailsToFetch);
        const userPromises = emailsArray.map(email =>
          getDoc(doc(db, 'users', email)).catch(() => null)
        );
        const userSnapshots = await Promise.all(userPromises);

        // Build email -> name map
        const userNameMap = {};
        emailsArray.forEach((email, i) => {
          if (userSnapshots[i]?.exists()) {
            userNameMap[email] = userSnapshots[i].data().name;
          }
        });

        // Apply user names and status to teams
        rawPanelTeams.forEach(team => {
          if (team.leaderEmail && userNameMap[team.leaderEmail]) {
            team.leaderName = userNameMap[team.leaderEmail];
          }
          if (team.mentorEmail && userNameMap[team.mentorEmail]) {
            team.mentorName = userNameMap[team.mentorEmail];
          }
          // Use abstractStatus as initial status (skip expensive submissions query for listing)
          team.submissionStatus = team.abstractStatus || 'not_submitted';
        });

        // Combine mentored and panel teams
        const allTeams = [...mentoredTeams, ...rawPanelTeams];
        setTeams(allTeams);
        setLoading(false);
      }, (error) => {
        // Handle permission errors gracefully during logout
        if (error.code === 'permission-denied') {
          setTeams(mentoredTeams);
          setLoading(false);
        } else {
          logger.error('Error fetching panel teams:', error);
          setTeams(mentoredTeams);
          setLoading(false);
        }
      });

      return unsubscribePanel;
    } catch (error) {
      logger.error('Error fetching panel teams:', error);
      setTeams(mentoredTeams);
      setLoading(false);
    }
  };

  // Filter teams by search term and filter type
  const filteredTeams = teams.filter(team => {
    // Apply type filter first
    if (filterType === 'mentor' && !team.isMentored) return false;
    if (filterType === 'panel' && !team.isPanelTeam) return false;
    if (filterType === 'both' && !team.isBothMentorAndPanel) return false;

    // Apply search filter
    if (!searchTerm) return true;

    const search = searchTerm.toLowerCase();
    return (
      team.projectNumber?.toString().includes(search) ||
      team.projectTitle?.toLowerCase().includes(search) ||
      team.leaderName?.toLowerCase().includes(search)
    );
  });

  // Get status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'evaluated':
        return {
          variant: 'default',
          icon: CheckCircle,
          text: 'Evaluated',
          className: 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-0 shadow-md'
        };
      case 'approved':
        return {
          variant: 'default',
          icon: CheckCircle,
          text: 'Approved',
          className: 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-0 shadow-md'
        };
      case 'rejected':
        return {
          variant: 'destructive',
          icon: XCircle,
          text: 'Rejected',
          className: 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white border-0 shadow-md'
        };
      case 'pending':
        return {
          variant: 'secondary',
          icon: Clock,
          text: 'Pending',
          className: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-md'
        };
      case 'under_review':
        return {
          variant: 'outline',
          icon: AlertTriangle,
          text: 'Under Review',
          className: 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white border-0 shadow-md'
        };
      case 'not_submitted':
        return {
          variant: 'secondary',
          icon: Clock,
          text: 'Not Submitted',
          className: 'bg-gradient-to-r from-gray-500 to-slate-500 hover:from-gray-600 hover:to-slate-600 text-white border-0 shadow-md'
        };
      default:
        return {
          variant: 'secondary',
          icon: Clock,
          text: 'Not Submitted',
          className: 'bg-gradient-to-r from-gray-500 to-slate-500 hover:from-gray-600 hover:to-slate-600 text-white border-0 shadow-md'
        };
    }
  };

  // Handle team click
  const handleTeamClick = (teamId) => {
    router.push(`/dashboard/teams/${teamId}`);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton-card h-24" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card-faculty p-4 animate-shimmer">
              <div className="flex items-center gap-3">
                <div className="skeleton-faculty w-10 h-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton-faculty h-4 w-32" />
                  <div className="skeleton-faculty h-3 w-48" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Separate teams by type
  const mentoredTeams = filteredTeams.filter(t => t.isMentored && !t.isPanelTeam);
  const panelOnlyTeams = filteredTeams.filter(t => t.isPanelTeam && !t.isMentored);
  const bothTeams = filteredTeams.filter(t => t.isBothMentorAndPanel);

  // Team card component
  const TeamCard = ({ team, type }) => {
    const statusInfo = getStatusBadge(team.submissionStatus || team.abstractStatus);
    const StatusIcon = statusInfo.icon;
    const statusColors = {
      evaluated: 'bg-green-50 text-green-700 border-green-200',
      approved: 'bg-green-50 text-green-700 border-green-200',
      rejected: 'bg-red-50 text-red-700 border-red-200',
      pending: 'bg-orange-50 text-orange-700 border-orange-200',
      under_review: 'bg-blue-50 text-blue-700 border-blue-200',
      not_submitted: 'bg-gray-50 text-gray-700 border-gray-200'
    };

    const indicatorColor = type === 'both'
      ? 'bg-gradient-to-b from-teal-500 to-purple-500'
      : type === 'mentored'
        ? 'bg-teal-500'
        : 'bg-purple-500';

    const iconBgColor = type === 'both'
      ? 'bg-gradient-to-br from-teal-50 to-purple-50 text-teal-600'
      : type === 'mentored'
        ? 'bg-teal-50 text-teal-600'
        : 'bg-purple-50 text-purple-600';

    return (
      <div
        onClick={() => handleTeamClick(team.id)}
        className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors cursor-pointer group"
      >
        <div className={`w-1 h-12 rounded-full ${indicatorColor}`} />
        <div className={`${iconBgColor} p-2 rounded-lg`}>
          <Users className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="text-sm font-semibold text-gray-900 truncate">
              Project #{team.projectNumber}
            </h4>
            {type === 'both' && (
              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 px-1.5 py-0">
                Both
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="truncate max-w-[200px]">{team.projectTitle || 'No title'}</span>
            <span className="text-gray-400">•</span>
            <span
              className="truncate hover:underline cursor-pointer hover:text-teal-600 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setProfileDialog({ isOpen: true, email: team.leaderEmail, name: team.leaderName });
              }}
            >{team.leaderName}</span>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <GraduationCap className="h-3 w-3 text-gray-400" />
            <span>{team.members?.length || 0} members</span>
          </div>
          {type === 'panel' && team.mentorName && (
            <div className="flex items-center gap-1 text-purple-600">
              <Users className="h-3 w-3" />
              <span
                className="truncate max-w-[100px] hover:underline cursor-pointer hover:text-purple-800 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setProfileDialog({ isOpen: true, email: team.mentorEmail, name: team.mentorName });
                }}
              >{team.mentorName}</span>
            </div>
          )}
        </div>
        <Badge className={`${statusColors[team.submissionStatus || team.abstractStatus] || 'bg-gray-50 text-gray-700'} border text-[10px] h-5 px-2 shrink-0`}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {statusInfo.text}
        </Badge>
      </div>
    );
  };

  // Section component
  const TeamSection = ({ title, teams, type, color, emptyMessage }) => {
    if (teams.length === 0) return null;

    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className={`px-3 py-2 border-b ${type === 'mentored' ? 'bg-teal-50 border-teal-100' :
          type === 'panel' ? 'bg-purple-50 border-purple-100' :
            'bg-gradient-to-r from-teal-50 to-purple-50 border-amber-100'
          }`}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${color}`} />
            <span className={`text-sm font-medium ${type === 'mentored' ? 'text-teal-700' :
              type === 'panel' ? 'text-purple-700' :
                'text-amber-700'
              }`}>
              {title}
            </span>
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {teams.length}
            </Badge>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {teams.map(team => (
            <TeamCard key={team.id} team={team} type={type} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Compact Header with Inline Search */}
      <div className="card-faculty-elevated p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-teal-500 to-emerald-500 p-2.5 rounded-xl text-white shadow-md">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">All Teams</h1>
              <p className="text-sm text-gray-500">{teams.length} teams assigned to you</p>
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-teal-500"></div>
              <span className="text-gray-600">Mentored ({mentoredTeams.length + bothTeams.length})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span className="text-gray-600">Panel ({panelOnlyTeams.length + bothTeams.length})</span>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search teams, projects, leaders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 text-sm border-gray-200 focus:border-teal-400 focus:ring-teal-400 rounded-xl"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[160px] h-10 text-sm border-gray-200 rounded-xl">
              <Filter className="h-4 w-4 mr-2 text-gray-400" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              <SelectItem value="mentor">Mentor Teams</SelectItem>
              <SelectItem value="panel">Panel Teams</SelectItem>
              <SelectItem value="both">Both (Mentor & Panel)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Teams by Section */}
      {filteredTeams.length === 0 ? (
        <div className="empty-state py-12">
          <div className="empty-state-icon">
            <Users className="h-8 w-8" />
          </div>
          <h2 className="empty-state-title">
            {searchTerm ? 'No teams found' : 'No teams assigned'}
          </h2>
          <p className="empty-state-text">
            {searchTerm
              ? 'Try a different search term'
              : 'Teams will appear here when you are assigned as mentor or panel member'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Mentored Teams Section */}
          <TeamSection
            title="Mentored Teams"
            teams={mentoredTeams}
            type="mentored"
            color="bg-teal-500"
            emptyMessage="You are not mentoring any teams"
          />

          {/* Panel Teams Section */}
          <TeamSection
            title="Panel Teams"
            teams={panelOnlyTeams}
            type="panel"
            color="bg-purple-500"
            emptyMessage="You are not assigned to any panel"
          />

          {/* Both (Mentored + Panel) Section */}
          <TeamSection
            title="Mentored & Panel Teams"
            teams={bothTeams}
            type="both"
            color="bg-gradient-to-r from-teal-500 to-purple-500"
            emptyMessage=""
          />
        </div>
      )}

      {/* Compact Summary Bar */}
      {filteredTeams.length > 0 && (
        <div className="flex items-center gap-4 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-500"></div>
            <span className="font-semibold text-gray-700">{mentoredTeams.length}</span>
            <span className="text-gray-600">mentored only</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
            <span className="font-semibold text-gray-700">{panelOnlyTeams.length}</span>
            <span className="text-gray-600">panel only</span>
          </div>
          {bothTeams.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-teal-500 to-purple-500"></div>
              <span className="font-semibold text-gray-700">{bothTeams.length}</span>
              <span className="text-gray-600">both</span>
            </div>
          )}
          {searchTerm && (
            <>
              <div className="w-px h-3 bg-gray-300" />
              <div className="flex items-center gap-1.5">
                <Search className="h-3 w-3 text-gray-400" />
                <span className="font-semibold text-gray-700">{filteredTeams.length}</span>
                <span className="text-gray-600">results</span>
              </div>
            </>
          )}
        </div>
      )}
      <UserProfileDialog
        isOpen={profileDialog.isOpen}
        onClose={() => setProfileDialog(prev => ({ ...prev, isOpen: false }))}
        email={profileDialog.email}
        name={profileDialog.name}
      />
    </div>
  );
}

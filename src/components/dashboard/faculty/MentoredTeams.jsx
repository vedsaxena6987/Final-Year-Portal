// src/components/dashboard/faculty/MentoredTeams.jsx - Enhanced Modern UI
"use client";

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import {
  Users,
  FileText,
  TrendingUp,
  Award,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  Eye,
  BookOpen,
  Target,
  Mail,
  Phone,
  Calendar,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Star,
  History
} from 'lucide-react';
import { RevisionHistoryDialog } from '../shared/RevisionHistory';

import { logger } from "../../../lib/logger";
const statusConfig = {
  pending: {
    color: "bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 border-orange-300",
    badgeGradient: "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-md",
    icon: Clock,
    label: "Pending Review"
  },
  approved: {
    color: "bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-300",
    badgeGradient: "bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-md",
    icon: CheckCircle2,
    label: "Approved"
  },
  revisions_requested: {
    color: "bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-800 border-blue-300",
    badgeGradient: "bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0 shadow-md",
    icon: AlertCircle,
    label: "Needs Revision"
  },
  rejected: {
    color: "bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border-red-300",
    badgeGradient: "bg-gradient-to-r from-red-500 to-rose-500 text-white border-0 shadow-md",
    icon: AlertCircle,
    label: "Rejected"
  }
};

export default function MentoredTeams() {
  const { userData } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (!userData?.email) return;


    const q = query(
      collection(db, "teams"),
      where("mentorEmail", "==", userData.email)
    );

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const teamsList = await Promise.all(
        querySnapshot.docs.map(async (teamDoc) => {
          const teamData = { id: teamDoc.id, ...teamDoc.data() };

          // Fetch team members details
          if (teamData.members && Array.isArray(teamData.members)) {
            const memberDetails = await Promise.all(
              teamData.members.map(async (memberEmail) => {
                try {
                  const userDoc = await getDoc(doc(db, "users", memberEmail));
                  if (userDoc.exists()) {
                    return { email: memberEmail, ...userDoc.data() };
                  }
                  return { email: memberEmail, name: memberEmail.split('@')[0] };
                } catch (error) {
                  logger.error("Error fetching member details:", error);
                  return { email: memberEmail, name: memberEmail.split('@')[0] };
                }
              })
            );
            teamData.memberDetails = memberDetails;
          }

          return teamData;
        })
      );

      setTeams(teamsList);
      setLoading(false);
    }, (error) => {
      // Handle permission errors gracefully during logout
      if (error.code === 'permission-denied') {
        setTeams([]);
        setLoading(false);
      } else {
        logger.error('Error fetching mentored teams:', error);
        setTeams([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [userData?.uid]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton-card h-20" />
        <div className="card-faculty overflow-hidden">
          <div className="h-10 skeleton-faculty" />
          <div className="space-y-0">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-4 animate-shimmer border-b border-gray-100">
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
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="card-faculty-elevated p-8">
        <div className="empty-state">
          <div className="empty-state-icon mb-4" style={{ width: '5rem', height: '5rem' }}>
            <Users className="h-10 w-10" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Teams to Mentor</h3>
          <p className="text-gray-600 max-w-sm text-center">
            Once you approve mentorship requests, teams will appear here for you to guide.
          </p>
        </div>
      </div>
    );
  }

  const activeTeams = teams.filter(t => t.abstractStatus !== 'rejected' && t.mentorStatus === 'approved');
  const completedTeams = teams.filter(t => t.abstractStatus === 'approved');
  const pendingTeams = teams.filter(t => t.abstractStatus === 'pending' || t.abstractStatus === 'revisions_requested');

  const getFilteredTeams = () => {
    switch (activeTab) {
      case "active":
        return activeTeams;
      case "completed":
        return completedTeams;
      case "pending":
        return pendingTeams;
      default:
        return teams;
    }
  };

  return (
    <div className="space-y-3">
      {/* Compact Summary Bar */}
      <div className="card-faculty-elevated p-4">
        <div className="grid-responsive-4">
          <div className="flex items-center gap-3 animate-fade-in-up stagger-1">
            <div className="bg-teal-50 text-teal-600 p-2.5 rounded-xl">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="metric-value text-2xl font-bold text-gray-900">{teams.length}</div>
              <div className="metric-label">Total</div>
            </div>
          </div>
          <div className="flex items-center gap-3 animate-fade-in-up stagger-2">
            <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="metric-value text-2xl font-bold text-gray-900">{activeTeams.length}</div>
              <div className="metric-label">Active</div>
            </div>
          </div>
          <div className="flex items-center gap-3 animate-fade-in-up stagger-3">
            <div className="bg-violet-50 text-violet-600 p-2.5 rounded-xl">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <div className="metric-value text-2xl font-bold text-gray-900">{completedTeams.length}</div>
              <div className="metric-label">Completed</div>
            </div>
          </div>
          <div className="flex items-center gap-3 animate-fade-in-up stagger-4">
            <div className="bg-amber-50 text-amber-600 p-2.5 rounded-xl">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="metric-value text-2xl font-bold text-gray-900">{pendingTeams.length}</div>
              <div className="metric-label">Pending</div>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Teams List with Tabs */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start h-10 bg-gray-50 border-b border-gray-200 rounded-none p-0">
            <TabsTrigger
              value="all"
              className="h-10 text-xs px-4 rounded-none data-[state=active]:bg-white data-[state=active]:text-teal-700 data-[state=active]:border-b-2 data-[state=active]:border-teal-600"
            >
              All ({teams.length})
            </TabsTrigger>
            <TabsTrigger
              value="active"
              className="h-10 text-xs px-4 rounded-none data-[state=active]:bg-white data-[state=active]:text-green-700 data-[state=active]:border-b-2 data-[state=active]:border-green-600"
            >
              Active ({activeTeams.length})
            </TabsTrigger>
            <TabsTrigger
              value="completed"
              className="h-10 text-xs px-4 rounded-none data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:border-b-2 data-[state=active]:border-purple-600"
            >
              Completed ({completedTeams.length})
            </TabsTrigger>
            <TabsTrigger
              value="pending"
              className="h-10 text-xs px-4 rounded-none data-[state=active]:bg-white data-[state=active]:text-orange-700 data-[state=active]:border-b-2 data-[state=active]:border-orange-600"
            >
              Pending ({pendingTeams.length})
            </TabsTrigger>
          </TabsList>

          {/* Compact Team Rows */}
          <div className="divide-y divide-gray-100">
            {getFilteredTeams().map((team) => (
              <TeamRowCompact key={team.id} team={team} />
            ))}
          </div>
        </Tabs>
      </div>
    </div>
  );
}

// Compact Team Row Component
function TeamRowCompact({ team }) {
  const [expanded, setExpanded] = useState(false);
  const status = statusConfig[team.abstractStatus] || statusConfig.pending;
  const StatusIcon = status.icon;

  const completionPercentage = team.completionPercentage || 0;

  return (
    <div className="hover:bg-gray-50 transition-colors">
      {/* Main Row */}
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {/* Team Icon */}
        <div className="bg-teal-50 text-teal-600 p-2 rounded">
          <Users className="h-4 w-4" />
        </div>

        {/* Team Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="text-sm font-semibold text-gray-900 truncate">
              Project #{team.projectNumber}
            </h4>
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-gray-50">
              #{team.projectNumber}
            </Badge>
          </div>
          <p className="text-xs text-gray-600 truncate">
            {team.projectTitle || 'No project title'} • {team.memberDetails?.length || 0} members
          </p>
        </div>

        {/* Inline Metrics */}
        <div className="hidden lg:flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <Target className="h-3 w-3 text-gray-400" />
            <span className="text-gray-600">{completionPercentage}%</span>
          </div>
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3 text-gray-400" />
            <span className="text-gray-600">{team.submissionsCount || 0}</span>
          </div>
        </div>

        {/* Status Badge */}
        <Badge className={`${status.color} border text-[10px] h-5 px-2 shrink-0`}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {status.label}
        </Badge>

        {/* Expand Icon */}
        {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 bg-gray-50/50">
          {/* Progress Bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Progress value={completionPercentage} className="h-2" />
            </div>
            <span className="text-xs font-semibold text-teal-600">{completionPercentage}%</span>
          </div>

          {/* Team Members */}
          {team.memberDetails && team.memberDetails.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {team.memberDetails.map((member, index) => (
                <div key={index} className="flex items-center gap-1 bg-white border border-gray-200 rounded px-2 py-1">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[10px] bg-teal-100 text-teal-700">
                      {member.name ? member.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-gray-700">{member.name || member.email}</span>
                </div>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs">
              <Eye className="h-3 w-3 mr-1" />
              View Details
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs">
              <MessageSquare className="h-3 w-3 mr-1" />
              Message
            </Button>
            {team.abstractSubmittedAt && (
              <Button size="sm" variant="outline" className="h-7 text-xs">
                <Download className="h-3 w-3 mr-1" />
                Abstract
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

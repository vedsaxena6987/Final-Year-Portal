"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useSession } from '@/context/SessionContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FileText,
  ExternalLink,
  Calendar,
  CheckCircle,
  Clock,
  Search,
  Filter,
  Download,
  Eye,
  Users,
  Folder
} from 'lucide-react';
import { format } from 'date-fns';

import { logger } from "../../../lib/logger";
/**
 * AllSubmissionsView - Faculty view of all submissions
 * Shows submissions from mentored teams and panel teams
 */
export default function AllSubmissionsView() {
  const { user, userData } = useAuth();
  const { activeSession } = useSession();

  const [submissions, setSubmissions] = useState([]);
  const [phases, setPhases] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPhase, setSelectedPhase] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedTeamType, setSelectedTeamType] = useState('all'); // mentor, panel, all

  useEffect(() => {
    if (!user || !userData || !activeSession?.id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch phases
        const phasesSnapshot = await getDocs(
          query(
            collection(db, 'phases'),
            where('sessionId', '==', activeSession.id)
          )
        );
        const phasesData = phasesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setPhases(phasesData);

        // Get teams this faculty is related to
        const allTeams = [];

        // 1. Get mentored teams
        const mentoredTeamsSnapshot = await getDocs(
          query(
            collection(db, 'teams'),
            where('sessionId', '==', activeSession.id),
            where('mentorEmail', '==', user.email)
          )
        );

        mentoredTeamsSnapshot.forEach(doc => {
          allTeams.push({
            id: doc.id,
            ...doc.data(),
            relationshipType: 'mentor'
          });
        });

        // 2. Get panel teams
        const panelsSnapshot = await getDocs(
          query(
            collection(db, 'panels'),
            where('sessionId', '==', activeSession.id)
          )
        );

        let facultyPanel = null;
        panelsSnapshot.forEach(doc => {
          const panel = doc.data();
          // Check both UID and email for data consistency (some panels store email as uid)
          if (panel.facultyMembers?.some(f =>
            f.uid === user.uid ||
            f.uid === userData.email ||
            f.email === userData.email
          )) {
            facultyPanel = { id: doc.id, ...panel };
          }
        });

        if (facultyPanel) {
          const panelTeamsSnapshot = await getDocs(
            query(
              collection(db, 'teams'),
              where('sessionId', '==', activeSession.id),
              where('panelId', '==', facultyPanel.id)
            )
          );

          panelTeamsSnapshot.forEach(doc => {
            const teamData = { id: doc.id, ...doc.data() };
            // Check if not already added as mentor
            if (!allTeams.find(t => t.id === teamData.id)) {
              allTeams.push({
                ...teamData,
                relationshipType: 'panel'
              });
            } else {
              // If already added as mentor, mark as both
              const existingTeam = allTeams.find(t => t.id === teamData.id);
              existingTeam.relationshipType = 'both';
            }
          });
        }

        setTeams(allTeams);

        // Fetch submissions for all related teams
        const teamIds = allTeams.map(t => t.id);

        if (teamIds.length === 0) {
          setSubmissions([]);
          setLoading(false);
          return;
        }

        // Firestore 'in' query supports max 10 items, so we need to batch
        const submissionsData = [];
        const batchSize = 10;

        for (let i = 0; i < teamIds.length; i += batchSize) {
          const batchTeamIds = teamIds.slice(i, i + batchSize);
          const submissionsSnapshot = await getDocs(
            query(
              collection(db, 'submissions'),
              where('teamId', 'in', batchTeamIds)
            )
          );

          for (const docSnap of submissionsSnapshot.docs) {
            const subData = { id: docSnap.id, ...docSnap.data() };

            // Add team info
            const team = allTeams.find(t => t.id === subData.teamId);
            if (team) {
              subData.teamName = team.teamName;
              subData.projectNumber = team.projectNumber;
              subData.relationshipType = team.relationshipType;
            }

            // Ensure phase name is present
            if (!subData.phaseName && subData.phaseId) {
              const phase = phasesData.find(p => p.id === subData.phaseId);
              if (phase) {
                subData.phaseName = phase.phaseName || phase.name || 'Unknown Phase';
              }
            }

            submissionsData.push(subData);
          }
        }

        // Sort by submission date (newest first)
        submissionsData.sort((a, b) => {
          if (!a.submittedAt) return 1;
          if (!b.submittedAt) return -1;
          return b.submittedAt.toDate() - a.submittedAt.toDate();
        });

        setSubmissions(submissionsData);
      } catch (error) {
        logger.error('Error fetching submissions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, userData, activeSession]);

  // Filter submissions
  const filteredSubmissions = submissions.filter(submission => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        submission.teamName?.toLowerCase().includes(search) ||
        submission.phaseName?.toLowerCase().includes(search) ||
        submission.submissionTitle?.toLowerCase().includes(search) ||
        submission.projectNumber?.toString().includes(search);

      if (!matchesSearch) return false;
    }

    // Phase filter
    if (selectedPhase !== 'all' && submission.phaseId !== selectedPhase) {
      return false;
    }

    // Status filter
    if (selectedStatus !== 'all') {
      const status = submission.evaluationStatus || submission.status || 'pending';
      if (status !== selectedStatus) return false;
    }

    // Team type filter (mentor/panel)
    if (selectedTeamType !== 'all' && submission.relationshipType !== selectedTeamType) {
      return false;
    }

    return true;
  });

  // Get status badge
  const getStatusBadge = (submission) => {
    const status = submission.evaluationStatus || submission.status || 'pending';

    switch (status) {
      case 'evaluated':
        return { icon: CheckCircle, text: 'Evaluated', className: 'bg-green-500 text-white' };
      case 'awaiting_panelists':
        return { icon: Clock, text: 'Awaiting Panelists', className: 'bg-orange-500 text-white' };
      case 'pending':
        return { icon: Clock, text: 'Pending', className: 'bg-yellow-500 text-white' };
      case 'submitted':
        return { icon: CheckCircle, text: 'Submitted', className: 'bg-blue-500 text-white' };
      default:
        return { icon: Clock, text: status, className: 'bg-gray-500 text-white' };
    }
  };

  // Get relationship badge
  const getRelationshipBadge = (type) => {
    switch (type) {
      case 'mentor':
        return { text: 'Mentor', className: 'bg-purple-100 text-purple-700 border-purple-300' };
      case 'panel':
        return { text: 'Panel', className: 'bg-teal-100 text-teal-700 border-teal-300' };
      case 'both':
        return { text: 'Mentor & Panel', className: 'bg-indigo-100 text-indigo-700 border-indigo-300' };
      default:
        return { text: 'Unknown', className: 'bg-gray-100 text-gray-700 border-gray-300' };
    }
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
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Team Submissions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-600 font-medium">Total</p>
              <p className="text-2xl font-bold text-blue-900">{submissions.length}</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-sm text-orange-600 font-medium">Awaiting Panelists</p>
              <p className="text-2xl font-bold text-orange-900">
                {submissions.filter(s => s.evaluationStatus === 'awaiting_panelists').length}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-600 font-medium">Evaluated</p>
              <p className="text-2xl font-bold text-green-900">
                {submissions.filter(s => s.evaluationStatus === 'evaluated').length}
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-sm text-purple-600 font-medium">Teams</p>
              <p className="text-2xl font-bold text-purple-900">{teams.length}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search submissions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={selectedPhase} onValueChange={setSelectedPhase}>
              <SelectTrigger>
                <SelectValue placeholder="All Phases" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Phases</SelectItem>
                {phases.map(phase => (
                  <SelectItem key={phase.id} value={phase.id}>
                    {phase.phaseName || phase.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="awaiting_panelists">Awaiting Panelists</SelectItem>
                <SelectItem value="evaluated">Evaluated</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedTeamType} onValueChange={setSelectedTeamType}>
              <SelectTrigger>
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                <SelectItem value="mentor">Mentored Teams</SelectItem>
                <SelectItem value="panel">Panel Teams</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Submissions List */}
      {filteredSubmissions.length === 0 ? (
        <Alert>
          <AlertDescription className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">
              {searchTerm || selectedPhase !== 'all' || selectedStatus !== 'all'
                ? 'No submissions match your filters'
                : 'No submissions yet'}
            </p>
          </AlertDescription>
        </Alert>
      ) : (
        <ScrollArea className="h-[calc(100vh-400px)]">
          <div className="space-y-3 pr-4">
            {filteredSubmissions.map((submission) => {
              const statusBadge = getStatusBadge(submission);
              const relationshipBadge = getRelationshipBadge(submission.relationshipType);
              const StatusIcon = statusBadge.icon;

              return (
                <Card key={submission.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      {/* Left side - Info */}
                      <div className="flex-1 space-y-2">
                        {/* Title and badges */}
                        <div className="flex items-start gap-2 flex-wrap">
                          <h4 className="font-semibold text-gray-900">
                            {submission.submissionTitle || submission.phaseName || 'Submission'}
                          </h4>
                          <Badge className={statusBadge.className}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusBadge.text}
                          </Badge>
                          <Badge variant="outline" className={relationshipBadge.className}>
                            {relationshipBadge.text}
                          </Badge>
                        </div>

                        {/* Team and phase info */}
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span className="font-medium">{submission.teamName || 'Team'}</span>
                            {submission.projectNumber && (
                              <span className="text-gray-400">• Project {submission.projectNumber}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Folder className="h-4 w-4" />
                            <span>{submission.phaseName || 'Unknown Phase'}</span>
                          </div>
                        </div>

                        {/* Submission date */}
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="h-3 w-3" />
                          <span>
                            Submitted {submission.submittedAt
                              ? format(submission.submittedAt.toDate(), 'MMM dd, yyyy hh:mm a')
                              : 'Unknown date'}
                          </span>
                        </div>

                        {/* Notes preview */}
                        {submission.notes && (
                          <p className="text-sm text-gray-600 line-clamp-2">{submission.notes}</p>
                        )}
                      </div>

                      {/* Right side - Actions */}
                      <div className="flex flex-col gap-2">
                        {submission.fileUrls && submission.fileUrls.length > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(submission.fileUrls[0], '_blank')}
                            className="whitespace-nowrap"
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            View Files
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => window.location.href = `/dashboard/teams/${submission.teamId}?tab=submissions`}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

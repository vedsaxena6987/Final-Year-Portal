"use client";

import { useState, useEffect } from 'react';
import { useSession } from '@/context/SessionContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trophy, TrendingUp, Award, Search, X, Filter } from 'lucide-react';
import { format } from 'date-fns';

import { logger } from "../../../lib/logger";
export default function TeamMarksTab({ teamId, teamMembers }) {
  const { activeSession } = useSession();
  const [evaluations, setEvaluations] = useState([]);
  const [phases, setPhases] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhase, setSelectedPhase] = useState('all');
  const [selectedMember, setSelectedMember] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [percentageFilter, setPercentageFilter] = useState('all'); // all, passing, failing

  // Fetch members, phases, and evaluations
  useEffect(() => {
    const fetchData = async () => {
      if (!teamId || !activeSession?.id) return;

      try {
        // Fetch member details
        const memberPromises = teamMembers.map(async (email) => {
          const userRef = doc(db, 'users', email);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            return { email, ...userSnap.data() };
          }
          return { email, name: 'Unknown' };
        });
        const membersData = await Promise.all(memberPromises);
        setMembers(membersData);

        // Fetch phases
        const phasesRef = collection(db, 'phases');
        const phasesQuery = query(
          phasesRef,
          where('sessionId', '==', activeSession.id)
        );
        const phasesSnapshot = await getDocs(phasesQuery);
        const phasesData = phasesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setPhases(phasesData);

        // Fetch evaluations for this team
        const evaluationsRef = collection(db, 'evaluations');
        const evaluationsQuery = query(
          evaluationsRef,
          where('teamId', '==', teamId)
        );
        const evaluationsSnapshot = await getDocs(evaluationsQuery);

        const evaluationsData = [];
        for (const docSnap of evaluationsSnapshot.docs) {
          const evalData = { id: docSnap.id, ...docSnap.data() };

          // Fetch phase details
          if (evalData.phaseId) {
            const phaseRef = doc(db, 'phases', evalData.phaseId);
            const phaseSnap = await getDoc(phaseRef);
            if (phaseSnap.exists()) {
              evalData.phaseName = phaseSnap.data().name;
              evalData.maxMarks = phaseSnap.data().maxMarks;
            }
          }

          // Fetch evaluator details
          if (evalData.evaluatedBy) {
            const evaluatorRef = doc(db, 'users', evalData.evaluatedBy);
            const evaluatorSnap = await getDoc(evaluatorRef);
            if (evaluatorSnap.exists()) {
              evalData.evaluatorName = evaluatorSnap.data().name;
            }
          }

          evaluationsData.push(evalData);
        }

        setEvaluations(evaluationsData);
      } catch (error) {
        logger.error('Error fetching marks:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [teamId, teamMembers, activeSession?.id]);

  // Filter evaluations with search
  const filteredEvaluations = evaluations.filter(evaluation => {
    // Phase filter
    if (selectedPhase !== 'all' && evaluation.phaseId !== selectedPhase) return false;

    // Member filter
    if (selectedMember !== 'all') {
      const memberMarks = evaluation.marks?.find(m => m.studentEmail === selectedMember);
      if (!memberMarks) return false;
    }

    // Search filter (search by phase name, student name, or evaluator name)
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const phaseMatch = evaluation.phaseName?.toLowerCase().includes(search);
      const evaluatorMatch = evaluation.evaluatorName?.toLowerCase().includes(search);
      const studentMatch = evaluation.marks?.some(mark => {
        const member = members.find(m => m.email === mark.studentEmail);
        return member?.name?.toLowerCase().includes(search);
      });

      if (!phaseMatch && !evaluatorMatch && !studentMatch) return false;
    }

    // Percentage filter
    if (percentageFilter !== 'all') {
      const hasMatchingPercentage = evaluation.marks?.some(mark => {
        const percentage = (mark.marks / evaluation.maxMarks) * 100;
        if (percentageFilter === 'passing' && percentage < 60) return false;
        if (percentageFilter === 'failing' && percentage >= 60) return false;
        return true;
      });

      if (!hasMatchingPercentage) return false;
    }

    return true;
  });

  // Clear all filters
  const clearFilters = () => {
    setSelectedPhase('all');
    setSelectedMember('all');
    setSearchTerm('');
    setPercentageFilter('all');
  };

  // Check if any filters are active
  const hasActiveFilters = selectedPhase !== 'all' ||
    selectedMember !== 'all' ||
    searchTerm !== '' ||
    percentageFilter !== 'all';

  // Calculate statistics
  const calculateStats = () => {
    if (evaluations.length === 0) return null;

    const stats = {
      totalEvaluations: evaluations.length,
      averagePercentage: 0,
      highestMark: 0,
      memberAverages: {}
    };

    let totalPercentage = 0;
    let totalCount = 0;

    evaluations.forEach(evaluation => {
      evaluation.marks?.forEach(mark => {
        const percentage = (mark.marks / evaluation.maxMarks) * 100;
        totalPercentage += percentage;
        totalCount++;

        if (mark.marks > stats.highestMark) {
          stats.highestMark = mark.marks;
        }

        // Calculate per-member average
        if (!stats.memberAverages[mark.studentEmail]) {
          stats.memberAverages[mark.studentEmail] = {
            total: 0,
            count: 0,
            name: members.find(m => m.email === mark.studentEmail)?.name || 'Unknown'
          };
        }
        stats.memberAverages[mark.studentEmail].total += percentage;
        stats.memberAverages[mark.studentEmail].count++;
      });
    });

    stats.averagePercentage = totalCount > 0 ? (totalPercentage / totalCount).toFixed(2) : 0;

    // Calculate final member averages
    Object.keys(stats.memberAverages).forEach(email => {
      const member = stats.memberAverages[email];
      member.average = (member.total / member.count).toFixed(2);
    });

    return stats;
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid-responsive-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card-stat animate-shimmer">
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
        <div className="skeleton-card h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Statistics Cards */}
      {stats && (
        <div className="grid-responsive-3">
          <div className="card-stat group animate-fade-in-up stagger-1">
            <div className="flex items-center gap-3">
              <div className="bg-teal-50 text-teal-600 p-2.5 rounded-xl transition-transform group-hover:scale-110">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <div className="metric-value text-2xl font-bold text-gray-900">{stats.totalEvaluations}</div>
                <div className="metric-label">Evaluations</div>
              </div>
            </div>
          </div>

          <div className="card-stat group animate-fade-in-up stagger-2">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl transition-transform group-hover:scale-110">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <div className="metric-value text-2xl font-bold text-gray-900">{stats.averagePercentage}%</div>
                <div className="metric-label">Average</div>
              </div>
            </div>
          </div>

          <div className="card-stat group animate-fade-in-up stagger-3">
            <div className="flex items-center gap-3">
              <div className="bg-amber-50 text-amber-600 p-2.5 rounded-xl transition-transform group-hover:scale-110">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <div className="metric-value text-2xl font-bold text-gray-900">{stats.highestMark}</div>
                <div className="metric-label">Highest</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <Card className="border-teal-200">
        <CardContent className="p-3 space-y-3">
          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by phase, student, or evaluator name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {hasActiveFilters && (
              <Button onClick={clearFilters} variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Phase</label>
              <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                <SelectTrigger>
                  <SelectValue placeholder="All Phases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Phases</SelectItem>
                  {phases.map(phase => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Student</label>
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger>
                  <SelectValue placeholder="All Students" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  {members.map(member => (
                    <SelectItem key={member.email} value={member.email}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Performance</label>
              <Select value={percentageFilter} onValueChange={setPercentageFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Scores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Scores</SelectItem>
                  <SelectItem value="passing">Passing (≥60%)</SelectItem>
                  <SelectItem value="failing">Failing (&lt;60%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              {selectedPhase !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  Phase: {phases.find(p => p.id === selectedPhase)?.name}
                  <button onClick={() => setSelectedPhase('all')} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedMember !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  Student: {members.find(m => m.email === selectedMember)?.name}
                  <button onClick={() => setSelectedMember('all')} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {percentageFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {percentageFilter === 'passing' ? 'Passing' : 'Failing'}
                  <button onClick={() => setPercentageFilter('all')} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {searchTerm && (
                <Badge variant="secondary" className="gap-1">
                  Search: {searchTerm}
                  <button onClick={() => setSearchTerm('')} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Marks Table */}
      <Card className="border-teal-200">
        <CardContent className="p-4">
          {filteredEvaluations.length === 0 ? (
            <div className="empty-state py-12">
              <div className="empty-state-icon">
                <Trophy className="h-8 w-8" />
              </div>
              <h2 className="empty-state-title">
                {hasActiveFilters ? 'No matching evaluations' : 'No evaluations yet'}
              </h2>
              <p className="empty-state-text">
                {hasActiveFilters ? 'Try adjusting your filters' : 'Evaluations will appear here once graded'}
              </p>
              {hasActiveFilters && (
                <Button onClick={clearFilters} variant="outline" size="sm" className="mt-4">
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phase</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead className="text-right">Marks</TableHead>
                    <TableHead className="text-right">Max Marks</TableHead>
                    <TableHead className="text-right">Percentage</TableHead>
                    <TableHead>Evaluator</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvaluations.map(evaluation => (
                    evaluation.marks?.map((mark, idx) => {
                      const percentage = ((mark.marks / evaluation.maxMarks) * 100).toFixed(2);
                      const member = members.find(m => m.email === mark.studentEmail);

                      // Skip if filtering by specific member and this isn't them
                      if (selectedMember !== 'all' && mark.studentEmail !== selectedMember) {
                        return null;
                      }

                      return (
                        <TableRow key={`${evaluation.id}-${idx}`}>
                          <TableCell className="font-medium">{evaluation.phaseName}</TableCell>
                          <TableCell>{member?.name || 'Unknown'}</TableCell>
                          <TableCell className="text-right font-semibold">{mark.marks}</TableCell>
                          <TableCell className="text-right">{evaluation.maxMarks}</TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={percentage >= 60 ? 'default' : 'destructive'}
                              className={percentage >= 60 ? 'bg-green-600' : ''}
                            >
                              {percentage}%
                            </Badge>
                          </TableCell>
                          <TableCell>{evaluation.evaluatorName || 'Unknown'}</TableCell>
                          <TableCell>
                            {evaluation.evaluatedAt
                              ? format(evaluation.evaluatedAt.toDate(), 'MMM dd, yyyy')
                              : 'N/A'}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Member Averages */}
      {stats && Object.keys(stats.memberAverages).length > 0 && (
        <Card className="border-teal-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-teal-700 mb-3">Individual Student Averages</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(stats.memberAverages).map(([email, data]) => (
                <Card key={email} className="border-teal-200 hover:border-teal-400 transition-colors">
                  <CardContent className="p-3">
                    <p className="font-semibold text-sm mb-2">{data.name}</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-bold text-teal-600">{data.average}%</p>
                      <p className="text-xs text-muted-foreground">avg</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Based on {data.count} evaluation{data.count !== 1 ? 's' : ''}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

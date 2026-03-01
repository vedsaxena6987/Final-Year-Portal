// components/dashboard/admin/EnhancedAnalytics.jsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useSession } from '@/context/SessionContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import {
  Users,
  FileText,
  TrendingUp,
  AlertTriangle,
  Download,
  Target,
  GraduationCap,
  Briefcase,
  Activity,
  CheckCircle2,
  XCircle,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

import { logger } from "../../../lib/logger";
export default function EnhancedAnalytics() {
  const { activeSession } = useSession();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30days');
  const [analytics, setAnalytics] = useState({
    users: [],
    teams: [],
    submissions: [],
    evaluations: [],
    phases: [],
    panels: [],
    mentorshipRequests: [],
    panelEvaluations: [],
    grades: []
  });

  const COLORS = {
    primary: '#6366f1',   // Indigo 500
    secondary: '#8b5cf6', // Violet 500
    success: '#10b981',   // Emerald 500
    warning: '#f59e0b',   // Amber 500
    danger: '#ef4444',    // Red 500
    info: '#3b82f6',      // Blue 500
    slate: '#64748b'      // Slate 500
  };

  const PIE_COLORS = [COLORS.primary, COLORS.secondary, COLORS.success, COLORS.warning, COLORS.info];

  useEffect(() => {
    if (!activeSession?.id) return;

    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const [users, teams, submissions, evaluations, phases, panels, mentorshipRequests, panelEvaluations, grades] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('sessionId', '==', activeSession.id))),
          getDocs(query(collection(db, 'teams'), where('sessionId', '==', activeSession.id))),
          getDocs(query(collection(db, 'submissions'), where('sessionId', '==', activeSession.id))),
          getDocs(query(collection(db, 'evaluations'), where('sessionId', '==', activeSession.id))),
          getDocs(query(collection(db, 'phases'), where('sessionId', '==', activeSession.id))),
          getDocs(query(collection(db, 'panels'), where('sessionId', '==', activeSession.id))),
          getDocs(query(collection(db, 'mentorship_requests'), where('sessionId', '==', activeSession.id))),
          getDocs(query(collection(db, 'panelEvaluations'), where('sessionId', '==', activeSession.id))),
          getDocs(query(collection(db, 'grades'), where('sessionId', '==', activeSession.id)))
        ]);

        setAnalytics({
          users: users.docs.map(doc => ({ id: doc.id, ...doc.data() })),
          teams: teams.docs.map(doc => ({ id: doc.id, ...doc.data() })),
          submissions: submissions.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            submittedAt: doc.data().submittedAt?.toDate()
          })),
          evaluations: evaluations.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            evaluatedAt: doc.data().evaluatedAt?.toDate()
          })),
          phases: phases.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            deadline: doc.data().deadline?.toDate()
          })),
          panels: panels.docs.map(doc => ({ id: doc.id, ...doc.data() })),
          mentorshipRequests: mentorshipRequests.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate()
          })),
          panelEvaluations: panelEvaluations.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            submittedAt: doc.data().submittedAt?.toDate()
          })),
          grades: grades.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            evaluatedAt: doc.data().evaluatedAt?.toDate()
          }))
        });
      } catch (error) {
        logger.error('Error fetching analytics:', error);
        toast.error('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [activeSession?.id]);

  // --- Computed Analytics ---
  const stats = useMemo(() => {
    const { users, teams, submissions, evaluations, phases, panels, mentorshipRequests } = analytics;

    // 1. At Risk Teams Logic
    // Teams > 0 members AND (No Mentor OR (Active Phase Exists & No Submission & Deadline < 3 days))
    const activePhase = phases.find(p => p.isActive);
    const nearlyDue = activePhase?.deadline &&
      (activePhase.deadline - new Date()) / (1000 * 60 * 60 * 24) < 3;

    const atRiskTeams = teams.filter(team => {
      const hasMembers = team.members?.length > 0;
      if (!hasMembers) return false;

      const noMentor = !team.mentorId;

      const missingSubmission = activePhase && !submissions.some(s =>
        s.teamId === team.id && s.phaseId === activePhase.id
      );

      return noMentor || (missingSubmission && nearlyDue);
    });

    // 2. User Distribution
    const userRoleData = [
      { name: 'Students', value: users.filter(u => u.role === 'student').length },
      { name: 'Faculty', value: users.filter(u => u.role === 'faculty').length },
      { name: 'Admins', value: users.filter(u => u.role === 'admin').length },
    ].filter(d => d.value > 0);

    // 3. Submission Trends (Area Chart)
    // Filter by timeRange
    const now = new Date();
    const rangeDays = timeRange === '7days' ? 7 : timeRange === '30days' ? 30 : 90;
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - rangeDays);

    const dateMap = new Map();
    // Initialize dates
    for (let i = 0; i <= rangeDays; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      dateMap.set(key, 0);
    }

    submissions.forEach(sub => {
      if (sub.submittedAt && sub.submittedAt >= startDate) {
        const key = sub.submittedAt.toISOString().split('T')[0];
        if (dateMap.has(key)) {
          dateMap.set(key, dateMap.get(key) + 1);
        }
      }
    });

    const submissionTrendData = Array.from(dateMap.entries()).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      submissions: count
    }));

    // 4. Phase Performance (Bar Chart)
    const phasePerformanceData = phases.map(phase => {
      const phaseSubmissions = submissions.filter(s => s.phaseId === phase.id);
      const phaseEvaluations = evaluations.filter(e => e.phaseId === phase.id);

      // Avg Score calculation
      let totalScore = 0;
      let scoreCount = 0;
      phaseEvaluations.forEach(ev => {
        // Assuming ev.marks is array of student marks
        if (ev.marks?.length) {
          const validMarks = ev.marks.filter(m => !m.isAbsent && m.marks !== undefined);
          const avg = validMarks.reduce((acc, curr) => acc + (curr.marks || 0), 0) / (validMarks.length || 1);
          // Normalize to percentage if maxMarks
          const percentage = (avg / (ev.maxMarks || 100)) * 100;
          totalScore += percentage;
          scoreCount++;
        }
      });

      return {
        name: phase.name,
        submissionRate: (phaseSubmissions.length / (teams.filter(t => t.members?.length).length || 1)) * 100,
        avgScore: scoreCount ? totalScore / scoreCount : 0
      };
    });

    // 5. Recent Activity
    const allActivity = [
      ...submissions.map(s => ({ type: 'submission', date: s.submittedAt, data: s })),
      ...evaluations.map(e => ({ type: 'evaluation', date: e.evaluatedAt, data: e })),
      ...mentorshipRequests.map(m => ({ type: 'request', date: m.createdAt, data: m }))
    ]
      .filter(activity => activity.date != null)
      .sort((a, b) => b.date - a.date)
      .slice(0, 10);

    return {
      totals: {
        users: users.length,
        teams: teams.length,
        submissions: submissions.length,
        evaluations: evaluations.length,
        atRisk: atRiskTeams.length
      },
      userRoleData,
      submissionTrendData,
      phasePerformanceData,
      recentActivity: allActivity,
      atRiskTeamsList: atRiskTeams // For detailed view if needed
    };
  }, [analytics, timeRange]);

  const exportAnalytics = () => {
    try {
      const { users, teams, phases, panels, panelEvaluations, grades } = analytics;

      // Helper functions
      // Note: User docs are keyed by email, but mentorId/evaluatorId are UIDs
      const getUserByUid = (uid) => users.find(u => u.uid === uid || u.id === uid);
      const getUserByEmail = (email) => users.find(u => u.email === email || u.id === email);
      const getTeamById = (id) => teams.find(t => t.id === id);
      const getPhaseById = (id) => phases.find(p => p.id === id);
      const getPanelById = (id) => panels.find(p => p.id === id);

      // Sheet 1: Students
      const students = users.filter(u => u.role === 'student');
      const studentsData = students.map(student => {
        // members array contains email strings (not objects)
        const team = teams.find(t => 
          t.members?.includes(student.email) || 
          t.leaderEmail === student.email ||
          t.leaderId === student.uid
        );
        // Use mentorEmail directly if available, otherwise look up by mentorId (uid)
        const mentor = team?.mentorEmail 
          ? getUserByEmail(team.mentorEmail) 
          : (team?.mentorId ? getUserByUid(team.mentorId) : null);
        const panel = team?.panelId ? getPanelById(team.panelId) : null;

        return {
          'Student Name': student.name || '',
          'Email': student.email || '',
          'Roll Number': student.rollNumber || student.universityRoll || '',
          'Team Name': team?.name || team?.teamName || 'No Team',
          'Project Number': team?.projectNumber || '',
          'Project Title': team?.projectTitle || '',
          'Mentor Name': team?.mentorName || mentor?.name || 'Not Assigned',
          'Mentor Email': team?.mentorEmail || mentor?.email || '',
          'Panel Number': team?.panelNumber || (panel ? `Panel ${panel.panelNumber}` : 'Not Assigned'),
          'Status': student.status || 'Active'
        };
      });

      // Sheet 2: Teams
      const teamsData = teams.map(team => {
        const panel = team.panelId ? getPanelById(team.panelId) : null;
        // Members array contains email strings - look up names from users
        const memberDetails = (team.members || []).map(email => {
          const user = getUserByEmail(email);
          return user?.name || email;
        });
        const panelMemberNames = panel?.facultyMembers?.map(f => f.name).join(', ') || '';

        return {
          'Project Number': team.projectNumber || '',
          'Team Code': team.teamCode || '',
          'Team Name': team.name || team.teamName || '',
          'Project Title': team.projectTitle || '',
          'Description': team.description || '',
          'Leader Email': team.leaderEmail || '',
          'Leader Name': team.leaderName || '',
          'Members (Emails)': (team.members || []).join(', '),
          'Members (Names)': memberDetails.join(', '),
          'Member Count': team.memberCount || team.members?.length || 0,
          'Mentor Name': team.mentorName || 'Not Assigned',
          'Mentor Email': team.mentorEmail || '',
          'Panel Number': team.panelNumber || (panel ? panel.panelNumber : 'Not Assigned'),
          'Panel Members': panelMemberNames,
          'Status': team.status || 'Active',
          'Created At': team.createdAt?.toDate ? team.createdAt.toDate().toLocaleDateString() : (team.createdAt ? new Date(team.createdAt).toLocaleDateString() : '')
        };
      });

      // Sheet 3: Grades Summary
      const gradesData = grades.map(grade => {
        const team = getTeamById(grade.teamId);
        const phase = getPhaseById(grade.phaseId);
        const percentage = grade.maxMarks ? ((grade.marks / grade.maxMarks) * 100).toFixed(2) : '';

        return {
          'Student Name': grade.studentName || '',
          'Student Email': grade.studentEmail || '',
          'Team Name': team?.name || team?.teamName || grade.teamName || '',
          'Phase': phase?.phaseName || phase?.name || grade.phaseName || '',
          'Phase Type': phase?.phaseType || phase?.evaluatorRole || '',
          'Marks Obtained': grade.marks ?? '',
          'Max Marks': grade.maxMarks || '',
          'Percentage': percentage ? `${percentage}%` : '',
          'Status': grade.isAbsent ? 'Absent' : 'Present',
          'Evaluated By': grade.evaluatedBy || '',
          'Feedback': grade.feedback || '',
          'Evaluated At': grade.evaluatedAt ? grade.evaluatedAt.toLocaleDateString() : ''
        };
      });

      // Sheet 4: Panel Evaluations (detailed per-student marks from each panelist)
      const panelEvalsData = [];
      panelEvaluations.forEach(evaluation => {
        const team = getTeamById(evaluation.teamId);
        const phase = getPhaseById(evaluation.phaseId);
        // evaluatorId is a UID, look up by uid field
        const evaluator = getUserByUid(evaluation.evaluatorId) || getUserByEmail(evaluation.evaluatorEmail);

        // Each evaluation has marks array with individual student marks
        if (evaluation.marks && Array.isArray(evaluation.marks)) {
          evaluation.marks.forEach(studentMark => {
            panelEvalsData.push({
              'Team Name': team?.name || team?.teamName || '',
              'Project Title': team?.projectTitle || '',
              'Phase': phase?.phaseName || phase?.name || evaluation.phaseName || '',
              'Evaluator Name': evaluator?.name || '',
              'Evaluator Email': evaluator?.email || '',
              'Student Name': studentMark.studentName || '',
              'Student Email': studentMark.studentEmail || '',
              'Marks': studentMark.marks ?? '',
              'Max Marks': evaluation.maxMarks || '',
              'Attendance': studentMark.isAbsent || !studentMark.isPresent ? 'Absent' : 'Present',
              'Feedback': studentMark.feedback || evaluation.feedback || '',
              'Evaluated At': evaluation.submittedAt ? evaluation.submittedAt.toLocaleDateString() : ''
            });
          });
        }
      });

      // Sheet 5: Faculty
      const faculty = users.filter(u => u.role === 'faculty');
      const facultyData = faculty.map(f => {
        // mentorId in teams is stored as uid, not doc id (which is email)
        const mentoringTeams = teams.filter(t => t.mentorId === f.uid || t.mentorEmail === f.email);
        const panelMemberships = panels.filter(p =>
          p.facultyMembers?.some(fm => fm.uid === f.uid || fm.email === f.email)
        );

        return {
          'Name': f.name || '',
          'Email': f.email || '',
          'Department': f.department || '',
          'Designation': f.designation || '',
          'Teams Mentoring': mentoringTeams.length,
          'Teams (Names)': mentoringTeams.map(t => t.name || t.teamName).join(', '),
          'Panels Member Of': panelMemberships.length,
          'Panels (Names)': panelMemberships.map(p => p.name || p.panelName).join(', ')
        };
      });

      // Sheet 6: Session Summary
      const summaryData = [{
        'Session Name': activeSession?.name || activeSession?.sessionName || '',
        'Session ID': activeSession?.id || '',
        'Total Users': users.length,
        'Total Students': students.length,
        'Total Faculty': faculty.length,
        'Total Teams': teams.length,
        'Total Panels': panels.length,
        'Total Phases': phases.length,
        'Total Grades Recorded': grades.length,
        'Total Panel Evaluations': panelEvaluations.length,
        'Teams At Risk': stats.totals.atRisk,
        'Export Date': new Date().toLocaleString()
      }];

      // Create workbook with multiple sheets
      const wb = XLSX.utils.book_new();

      // Add sheets to workbook
      const wsStudents = XLSX.utils.json_to_sheet(studentsData);
      const wsTeams = XLSX.utils.json_to_sheet(teamsData);
      const wsGrades = XLSX.utils.json_to_sheet(gradesData);
      const wsPanelEvals = XLSX.utils.json_to_sheet(panelEvalsData.length > 0 ? panelEvalsData : [{ 'Note': 'No panel evaluations found' }]);
      const wsFaculty = XLSX.utils.json_to_sheet(facultyData);
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);

      // Set column widths for better readability
      const setColumnWidths = (ws, data, defaultWidth = 15) => {
        if (!data.length) return;
        const keys = Object.keys(data[0]);
        ws['!cols'] = keys.map(key => ({ wch: Math.max(key.length, defaultWidth) }));
      };

      setColumnWidths(wsStudents, studentsData);
      setColumnWidths(wsTeams, teamsData);
      setColumnWidths(wsGrades, gradesData);
      if (panelEvalsData.length > 0) setColumnWidths(wsPanelEvals, panelEvalsData);
      setColumnWidths(wsFaculty, facultyData);
      setColumnWidths(wsSummary, summaryData, 20);

      // Append sheets to workbook
      XLSX.utils.book_append_sheet(wb, wsStudents, 'Students');
      XLSX.utils.book_append_sheet(wb, wsTeams, 'Teams');
      XLSX.utils.book_append_sheet(wb, wsGrades, 'Grades');
      XLSX.utils.book_append_sheet(wb, wsPanelEvals, 'Panel Evaluations');
      XLSX.utils.book_append_sheet(wb, wsFaculty, 'Faculty');
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Session Summary');

      // Generate filename with session name and timestamp
      const sessionName = (activeSession?.name || activeSession?.sessionName || 'session').replace(/[^a-zA-Z0-9]/g, '_');
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${sessionName}_export_${timestamp}.xlsx`;

      // Write and download the file
      XLSX.writeFile(wb, filename);

      toast.success('Session data exported successfully to Excel');
    } catch (error) {
      logger.error('Error exporting analytics:', error);
      toast.error('Failed to export data. Please try again.');
    }
  };

  if (loading) {
    return <div className="p-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
      </div>
      <Skeleton className="h-[400px] w-full rounded-xl" />
    </div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Analytics Dashboard</h1>
          <p className="text-slate-500 mt-1">Analytics insights and performance metrics.</p>
        </div>

        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px] border-none shadow-none focus:ring-0">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="90days">Last 3 Months</SelectItem>
            </SelectContent>
          </Select>
          <div className="h-4 w-[1px] bg-slate-200" />
          <Button variant="ghost" size="sm" onClick={exportAnalytics} className="text-slate-600 hover:text-slate-900">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Users"
          value={stats.totals.users}
          trend="Current session total"
          trendUp={true}
          icon={Users}
          color="text-indigo-600"
          bg="bg-indigo-50"
        />
        <MetricCard
          title="Active Teams"
          value={stats.totals.teams}
          icon={Briefcase}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <MetricCard
          title="Total Submissions"
          value={stats.totals.submissions}
          trend="Across all phases"
          icon={FileText}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <MetricCard
          title="Teams At Risk"
          value={stats.totals.atRisk}
          trend={stats.totals.atRisk > 0 ? "Needs Attention" : "All Good"}
          trendUp={stats.totals.atRisk === 0}
          icon={AlertTriangle}
          color="text-rose-600"
          bg="bg-rose-50"
          highlight={stats.totals.atRisk > 0}
        />
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Col: Trends & Performance */}
        <div className="lg:col-span-2 space-y-6">
          {/* Submission Trend Area Chart */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-indigo-500" />
                Submission Activity
              </CardTitle>
              <CardDescription>Daily submission volume over the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.submissionTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSubmissions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      cursor={{ stroke: COLORS.primary, strokeWidth: 1, strokeDasharray: '5 5' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="submissions"
                      stroke={COLORS.primary}
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorSubmissions)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Phase Performance Bar Chart */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-500" />
                Phase Performance
              </CardTitle>
              <CardDescription>Submission rates vs Average scores per phase</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.phasePerformanceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                    <YAxis yAxisId="left" orientation="left" stroke={COLORS.primary} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" orientation="right" stroke={COLORS.success} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="submissionRate" name="Submission Rate (%)" fill={COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={50} />
                    <Bar yAxisId="right" dataKey="avgScore" name="Avg Score (%)" fill={COLORS.success} radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Distribution & Activity */}
        <div className="space-y-6">
          {/* User Distribution Pie Chart */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500" />
                User Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.userRoleData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {stats.userRoleData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text for Donut */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none -mt-4">
                  <span className="text-2xl font-bold text-slate-800">{stats.totals.users}</span>
                  <div className="text-xs text-slate-500">Total Users</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity Feed */}
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col h-[400px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-500" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest actions in the current session</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full px-6">
                <div className="space-y-4 pb-6">
                  {stats.recentActivity.length === 0 ? (
                    <p className="text-sm text-center text-slate-500 py-4">No recent activity found.</p>
                  ) : (
                    stats.recentActivity.map((item, i) => (
                      <ActivityItem key={i} item={item} />
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// --- Helper Components ---

function MetricCard({ title, value, trend, trendUp, icon: Icon, color, bg, highlight }) {
  return (
    <Card className={cn(
      "border-none shadow-sm transition-all duration-200 hover:-translate-y-1",
      highlight ? "ring-2 ring-rose-500 ring-offset-2" : "hover:shadow-md"
    )}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <h3 className="text-3xl font-bold mt-2 text-slate-900">{value}</h3>
          </div>
          <div className={cn("p-2 rounded-lg", bg)}>
            <Icon className={cn("h-5 w-5", color)} />
          </div>
        </div>
        {trend && (
          <div className="flex items-center mt-4">
            {trendUp !== undefined && (
              trendUp ?
                <TrendingUp className="h-4 w-4 text-emerald-500 mr-1" /> :
                <TrendingUp className="h-4 w-4 text-rose-500 mr-1 rotate-180" />
            )}
            <span className={cn(
              "text-xs font-medium",
              trendUp === true && "text-emerald-600",
              trendUp === false && "text-rose-600",
              trendUp === undefined && "text-slate-500"
            )}>
              {trend}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityItem({ item }) {
  const { type, date, data } = item;

  let icon, color, bg, title, desc;

  switch (type) {
    case 'submission':
      icon = FileText;
      color = 'text-blue-600';
      bg = 'bg-blue-100';
      title = 'New Submission';
      desc = data.projectName || data.teamName || 'Team Submission';
      break;
    case 'evaluation':
      icon = CheckCircle2;
      color = 'text-emerald-600';
      bg = 'bg-emerald-100';
      title = 'Evaluation Completed';
      desc = `Evaluation for ${data.phaseName}`;
      break;
    case 'request':
      icon = GraduationCap;
      color = 'text-amber-600';
      bg = 'bg-amber-100';
      title = 'Mentorship Request';
      desc = `Request from ${data.studentName || 'Student'}`;
      break;
    default:
      icon = Activity;
      color = 'text-slate-600';
      bg = 'bg-slate-100';
      title = 'Activity';
      desc = 'Unknown activity';
  }

  const Icon = icon;

  return (
    <div className="flex items-start space-x-3">
      <div className={cn("mt-1 p-2 rounded-full shrink-0", bg)}>
        <Icon className={cn("h-3 w-3", color)} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-900 leading-none">{title}</p>
        <p className="text-xs text-slate-500 line-clamp-1">{desc}</p>
        <p className="text-[10px] text-slate-400">
          {date ? new Date(date).toLocaleString() : 'Just now'}
        </p>
      </div>
    </div>
  );
}

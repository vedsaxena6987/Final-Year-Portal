// components/dashboard/MyGrades.jsx
"use client";

import { useState, useEffect } from 'react';
import { useStudentGrades } from '@/hooks/useStudentGrades';
import { useAuth } from '@/context/AuthContext';
import { useTeamData } from '@/hooks/useTeamData';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Award, TrendingUp, Target, BarChart3, AlertCircle, Lock, Eye, Info, UserX, CheckCircle, User } from 'lucide-react';
import PanelEvaluationService from '@/services/panelEvaluationService';

import { logger } from "../../../lib/logger";
export default function MyGrades() {
  const { grades, loading } = useStudentGrades();
  const { user, userData } = useAuth();
  const { team } = useTeamData();
  const [hiddenGradesCount, setHiddenGradesCount] = useState(0);
  const [checkingHidden, setCheckingHidden] = useState(true);
  
  // View Details dialog state
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [gradeDetailsOpen, setGradeDetailsOpen] = useState(false);
  const [gradeDetails, setGradeDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Fetch detailed evaluation info for panel phases
  const fetchGradeDetails = async (grade) => {
    if (!team?.id || !team?.panelId || !user?.email) return;
    
    setSelectedGrade(grade);
    setLoadingDetails(true);
    setGradeDetailsOpen(true);
    
    try {
      const details = await PanelEvaluationService.getStudentEvaluationDetails(
        team.id,
        grade.phaseId,
        team.panelId,
        user.email
      );
      setGradeDetails(details);
    } catch (error) {
      logger.error('Error fetching grade details:', error);
      setGradeDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Check for hidden grades
  useEffect(() => {
    const checkHiddenGrades = async () => {
      if (!user) {
        setCheckingHidden(false);
        return;
      }

      try {
        // Fetch all grades for this student using email
        const gradesQuery = query(
          collection(db, 'grades'),
          where('studentEmail', '==', user.email)
        );
        const gradesSnapshot = await getDocs(gradesQuery);

        let hiddenCount = 0;

        // Check each grade's phase visibility
        for (const gradeDoc of gradesSnapshot.docs) {
          const gradeData = gradeDoc.data();
          const phaseDoc = await getDoc(doc(db, 'phases', gradeData.phaseId));
          
          if (phaseDoc.exists()) {
            const phaseData = phaseDoc.data();
            // If marksVisible is explicitly set to false, count it
            if (phaseData.marksVisible === false) {
              hiddenCount++;
            }
          }
        }

        setHiddenGradesCount(hiddenCount);
      } catch (error) {
        logger.error('Error checking hidden grades:', error);
      } finally {
        setCheckingHidden(false);
      }
    };

    checkHiddenGrades();
  }, [user]);

  if (loading || checkingHidden) {
    return (
      <div className="space-y-3">
        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="border-teal-200">
              <CardContent className="p-4">
                <Skeleton className="h-5 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Table Skeleton */}
        <Card className="border-teal-200">
          <CardContent className="p-4">
            <Skeleton className="h-5 w-32 mb-3" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (grades.length === 0) {
    return (
      <div className="space-y-3">
        {/* Hidden Grades Alert */}
        {hiddenGradesCount > 0 && (
          <Alert className="border-amber-200 bg-amber-50">
            <Lock className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <span className="font-semibold">Marks Not Yet Visible:</span> You have {hiddenGradesCount} evaluated phase{hiddenGradesCount !== 1 ? 's' : ''} where marks are currently hidden. Your instructor will make them visible when ready.
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-teal-200">
          <CardContent className="p-4">
            <div className="text-center py-8">
              {hiddenGradesCount > 0 ? (
                <>
                  <Lock className="h-10 w-10 text-amber-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 font-medium">No visible grades yet</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {hiddenGradesCount} grade{hiddenGradesCount !== 1 ? 's are' : ' is'} evaluated but hidden by your instructor
                  </p>
                </>
              ) : (
                <>
                  <AlertCircle className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 font-medium">No grades available yet</p>
                  <p className="text-xs text-gray-500 mt-1">Your grades will appear here once evaluations are completed</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate statistics
  const totalMarks = grades.reduce((sum, grade) => sum + (grade.marks || 0), 0);
  const totalMaxMarks = grades.reduce((sum, grade) => sum + (grade.phase?.maxMarks || 0), 0);
  const averagePercentage = totalMaxMarks > 0 ? Math.round((totalMarks / totalMaxMarks) * 100) : 0;
  const highestGrade = Math.max(...grades.map(g => {
    const max = g.phase?.maxMarks || 100;
    return max > 0 ? Math.round((g.marks / max) * 100) : 0;
  }));
  const lowestGrade = Math.min(...grades.map(g => {
    const max = g.phase?.maxMarks || 100;
    return max > 0 ? Math.round((g.marks / max) * 100) : 0;
  }));

  // Get grade color
  const getGradeColor = (percentage) => {
    if (percentage >= 80) return 'text-green-700 bg-green-50 border-green-200';
    if (percentage >= 60) return 'text-teal-700 bg-teal-50 border-teal-200';
    if (percentage >= 40) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-red-700 bg-red-50 border-red-200';
  };

  return (
    <div className="space-y-3">
      {/* Hidden Grades Alert */}
      {hiddenGradesCount > 0 && (
        <Alert className="border-amber-200 bg-amber-50">
          <Lock className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold">Some marks are hidden:</span> {hiddenGradesCount} evaluated phase{hiddenGradesCount !== 1 ? 's' : ''} not yet visible.
              </div>
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                {hiddenGradesCount} Hidden
              </Badge>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Visibility Status Info */}
      {grades.length > 0 && (
        <Alert className="border-blue-200 bg-blue-50">
          <Eye className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-xs">
            <span className="font-semibold">Visible grades:</span> Showing {grades.length} phase{grades.length !== 1 ? 's' : ''} where marks have been released by your instructors.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Average Score */}
        <Card className="border-teal-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-5 w-5 text-teal-600" />
              <span className="text-xs font-semibold text-gray-600 uppercase">Average Score</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-teal-700">{averagePercentage}%</span>
              <span className="text-xs text-gray-500">{totalMarks}/{totalMaxMarks}</span>
            </div>
          </CardContent>
        </Card>

        {/* Highest Grade */}
        <Card className="border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="text-xs font-semibold text-gray-600 uppercase">Highest</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-green-700">{highestGrade}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Lowest Grade */}
        <Card className="border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-5 w-5 text-amber-600" />
              <span className="text-xs font-semibold text-gray-600 uppercase">Lowest</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-700">{lowestGrade}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grades Table */}
      <Card className="border-teal-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-teal-600" />
            <h3 className="text-sm font-semibold text-gray-900">Detailed Grades</h3>
            <Badge variant="outline" className="ml-auto bg-teal-50 text-teal-700 border-teal-300 text-xs h-5">
              {grades.length} {grades.length === 1 ? 'Phase' : 'Phases'}
            </Badge>
          </div>
          
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-teal-50 hover:bg-teal-50">
                  <TableHead className="text-xs font-semibold text-teal-900 h-9">Phase</TableHead>
                  <TableHead className="text-xs font-semibold text-teal-900 h-9">Score</TableHead>
                  <TableHead className="text-xs font-semibold text-teal-900 h-9">Percentage</TableHead>
                  <TableHead className="text-xs font-semibold text-teal-900 h-9">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grades.map(grade => {
                  const maxMarks = grade.phase?.maxMarks || 100;
                  const percentage = maxMarks > 0 ? Math.round((grade.marks / maxMarks) * 100) : 0;
                  // Try multiple phase name sources: phase.phaseName, grade.phaseName, or fallback
                  const phaseName = grade.phase?.phaseName || grade.phaseName || 'Unknown Phase';
                  const isAbsent = grade.isAbsent === true;
                  
                  return (
                    <TableRow key={grade.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium text-sm py-2">{phaseName}</TableCell>
                      <TableCell className="text-sm py-2">
                        {isAbsent ? (
                          <Badge variant="destructive" className="bg-red-500 text-white text-xs h-6">
                            ABSENT
                          </Badge>
                        ) : (
                          <>
                            <span className="font-semibold">{grade.marks}</span>
                            <span className="text-gray-500">/{maxMarks}</span>
                          </>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        {isAbsent ? (
                          <Badge variant="destructive" className="bg-red-500 text-white text-xs h-6 font-semibold">
                            ABSENT
                          </Badge>
                        ) : (
                          <Badge className={`${getGradeColor(percentage)} text-xs h-6 font-semibold`}>
                            {percentage}%
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-gray-600 py-2 max-w-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="italic truncate">
                            {isAbsent ? (
                              <span className="text-red-700">
                                Marked absent{grade.evaluatorName ? ` by ${grade.evaluatorName}` : ''}
                              </span>
                            ) : (
                              grade.remarks || grade.feedback || 'No remarks provided'
                            )}
                          </span>
                          {/* Show Details button for panel phases */}
                          {grade.phase?.type === 'panel' && team?.panelId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-teal-600 hover:text-teal-700 hover:bg-teal-50 shrink-0"
                              onClick={() => fetchGradeDetails(grade)}
                            >
                              <Info className="h-3 w-3 mr-1" />
                              Details
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* View Details Dialog for Panel Evaluations */}
          <Dialog open={gradeDetailsOpen} onOpenChange={setGradeDetailsOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-teal-600" />
                  Evaluation Details
                </DialogTitle>
                <DialogDescription>
                  {selectedGrade?.phase?.phaseName || selectedGrade?.phaseName || 'Panel Evaluation'}
                </DialogDescription>
              </DialogHeader>
              
              {loadingDetails ? (
                <div className="space-y-3 py-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : gradeDetails ? (
                <div className="space-y-4">
                  {/* Panel Members Status */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gray-700">Panel Members</h4>
                    <div className="space-y-2">
                      {gradeDetails.panelMembers?.map((member, idx) => {
                        const studentData = member.studentData;
                        const isAbsent = studentData?.isAbsent;
                        const hasEvaluated = member.hasEvaluated;
                        
                        return (
                          <div
                            key={member.uid || idx}
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              isAbsent 
                                ? 'bg-red-50 border-red-200' 
                                : hasEvaluated 
                                  ? 'bg-green-50 border-green-200' 
                                  : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-full ${
                                isAbsent 
                                  ? 'bg-red-100 text-red-600' 
                                  : hasEvaluated 
                                    ? 'bg-green-100 text-green-600' 
                                    : 'bg-gray-200 text-gray-500'
                              }`}>
                                {isAbsent ? (
                                  <UserX className="h-4 w-4" />
                                ) : hasEvaluated ? (
                                  <CheckCircle className="h-4 w-4" />
                                ) : (
                                  <User className="h-4 w-4" />
                                )}
                              </div>
                              <span className="text-sm font-medium text-gray-700">
                                {member.name || 'Unknown Faculty'}
                              </span>
                            </div>
                            <Badge
                              variant={isAbsent ? 'destructive' : hasEvaluated ? 'default' : 'secondary'}
                              className={`text-xs ${
                                isAbsent 
                                  ? 'bg-red-500 text-white' 
                                  : hasEvaluated 
                                    ? 'bg-green-500 text-white' 
                                    : 'bg-gray-200 text-gray-600'
                              }`}
                            >
                              {isAbsent ? 'Marked Absent' : hasEvaluated ? 'Evaluated' : 'Pending'}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Average Marks - only show if no one marked absent */}
                  {(() => {
                    const hasAnyAbsent = gradeDetails.panelMembers?.some(m => m.studentData?.isAbsent);
                    if (hasAnyAbsent) {
                      return (
                        <Alert className="border-red-200 bg-red-50">
                          <UserX className="h-4 w-4 text-red-600" />
                          <AlertDescription className="text-red-800 text-sm">
                            You were marked absent by one or more panelists. Average marks are not calculated.
                          </AlertDescription>
                        </Alert>
                      );
                    }
                    if (gradeDetails.studentAverageMarks !== null && gradeDetails.evaluatedCount > 0) {
                      return (
                        <div className="p-4 rounded-lg bg-teal-50 border border-teal-200">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-teal-700">Average Marks</span>
                            <div className="text-right">
                              <span className="text-xl font-bold text-teal-700">
                                {gradeDetails.studentAverageMarks}
                              </span>
                              <span className="text-xs text-teal-600 ml-1">
                                (from {gradeDetails.evaluatedCount} of {gradeDetails.totalPanelists} panelists)
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              ) : (
                <div className="py-4 text-center text-sm text-gray-500">
                  Unable to load evaluation details
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Overall Progress Bar */}
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-600">Overall Performance</span>
              <span className="text-xs font-bold text-teal-700">{averagePercentage}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  averagePercentage >= 80 ? 'bg-gradient-to-r from-green-500 to-green-600' :
                  averagePercentage >= 60 ? 'bg-gradient-to-r from-teal-500 to-teal-600' :
                  averagePercentage >= 40 ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                  'bg-gradient-to-r from-red-500 to-red-600'
                }`}
                style={{ width: `${averagePercentage}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

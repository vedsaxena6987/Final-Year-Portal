"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle, 
  Clock, 
  Users, 
  Award, 
  AlertCircle,
  MessageSquare,
  UserX,
  TrendingUp
} from 'lucide-react';
import PanelEvaluationService from '@/services/panelEvaluationService';
import { useSession } from '@/context/SessionContext';

import { logger } from "../../../lib/logger";
/**
 * StudentPanelEvaluationDetails Component
 * 
 * Shows detailed per-panelist evaluation status for students:
 * - Which panelists have evaluated them
 * - Individual marks from each panelist (if admin allows)
 * - Individual feedback from each panelist
 * - Absent status per panelist
 * - Overall progress and average marks
 */
export default function StudentPanelEvaluationDetails({ 
  teamId, 
  phaseId, 
  panelId, 
  phase,
  studentEmail,
  showMarks = true // Controlled by admin setting
}) {
  const { activeSession } = useSession();
  const [loading, setLoading] = useState(true);
  const [evaluationDetails, setEvaluationDetails] = useState(null);
  const [panelMembers, setPanelMembers] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!teamId || !phaseId || !panelId) {
        setLoading(false);
        return;
      }

      try {
        // Fetch detailed evaluation data for student view
        const details = await PanelEvaluationService.getStudentEvaluationDetails(
          teamId,
          phaseId,
          panelId,
          studentEmail
        );
        
        setEvaluationDetails(details);
        setPanelMembers(details.panelMembers || []);
      } catch (error) {
        logger.error('Error fetching panel evaluation details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [teamId, phaseId, panelId, studentEmail]);

  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const evaluatedCount = panelMembers.filter(m => m.hasEvaluated).length;
  const totalMembers = panelMembers.length;
  const progressPercentage = totalMembers > 0 ? (evaluatedCount / totalMembers) * 100 : 0;
  const isFullyEvaluated = evaluatedCount === totalMembers && totalMembers > 0;

  if (loading) {
    return (
      <Card className="border-purple-200">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!evaluationDetails || panelMembers.length === 0) {
    return (
      <Card className="border-gray-200">
        <CardContent className="p-6 text-center">
          <Users className="h-8 w-8 mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-muted-foreground">
            Panel evaluation details not available yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall Progress Card */}
      <Card className="border-purple-200 bg-purple-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-purple-900">
            <Users className="h-5 w-5 text-purple-600" />
            Panel Evaluation Progress
            <Badge 
              className={`ml-auto ${
                isFullyEvaluated 
                  ? 'bg-green-600 text-white' 
                  : 'bg-amber-500 text-white'
              }`}
            >
              {evaluatedCount} / {totalMembers} Completed
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Evaluation Progress</span>
              <span className="font-semibold">{progressPercentage.toFixed(0)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Status Message */}
          {isFullyEvaluated ? (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Evaluation Complete</AlertTitle>
              <AlertDescription className="text-green-700">
                All panel members have completed your evaluation.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-amber-200 bg-amber-50">
              <Clock className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">Evaluation In Progress</AlertTitle>
              <AlertDescription className="text-amber-700">
                {totalMembers - evaluatedCount} panelist{totalMembers - evaluatedCount !== 1 ? 's' : ''} still need{totalMembers - evaluatedCount === 1 ? 's' : ''} to evaluate your team.
              </AlertDescription>
            </Alert>
          )}

          {/* Average Marks Display (if fully evaluated and marks visible) */}
          {showMarks && evaluationDetails.studentAverageMarks !== undefined && evaluatedCount > 0 && (
            <div className="p-4 bg-white rounded-lg border border-purple-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                  <span className="font-medium text-gray-900">Your Average Marks</span>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-purple-600">
                    {evaluationDetails.studentAverageMarks.toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">/ {phase?.maxMarks || 100}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Based on {evaluatedCount} panelist evaluation{evaluatedCount !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Individual Panelist Evaluations */}
      <Card className="border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Award className="h-5 w-5 text-blue-600" />
            Evaluation by Each Panelist
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {panelMembers.map((member, index) => (
            <div
              key={member.uid}
              className={`p-4 rounded-lg border ${
                member.hasEvaluated
                  ? member.studentData?.isAbsent
                    ? 'bg-red-50 border-red-200'
                    : 'bg-green-50 border-green-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              {/* Panelist Info Header */}
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback 
                    className={
                      member.hasEvaluated
                        ? member.studentData?.isAbsent
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-600'
                    }
                  >
                    {getInitials(member.name)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{member.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                </div>

                {/* Status Badge */}
                {member.hasEvaluated ? (
                  member.studentData?.isAbsent ? (
                    <Badge className="bg-red-600 text-white gap-1">
                      <UserX className="h-3 w-3" />
                      Marked Absent
                    </Badge>
                  ) : (
                    <Badge className="bg-green-600 text-white gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Evaluated
                    </Badge>
                  )
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    Pending
                  </Badge>
                )}
              </div>

              {/* Evaluation Details (if evaluated) */}
              {member.hasEvaluated && (
                <div className="space-y-3 pt-3 border-t border-gray-200">
                  {/* Absent Notice */}
                  {member.studentData?.isAbsent ? (
                    <Alert className="border-red-300 bg-red-100">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        You were marked <strong>absent</strong> by this panelist. 
                        Please contact them to schedule a re-evaluation.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      {/* Marks (if visible) */}
                      {showMarks && member.studentData?.marks !== undefined && (
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-100">
                          <div className="flex items-center gap-2">
                            <Award className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-gray-700">Marks Awarded</span>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold text-green-600">
                              {member.studentData.marks}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {' '}/ {phase?.maxMarks || 100}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Individual Feedback */}
                      {member.studentData?.feedback && (
                        <div className="p-3 bg-white rounded-lg border border-blue-100">
                          <div className="flex items-center gap-2 mb-2">
                            <MessageSquare className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-gray-700">Feedback</span>
                          </div>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">
                            {member.studentData.feedback}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Evaluation Date */}
                  {member.evaluatedAt && (
                    <p className="text-xs text-muted-foreground">
                      Evaluated on: {new Date(member.evaluatedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}
                </div>
              )}

              {/* Pending Message */}
              {!member.hasEvaluated && (
                <p className="text-xs text-muted-foreground mt-2 italic">
                  This panelist has not yet evaluated your team.
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Minimum Requirement Info */}
      {phase?.minPanelistsMeetRequired && (
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className={`flex items-center gap-3 ${
              evaluatedCount >= phase.minPanelistsMeetRequired
                ? 'text-green-700'
                : 'text-amber-700'
            }`}>
              {evaluatedCount >= phase.minPanelistsMeetRequired ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              <div>
                <p className="text-sm font-medium">
                  Minimum Requirement: {phase.minPanelistsMeetRequired} panelist{phase.minPanelistsMeetRequired !== 1 ? 's' : ''}
                </p>
                <p className="text-xs">
                  {evaluatedCount >= phase.minPanelistsMeetRequired
                    ? 'Minimum requirement met! Additional evaluations may still be pending.'
                    : `${phase.minPanelistsMeetRequired - evaluatedCount} more evaluation${phase.minPanelistsMeetRequired - evaluatedCount !== 1 ? 's' : ''} needed to meet minimum requirement.`
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

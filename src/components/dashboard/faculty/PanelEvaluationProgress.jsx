"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, Clock, Users, TrendingUp } from 'lucide-react';
import PanelEvaluationService from '@/services/panelEvaluationService';

import { logger } from "../../../lib/logger";
/**
 * PanelEvaluationProgress Component
 * 
 * Shows which panel members have evaluated a team and displays aggregated marks
 */
export default function PanelEvaluationProgress({ teamId, phaseId, panelId, phase }) {
  const [loading, setLoading] = useState(true);
  const [panelStatus, setPanelStatus] = useState([]);
  const [aggregatedData, setAggregatedData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!teamId || !phaseId || !panelId) {
        setLoading(false);
        return;
      }

      try {
        // Fetch panel members evaluation status
        const status = await PanelEvaluationService.getPanelEvaluationStatus(
          teamId,
          phaseId,
          panelId
        );
        setPanelStatus(status);

        // Fetch aggregated marks
        const aggData = await PanelEvaluationService.calculateAggregatedMarks(
          teamId,
          phaseId
        );
        setAggregatedData(aggData);
      } catch (error) {
        logger.error('Error fetching panel evaluation progress:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [teamId, phaseId, panelId]);

  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const evaluatedCount = panelStatus.filter(m => m.hasEvaluated).length;
  const totalMembers = panelStatus.length;
  const progressPercentage = totalMembers > 0 ? (evaluatedCount / totalMembers) * 100 : 0;

  if (loading) {
    return (
      <Card className="border-purple-200">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Panel Members Evaluation Status */}
      <Card className="border-purple-200">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600" />
            Panel Evaluation Progress
            <Badge className={`ml-auto ${evaluatedCount === totalMembers ? 'bg-green-600' : 'bg-orange-500'}`}>
              {evaluatedCount} / {totalMembers} Evaluated
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Completion</span>
              <span className="font-semibold">{progressPercentage.toFixed(0)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Panel Members List */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Panel Members:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {panelStatus.map((member) => (
                <div
                  key={member.uid}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    member.hasEvaluated
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className={member.hasEvaluated ? 'bg-green-100 text-green-700' : 'bg-gray-200'}>
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  </div>

                  {member.hasEvaluated ? (
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <Clock className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Minimum Requirement Warning */}
          {phase?.minPanelistsMeetRequired && (
            <div className={`p-3 rounded-lg border ${
              evaluatedCount >= phase.minPanelistsMeetRequired
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-orange-50 border-orange-200 text-orange-800'
            }`}>
              <p className="text-sm font-medium">
                {evaluatedCount >= phase.minPanelistsMeetRequired ? '✓' : '⚠️'} 
                {' '}Minimum Requirement: {phase.minPanelistsMeetRequired} panelist{phase.minPanelistsMeetRequired !== 1 ? 's' : ''}
              </p>
              {evaluatedCount < phase.minPanelistsMeetRequired && (
                <p className="text-xs mt-1">
                  {phase.minPanelistsMeetRequired - evaluatedCount} more evaluation{phase.minPanelistsMeetRequired - evaluatedCount !== 1 ? 's' : ''} required
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aggregated Marks Display */}
      {aggregatedData?.hasEvaluations && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Aggregated Marks
              <Badge variant="outline" className="ml-auto bg-blue-50 text-blue-700 border-blue-300">
                Based on {aggregatedData.evaluationCount} evaluation{aggregatedData.evaluationCount !== 1 ? 's' : ''}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Individual Student Marks */}
            <div className="space-y-3">
              {aggregatedData.aggregatedMarks.map((student) => (
                <div
                  key={student.studentEmail}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium">{student.studentName}</p>
                      <p className="text-xs text-muted-foreground">{student.studentEmail}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-600">
                        {student.averageMarks.toFixed(1)}
                      </p>
                      <p className="text-xs text-muted-foreground">/ {phase?.maxMarks}</p>
                    </div>
                  </div>
                  
                  {/* Show individual evaluator marks */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Individual marks:</span>
                    {student.individualMarks.map((mark, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {mark}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Team Average */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Team Average</p>
                  <p className="text-xs text-muted-foreground">
                    Calculated across all panel evaluations
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-blue-600">
                    {aggregatedData.teamAverage.toFixed(1)}
                  </p>
                  <p className="text-sm text-muted-foreground">/ {phase?.maxMarks}</p>
                  <p className="text-xs font-medium text-blue-600">
                    {((aggregatedData.teamAverage / phase?.maxMarks) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

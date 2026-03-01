// components/dashboard/shared/PhasesList.jsx
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePhases } from "@/hooks/usePhases";
import { useSession } from "@/context/SessionContext";
import { Calendar, Clock, Award, User, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format, isPast, isFuture, isWithinInterval } from 'date-fns';

/**
 * PhasesList Component
 * Displays all phases for current session with status indicators
 * Can be used in both student and faculty dashboards
 * 
 * @param {Object} props
 * @param {string} props.view - 'student' or 'faculty' - determines display style
 * @param {string} props.teamId - Optional team ID for showing team-specific submission status
 */
export default function PhasesList({ view = 'student', teamId = null }) {
  const { activeSession } = useSession();
  const { phases, loading, error } = usePhases(activeSession?.id, true); // Only active phases

  if (loading) {
    return (
      <Card className="border-teal-200">
        <CardContent className="p-4">
          <Skeleton className="h-5 w-48 mb-2" />
          <Skeleton className="h-3 w-64 mb-3" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-3 border rounded-lg">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3 mt-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <AlertCircle className="h-4 w-4" />
            <h3 className="text-sm font-semibold">Error Loading Phases</h3>
          </div>
          <p className="text-xs text-gray-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!phases || phases.length === 0) {
    return (
      <Card className="border-teal-200">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Project Phases</h3>
          <div className="text-center py-6">
            <AlertCircle className="h-10 w-10 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No phases created yet</p>
            <p className="text-xs text-gray-500 mt-1">
              Your admin will create evaluation phases soon
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  /**
   * Get phase status based on dates
   */
  const getPhaseStatus = (phase) => {
    if (!phase.startDate || !phase.endDate) {
      return { status: 'no-dates', label: 'No Deadline', color: 'gray' };
    }

    const now = new Date();
    const start = phase.startDate;
    const end = phase.endDate;

    if (isFuture(start)) {
      return { status: 'upcoming', label: 'Upcoming', color: 'blue' };
    }

    if (isWithinInterval(now, { start, end })) {
      return { status: 'active', label: 'Active', color: 'green' };
    }

    if (isPast(end)) {
      return { status: 'completed', label: 'Closed', color: 'gray' };
    }

    return { status: 'unknown', label: 'Unknown', color: 'gray' };
  };

  /**
   * Get badge variant based on color
   */
  const getBadgeVariant = (color) => {
    const variants = {
      blue: 'default',
      green: 'default',
      gray: 'secondary',
      yellow: 'outline',
      red: 'destructive'
    };
    return variants[color] || 'default';
  };

  /**
   * Get evaluator role display
   */
  const getEvaluatorDisplay = (role) => {
    const roles = {
      mentor: { icon: User, label: 'Mentor', color: 'text-blue-600' },
      panel: { icon: User, label: 'Panel', color: 'text-purple-600' },
      external: { icon: User, label: 'External', color: 'text-orange-600' },
      combined: { icon: User, label: 'Combined', color: 'text-green-600' }
    };
    return roles[role] || roles.mentor;
  };

  return (
    <Card className="border-teal-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-teal-600" />
            <h3 className="text-sm font-semibold text-gray-900">Project Phases</h3>
          </div>
          <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-300 text-xs h-5">
            {phases.length} {phases.length === 1 ? 'Phase' : 'Phases'}
          </Badge>
        </div>
        <p className="text-xs text-gray-600 mb-3">
          {view === 'student' 
            ? 'Complete each phase to progress through your final year project'
            : 'Evaluation phases for the current academic session'}
        </p>
        <div className="space-y-3">
          {phases.map((phase, index) => {
            const phaseStatus = getPhaseStatus(phase);
            const evaluatorInfo = getEvaluatorDisplay(phase.evaluatorRole);
            const EvaluatorIcon = evaluatorInfo.icon;

            return (
              <div
                key={phase.id}
                className={`p-3 border rounded-lg transition-all hover:shadow-md ${
                  phaseStatus.status === 'active' 
                    ? 'border-teal-300 bg-teal-50/50' 
                    : 'border-gray-200'
                }`}
              >
                {/* Phase Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-2 flex-1">
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      phaseStatus.status === 'active' 
                        ? 'bg-teal-600 text-white' 
                        : phaseStatus.status === 'completed'
                        ? 'bg-gray-400 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">
                        {phase.phaseName || phase.title || phase.name}
                      </h4>
                      {phase.description && (
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {phase.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge 
                    variant={getBadgeVariant(phaseStatus.color)}
                    className="flex-shrink-0"
                  >
                    {phaseStatus.status === 'active' && (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    )}
                    {phaseStatus.label}
                  </Badge>
                </div>

                {/* Phase Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                  {/* Start Date */}
                  {phase.startDate && (
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-teal-600" />
                      <div>
                        <p className="text-[10px] text-gray-500">Start Date</p>
                        <p className="text-xs font-medium">
                          {format(phase.startDate, 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* End Date */}
                  {phase.endDate && (
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Clock className="h-3.5 w-3.5 flex-shrink-0 text-teal-600" />
                      <div>
                        <p className="text-[10px] text-gray-500">Deadline</p>
                        <p className={`text-xs font-medium ${
                          phaseStatus.status === 'active' ? 'text-teal-600' : ''
                        }`}>
                          {format(phase.endDate, 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Max Marks */}
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <Award className="h-3.5 w-3.5 flex-shrink-0 text-teal-600" />
                    <div>
                      <p className="text-[10px] text-gray-500">Max Marks</p>
                      <p className="text-xs font-medium">{phase.maxMarks || 100}</p>
                    </div>
                  </div>

                  {/* Evaluator Role */}
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <EvaluatorIcon className={`h-3.5 w-3.5 flex-shrink-0 ${evaluatorInfo.color}`} />
                    <div>
                      <p className="text-[10px] text-gray-500">Evaluated By</p>
                      <p className={`text-xs font-medium ${evaluatorInfo.color}`}>
                        {evaluatorInfo.label}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Late Submission Badge */}
                {phase.allowLateSubmission && (
                  <div className="mt-2 pt-2 border-t">
                    <Badge variant="outline" className="text-[10px] h-5 bg-teal-50 text-teal-700 border-teal-300">
                      Late submissions allowed
                    </Badge>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Session Info */}
        {activeSession && (
          <div className="mt-4 pt-3 border-t">
            <p className="text-xs text-gray-600">
              <span className="font-medium">Academic Session:</span>{' '}
              {activeSession.name}
              {activeSession.startDate && activeSession.endDate && (
                <span className="text-gray-500">
                  {' '}({format(activeSession.startDate, 'MMM yyyy')} - {format(activeSession.endDate, 'MMM yyyy')})
                </span>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

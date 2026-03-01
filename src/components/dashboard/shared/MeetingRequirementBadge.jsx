// components/dashboard/shared/MeetingRequirementBadge.jsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, AlertCircle, Users, Calendar } from 'lucide-react';
import { usePhaseEligibility } from '@/hooks/useMeetingStats';

/**
 * Display meeting requirement status for panel phases
 * Shows if team has met minimum panelists requirement
 */
export default function MeetingRequirementBadge({ teamId, phase, variant = 'badge' }) {
  const { eligibility, loading } = usePhaseEligibility(teamId, phase);

  // Don't show anything for mentor phases or phases without requirements
  if (!phase?.phaseType || phase.phaseType !== 'panel' || !phase.minPanelistsMeetRequired) {
    return null;
  }

  if (loading) {
    return variant === 'badge' ? (
      <Skeleton className="h-6 w-32" />
    ) : (
      <Skeleton className="h-16 w-full" />
    );
  }

  if (!eligibility) return null;

  // Badge variant - compact display
  if (variant === 'badge') {
    return (
      <Badge 
        variant={eligibility.eligible ? "default" : "destructive"}
        className="gap-1"
      >
        {eligibility.eligible ? (
          <>
            <CheckCircle className="h-3 w-3" />
            Requirements Met
          </>
        ) : (
          <>
            <AlertCircle className="h-3 w-3" />
            {eligibility.panelistsMet}/{eligibility.minRequired} Panelists
          </>
        )}
      </Badge>
    );
  }

  // Alert variant - detailed display
  if (variant === 'alert') {
    return (
      <Alert className={eligibility.eligible ? 'border-green-500 bg-green-50' : 'border-amber-500 bg-amber-50'}>
        {eligibility.eligible ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <AlertCircle className="h-4 w-4 text-amber-600" />
        )}
        <AlertDescription>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={`font-medium ${eligibility.eligible ? 'text-green-900' : 'text-amber-900'}`}>
                {eligibility.eligible ? 'Meeting Requirements Fulfilled' : 'Meeting Requirements Pending'}
              </span>
              <Badge variant="secondary" className={eligibility.eligible ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                <Users className="h-3 w-3 mr-1" />
                {eligibility.panelistsMet}/{eligibility.minRequired} Panelists Met
              </Badge>
            </div>
            {!eligibility.eligible && (
              <p className="text-sm text-amber-800">
                Team must meet <strong>{eligibility.remaining} more panelist(s)</strong> before evaluation can be submitted.
              </p>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Inline variant - minimal display
  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 text-sm ${eligibility.eligible ? 'text-green-600' : 'text-amber-600'}`}>
        {eligibility.eligible ? (
          <>
            <CheckCircle className="h-4 w-4" />
            <span>Requirements met ({eligibility.panelistsMet} panelists)</span>
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4" />
            <span>{eligibility.panelistsMet}/{eligibility.minRequired} panelists met</span>
          </>
        )}
      </div>
    );
  }

  // Detail variant - full information card
  if (variant === 'detail') {
    return (
      <div className="space-y-3 p-4 border rounded-lg bg-card">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Meeting Requirements
          </h4>
          <Badge variant={eligibility.eligible ? "default" : "secondary"}>
            {eligibility.eligible ? 'Met' : 'Pending'}
          </Badge>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Panelists Met:</span>
            <span className="font-medium">{eligibility.panelistsMet}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Minimum Required:</span>
            <span className="font-medium">{eligibility.minRequired}</span>
          </div>
          {!eligibility.eligible && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Remaining:</span>
              <span className="font-medium text-amber-600">{eligibility.remaining}</span>
            </div>
          )}
        </div>

        {eligibility.eligible ? (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Team can be evaluated for this phase
          </p>
        ) : (
          <p className="text-xs text-amber-600 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Team needs to meet {eligibility.remaining} more panelist(s)
          </p>
        )}
      </div>
    );
  }

  return null;
}

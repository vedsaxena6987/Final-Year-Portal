// src/components/ui/empty-state.jsx
"use client";

import { 
  FileQuestion, 
  Users, 
  Calendar, 
  FileText, 
  ClipboardList,
  Trophy,
  Clock,
  Inbox
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/**
 * Icon mapping for different empty state types
 */
const iconMap = {
  teams: Users,
  abstracts: FileText,
  phases: Calendar,
  submissions: ClipboardList,
  evaluations: Trophy,
  activities: Clock,
  default: Inbox,
  notFound: FileQuestion
};

/**
 * Generic Empty State Component
 * Displays a helpful message when there's no data to show
 * 
 * @param {string} type - Type of empty state (teams, abstracts, phases, etc.)
 * @param {string} title - Main heading text
 * @param {string} message - Description text
 * @param {ReactNode} icon - Custom icon component (optional)
 * @param {Object} action - Action button config { label, onClick }
 * @param {ReactNode} children - Additional custom content
 */
export default function EmptyState({ 
  type = 'default',
  title,
  message,
  icon: CustomIcon,
  action,
  children 
}) {
  // Select icon based on type
  const Icon = CustomIcon || iconMap[type] || iconMap.default;

  return (
    <Card className="flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
      {/* Icon */}
      <div className="rounded-full bg-gray-100 p-6 mb-6">
        <Icon className="h-12 w-12 text-gray-400" />
      </div>

      {/* Content */}
      <div className="space-y-3 max-w-md">
        <h3 className="text-xl font-semibold text-gray-900">
          {title || 'No data available'}
        </h3>
        {message && (
          <p className="text-sm text-gray-600 leading-relaxed">
            {message}
          </p>
        )}
      </div>

      {/* Action Button */}
      {action && (
        <Button 
          onClick={action.onClick} 
          className="mt-8"
          variant={action.variant || 'default'}
        >
          {action.label}
        </Button>
      )}

      {/* Custom Children */}
      {children && (
        <div className="mt-6 w-full">
          {children}
        </div>
      )}
    </Card>
  );
}

/**
 * Pre-configured Empty States for common scenarios
 */

export function NoTeamsEmpty({ isMentor = false }) {
  return (
    <EmptyState
      type="teams"
      title="No teams found"
      message={
        isMentor
          ? "You haven't been assigned as a mentor to any teams yet. Teams will appear here once they select you as their mentor."
          : "You don't have any teams assigned to your evaluation panels yet. Check back later or contact the administrator."
      }
    />
  );
}

export function NoAbstractsEmpty() {
  return (
    <EmptyState
      type="abstracts"
      title="No abstracts to review"
      message="None of your mentored teams have submitted abstracts yet. Abstracts will appear here once students submit them for review."
    />
  );
}

export function NoPhasesEmpty() {
  return (
    <EmptyState
      type="phases"
      title="No evaluation phases"
      message="The administrator hasn't created any evaluation phases yet. Phases will appear here once they are set up for the current session."
    />
  );
}

export function NoSubmissionsEmpty({ phaseName }) {
  return (
    <EmptyState
      type="submissions"
      title="No submissions yet"
      message={
        phaseName
          ? `No teams have submitted their work for ${phaseName} yet. Submissions will appear here as students upload their deliverables.`
          : "No submissions have been made yet. Submissions will appear here as students upload their phase deliverables."
      }
    />
  );
}

export function NoEvaluationsEmpty() {
  return (
    <EmptyState
      type="evaluations"
      title="No evaluations completed"
      message="You haven't evaluated any submissions yet. Start by navigating to the Phases tab and evaluating team submissions."
    />
  );
}

export function NoActivitiesEmpty() {
  return (
    <EmptyState
      type="activities"
      title="No activities recorded"
      message="There haven't been any activities for this team yet. Activities like submissions, evaluations, and status changes will appear here."
    />
  );
}

export function NoMarksEmpty() {
  return (
    <EmptyState
      type="evaluations"
      title="No marks recorded"
      message="This team hasn't received any marks yet. Marks will be displayed here once evaluations are completed."
    />
  );
}

export function NoSearchResultsEmpty({ searchTerm }) {
  return (
    <EmptyState
      type="notFound"
      title="No results found"
      message={
        searchTerm
          ? `No results found for "${searchTerm}". Try adjusting your search terms or filters.`
          : "No results match your current filters. Try adjusting your search criteria."
      }
    />
  );
}

export function TeamNotFoundEmpty() {
  return (
    <EmptyState
      type="notFound"
      title="Team not found"
      message="The team you're looking for doesn't exist or you don't have permission to view it."
      action={{
        label: "Back to Teams",
        onClick: () => window.history.back()
      }}
    />
  );
}

export function NoAccessEmpty() {
  return (
    <EmptyState
      type="notFound"
      title="Access denied"
      message="You don't have permission to view this content. If you believe this is an error, please contact the administrator."
      action={{
        label: "Go to Dashboard",
        onClick: () => window.location.href = '/dashboard'
      }}
    />
  );
}

"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  Calendar,
  Upload,
  AlertCircle
} from 'lucide-react';
import { format, isBefore, isAfter } from 'date-fns';

import { logger } from "../../../lib/logger";
export default function TeamActivitiesTab({ teamId, team }) {
  const [activities, setActivities] = useState([]);
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch activities
  useEffect(() => {
    const fetchActivities = async () => {
      if (!teamId || !team?.sessionId) return;

      try {
        const activityList = [];

        // 1. Team creation activity
        if (team.createdAt) {
          activityList.push({
            id: 'team-created',
            type: 'team_created',
            timestamp: team.createdAt,
            title: 'Team Created',
            description: `Project #${team.projectNumber} was created`,
            icon: CheckCircle,
            color: 'blue'
          });
        }

        // 2. Abstract submission
        if (team.abstractSubmittedAt) {
          activityList.push({
            id: 'abstract-submitted',
            type: 'abstract_submitted',
            timestamp: team.abstractSubmittedAt,
            title: 'Abstract Submitted',
            description: 'Team submitted project abstract for review',
            icon: Upload,
            color: 'blue'
          });
        }

        // 3. Abstract status changes
        if (team.abstractReviewedAt) {
          let description = 'Abstract reviewed';
          let icon = MessageSquare;
          let color = 'gray';

          if (team.abstractStatus === 'approved') {
            description = 'Abstract approved by mentor';
            icon = CheckCircle;
            color = 'green';
          } else if (team.abstractStatus === 'rejected') {
            description = 'Abstract rejected - revisions needed';
            icon = XCircle;
            color = 'red';
          } else if (team.abstractStatus === 'under_review') {
            description = 'Revisions requested for abstract';
            icon = AlertCircle;
            color = 'orange';
          }

          activityList.push({
            id: 'abstract-reviewed',
            type: 'abstract_review',
            timestamp: team.abstractReviewedAt,
            title: 'Abstract Review',
            description,
            feedback: team.abstractFeedback,
            icon,
            color
          });
        }

        // 4. Fetch phases for deadlines
        const phasesRef = collection(db, 'phases');
        const phasesQuery = query(
          phasesRef,
          where('sessionId', '==', team.sessionId)
        );
        const phasesSnapshot = await getDocs(phasesQuery);
        const phasesData = phasesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setPhases(phasesData);

        // Add phase deadlines to timeline
        phasesData.forEach(phase => {
          const now = new Date();
          const endDate = phase.endDate.toDate();
          const isPast = isBefore(endDate, now);
          const isUpcoming = isAfter(endDate, now);

          activityList.push({
            id: `phase-deadline-${phase.id}`,
            type: isPast ? 'deadline_passed' : 'deadline_upcoming',
            timestamp: phase.endDate,
            title: `${phase.phaseName || 'Phase'} Deadline`,
            description: isPast
              ? `Deadline for ${phase.phaseName || 'phase'} has passed`
              : `Upcoming deadline for ${phase.phaseName || 'phase'}`,
            icon: Calendar,
            color: isPast ? 'red' : 'orange',
            isPast,
            isUpcoming
          });
        });

        // 5. Fetch submissions
        const submissionsRef = collection(db, 'submissions');
        const submissionsQuery = query(
          submissionsRef,
          where('teamId', '==', teamId)
        );
        const submissionsSnapshot = await getDocs(submissionsQuery);

        submissionsSnapshot.docs.forEach(doc => {
          const submission = doc.data();
          if (submission.submittedAt) {
            activityList.push({
              id: `submission-${doc.id}`,
              type: 'submission',
              timestamp: submission.submittedAt,
              title: 'Submission',
              description: `Submitted work for ${submission.phaseName || 'phase'}`,
              icon: FileText,
              color: 'blue'
            });
          }
        });

        // 6. Fetch evaluations
        const evaluationsRef = collection(db, 'evaluations');
        const evaluationsQuery = query(
          evaluationsRef,
          where('teamId', '==', teamId)
        );
        const evaluationsSnapshot = await getDocs(evaluationsQuery);

        evaluationsSnapshot.docs.forEach(doc => {
          const evaluation = doc.data();
          if (evaluation.evaluatedAt) {
            activityList.push({
              id: `evaluation-${doc.id}`,
              type: 'evaluation',
              timestamp: evaluation.evaluatedAt,
              title: 'Evaluation Complete',
              description: `Received marks for ${evaluation.phaseName || 'phase'}`,
              icon: CheckCircle,
              color: 'green'
            });
          }
        });

        // Sort activities by timestamp (newest first)
        activityList.sort((a, b) => {
          const aTime = a.timestamp?.toDate?.() || a.timestamp;
          const bTime = b.timestamp?.toDate?.() || b.timestamp;
          return bTime - aTime;
        });

        setActivities(activityList);
      } catch (error) {
        logger.error('Error fetching activities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [teamId, team]);

  // Get color classes for timeline
  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-700 border-blue-300',
      green: 'bg-green-100 text-green-700 border-green-300',
      red: 'bg-red-100 text-red-700 border-red-300',
      orange: 'bg-orange-100 text-orange-700 border-orange-300',
      gray: 'bg-gray-100 text-gray-700 border-gray-300'
    };
    return colors[color] || colors.gray;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="card-faculty p-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-4 mb-4 animate-shimmer">
              <div className="skeleton-faculty w-12 h-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton-faculty h-4 w-32" />
                <div className="skeleton-faculty h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid-responsive-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card-stat animate-shimmer">
              <div className="skeleton-faculty h-16 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="border-teal-200">
        <CardContent className="p-4">
          {activities.length === 0 ? (
            <div className="empty-state py-12">
              <div className="empty-state-icon">
                <Clock className="h-8 w-8" />
              </div>
              <h2 className="empty-state-title">No Activities Yet</h2>
              <p className="empty-state-text">Team activities will appear here as progress is made</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[23px] top-8 bottom-8 w-0.5 bg-gray-200"></div>

              {/* Activities */}
              <div className="space-y-6">
                {activities.map((activity, index) => {
                  const Icon = activity.icon;
                  const timestamp = activity.timestamp?.toDate?.() || activity.timestamp;

                  return (
                    <div key={activity.id} className="relative flex gap-4">
                      {/* Icon */}
                      <div className={`
                        relative z-10 flex items-center justify-center
                        w-12 h-12 rounded-full border-4 border-white
                        ${getColorClasses(activity.color)}
                      `}>
                        <Icon className="h-5 w-5" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 pb-6">
                        <Card className={`
                          border-l-4 
                          ${activity.color === 'blue' ? 'border-l-blue-500' : ''}
                          ${activity.color === 'green' ? 'border-l-green-500' : ''}
                          ${activity.color === 'red' ? 'border-l-red-500' : ''}
                          ${activity.color === 'orange' ? 'border-l-orange-500' : ''}
                          ${activity.color === 'gray' ? 'border-l-gray-500' : ''}
                        `}>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-3 mb-1">
                              <h3 className="font-semibold text-base">{activity.title}</h3>
                              <div className="text-xs text-muted-foreground whitespace-nowrap">
                                {timestamp && format(timestamp, 'MMM dd, yyyy')}
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                              {activity.description}
                            </p>
                            {activity.feedback && (
                              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-xs font-medium text-amber-900 mb-1">
                                  <MessageSquare className="h-3 w-3 inline mr-1" />
                                  Feedback:
                                </p>
                                <p className="text-xs text-amber-900">{activity.feedback}</p>
                              </div>
                            )}
                            {activity.isUpcoming && (
                              <Badge variant="outline" className="mt-2 bg-orange-50 text-orange-700 border-orange-300">
                                Upcoming
                              </Badge>
                            )}
                            {activity.isPast && (
                              <Badge variant="outline" className="mt-2 bg-red-50 text-red-700 border-red-300">
                                Past Due
                              </Badge>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid-responsive-4">
        <div className="card-stat group animate-fade-in-up stagger-1">
          <div className="text-center">
            <div className="bg-blue-50 text-blue-600 w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 transition-transform group-hover:scale-110">
              <Upload className="h-5 w-5" />
            </div>
            <div className="metric-value text-2xl font-bold text-gray-900">
              {activities.filter(a => a.type === 'submission').length}
            </div>
            <div className="metric-label">Submissions</div>
          </div>
        </div>
        <div className="card-stat group animate-fade-in-up stagger-2">
          <div className="text-center">
            <div className="bg-emerald-50 text-emerald-600 w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 transition-transform group-hover:scale-110">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div className="metric-value text-2xl font-bold text-gray-900">
              {activities.filter(a => a.type === 'evaluation').length}
            </div>
            <div className="metric-label">Evaluations</div>
          </div>
        </div>
        <div className="card-stat group animate-fade-in-up stagger-3">
          <div className="text-center">
            <div className="bg-amber-50 text-amber-600 w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 transition-transform group-hover:scale-110">
              <Calendar className="h-5 w-5" />
            </div>
            <div className="metric-value text-2xl font-bold text-gray-900">
              {activities.filter(a => a.isUpcoming).length}
            </div>
            <div className="metric-label">Upcoming</div>
          </div>
        </div>
        <div className="card-stat group animate-fade-in-up stagger-4">
          <div className="text-center">
            <div className="bg-red-50 text-red-600 w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 transition-transform group-hover:scale-110">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="metric-value text-2xl font-bold text-gray-900">
              {activities.filter(a => a.isPast).length}
            </div>
            <div className="metric-label">Past Due</div>
          </div>
        </div>
      </div>
    </div>
  );
}

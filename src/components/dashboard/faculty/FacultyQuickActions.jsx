// src/components/dashboard/faculty/FacultyQuickActions.jsx - Premium Quick Actions
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import {
  MessageSquare,
  Users,
  FileText,
  Clock,
  CheckCircle2,
  ArrowRight,
  Bell,
  ChevronRight,
  Calendar,
  TrendingUp
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { logger } from "../../../lib/logger";
export default function FacultyQuickActions() {
  const router = useRouter();
  const { userData } = useAuth();
  const [recentActivity, setRecentActivity] = useState([]);
  const [urgentCount, setUrgentCount] = useState(0);

  useEffect(() => {
    if (!userData?.uid) return;

    const requestsQuery = query(
      collection(db, 'mentorship_requests'),
      where('mentorEmail', '==', userData.email)
    );

    const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
      const activities = snapshot.docs.map(doc => ({
        id: doc.id,
        type: 'mentorship_request',
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));

      activities.sort((a, b) => b.createdAt - a.createdAt);
      setRecentActivity(activities.slice(0, 6));

      const urgent = activities.filter(a =>
        a.status === 'pending' &&
        (new Date() - a.createdAt) > (3 * 24 * 60 * 60 * 1000)
      ).length;

      setUrgentCount(urgent);
    }, (error) => {
      // Handle permission errors gracefully during logout
      if (error.code === 'permission-denied') {
        setRecentActivity([]);
        setUrgentCount(0);
      } else {
        logger.error('Error fetching mentorship requests:', error);
      }
    });

    return () => unsubscribe();
  }, [userData?.uid]);

  const getActivityIcon = (status) => {
    return status === 'pending' ? Clock :
      status === 'approved' ? CheckCircle2 :
        MessageSquare;
  };

  const handleNavigate = (tab) => {
    const currentPath = window.location.pathname;
    router.push(`${currentPath}?tab=${tab}`);
  };

  const quickActions = [
    {
      id: 'requests',
      icon: MessageSquare,
      label: 'Review Requests',
      description: 'Mentorship requests',
      gradient: 'from-teal-400 to-cyan-500',
      bgGradient: 'from-teal-50 via-teal-50/80 to-cyan-50',
      iconBg: 'from-teal-100 to-cyan-100',
      textColor: 'text-teal-700',
      badge: urgentCount > 0 ? urgentCount : null
    },
    {
      id: 'teams',
      icon: Users,
      label: 'My Teams',
      description: 'Team management',
      gradient: 'from-emerald-400 to-green-500',
      bgGradient: 'from-emerald-50 via-emerald-50/80 to-green-50',
      iconBg: 'from-emerald-100 to-green-100',
      textColor: 'text-emerald-700'
    },
    {
      id: 'abstracts',
      icon: FileText,
      label: 'Abstracts',
      description: 'Review submissions',
      gradient: 'from-blue-400 to-indigo-500',
      bgGradient: 'from-blue-50 via-blue-50/80 to-indigo-50',
      iconBg: 'from-blue-100 to-indigo-100',
      textColor: 'text-blue-700'
    },
    {
      id: 'phases',
      icon: Calendar,
      label: 'Phases',
      description: 'Evaluations',
      gradient: 'from-violet-400 to-purple-500',
      bgGradient: 'from-violet-50 via-violet-50/80 to-purple-50',
      iconBg: 'from-violet-100 to-purple-100',
      textColor: 'text-violet-700'
    }
  ];

  return (
    <div className="grid-responsive-2">
      {/* Quick Actions Card */}
      <div className="card-faculty-elevated p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">Quick Actions</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action, index) => {
            const Icon = action.icon;

            return (
              <button
                key={action.id}
                onClick={() => handleNavigate(action.id)}
                className={`group relative overflow-hidden flex flex-col items-center justify-center p-4 rounded-2xl border border-gray-100 bg-gradient-to-br ${action.bgGradient} hover:shadow-md active:scale-95 transition-all duration-200 touch-target animate-fade-in-up stagger-${index + 1}`}
              >
                <div className={`bg-gradient-to-br ${action.iconBg} ${action.textColor} p-3 rounded-xl mb-2.5 shadow-sm transition-transform group-hover:scale-110 group-hover:-rotate-6 duration-300`}>
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-sm font-bold text-gray-900 mb-1">{action.label}</span>
                <span className="text-xs text-gray-600 font-medium">{action.description}</span>

                {action.badge && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1.5 -right-1.5 h-6 min-w-[24px] px-2 text-[11px] rounded-full shadow-lg animate-pulse-soft"
                  >
                    {action.badge}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Activity Card */}
      <div className="card-faculty-elevated p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">Recent Activity</h2>
          {recentActivity.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleNavigate('requests')}
              className="h-8 px-3 text-xs font-semibold text-teal-600 hover:text-teal-700 hover:bg-teal-50 -mr-2"
            >
              View all
              <ChevronRight className="h-4 w-4 ml-0.5" />
            </Button>
          )}
        </div>

        {recentActivity.length > 0 ? (
          <div className="space-y-2">
            {recentActivity.slice(0, 5).map((activity, index) => {
              const Icon = getActivityIcon(activity.status);
              const isPending = activity.status === 'pending';

              return (
                <div
                  key={activity.id}
                  className={`flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r ${isPending ? 'from-amber-50/50 to-orange-50/30 border border-amber-100' : 'from-emerald-50/50 to-green-50/30 border border-emerald-100'} hover:shadow-sm transition-all duration-200 cursor-default group animate-slide-in-right stagger-${index + 1}`}
                >
                  <div className={`${isPending ? 'bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600' : 'bg-gradient-to-br from-emerald-100 to-green-100 text-emerald-600'} p-2.5 rounded-xl shadow-sm shrink-0 transition-transform group-hover:scale-110 duration-200`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate leading-tight">
                      Project #{activity.projectNumber || activity.teamName?.replace('Project ', '')}
                    </p>
                    <p className="text-xs text-gray-600 font-medium leading-tight mt-0.5">
                      {formatDistanceToNow(activity.createdAt, { addSuffix: true })}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs h-6 px-3 shrink-0 font-semibold ${isPending ? 'border-amber-300 text-amber-800 bg-gradient-to-r from-amber-100 to-orange-100' : 'border-emerald-300 text-emerald-800 bg-gradient-to-r from-emerald-100 to-green-100'}`}
                  >
                    {activity.status}
                  </Badge>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state py-10">
            <div className="empty-state-icon">
              <Bell className="h-7 w-7" />
            </div>
            <p className="empty-state-title text-sm">No Recent Activity</p>
            <p className="empty-state-text text-xs mt-1">
              New mentorship requests will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

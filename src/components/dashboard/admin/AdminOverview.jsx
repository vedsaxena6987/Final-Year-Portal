// src/components/dashboard/admin/AdminOverview.jsx
"use client";

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Users,
  UserCheck,
  Calendar,
  ClipboardList,
  BookOpen,
  ArrowUpRight,
  ArrowRight,
  TrendingUp,
  GraduationCap,
  Layers
} from 'lucide-react';
import { useSession } from '@/context/SessionContext';
import { cn } from '@/lib/utils';

export default function AdminOverview({ dashboardData, onNavigate }) {
  const { activeSession } = useSession();

  const statsCards = [
    {
      title: "Total Students",
      value: dashboardData.totalStudents,
      icon: GraduationCap,
      description: "Registered in system",
      gradient: "gradient-card-cool",
      iconClass: "icon-container-brand"
    },
    {
      title: "Faculty Members",
      value: dashboardData.totalFaculty,
      icon: UserCheck,
      description: "Mentors & evaluators",
      gradient: "gradient-card-purple",
      iconClass: "icon-container-info"
    },
    {
      title: "Active Teams",
      value: dashboardData.totalTeams,
      icon: Users,
      description: "Current session",
      gradient: "gradient-card-success",
      iconClass: "icon-container-success"
    },
    {
      title: "Project Phases",
      value: dashboardData.totalPhases,
      icon: Calendar,
      description: "Evaluation milestones",
      gradient: "gradient-card-cyan",
      iconClass: "icon-container-warning"
    },
    {
      title: "Evaluation Panels",
      value: dashboardData.activePanels,
      icon: ClipboardList,
      description: "For current session",
      gradient: "gradient-card-cool",
      iconClass: "icon-container-info"
    },
    {
      title: "Pending Requests",
      value: dashboardData.pendingRequests,
      icon: BookOpen,
      description: "Awaiting approval",
      gradient: dashboardData.pendingRequests > 0 ? "gradient-card-rose" : "gradient-card-success",
      iconClass: dashboardData.pendingRequests > 0 ? "icon-container-warning" : "icon-container-success"
    }
  ];

  const quickActions = [
    { label: "Manage Users", tab: "users", icon: Users },
    { label: "Manage Teams", tab: "teams", icon: Layers },
    { label: "View Analytics", tab: "analytics", icon: TrendingUp },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome to Admin Portal</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your final year project portal from here</p>
        </div>
        {activeSession && (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 px-3 py-1.5">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
            Session: {activeSession.name}
          </Badge>
        )}
      </div>

      {/* Active Session Alert */}
      {!activeSession && (
        <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-amber-800">No Active Session</p>
              <p className="text-sm text-amber-600">Create a session to enable team creation and evaluations</p>
            </div>
          </div>
          <Button
            onClick={() => onNavigate('sessions')}
            className="btn-brand px-4 py-2 rounded-lg text-sm font-medium"
          >
            Create Session
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statsCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              className={cn(
                "border-0 card-elevated hover-lift cursor-pointer overflow-hidden",
                card.gradient
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <div className={cn("icon-container w-10 h-10", card.iconClass)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500">{card.title}</p>
                      <p className="text-3xl font-bold text-slate-800 mt-1">{card.value}</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-3">{card.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Current Session Card */}
        <Card className="lg:col-span-3 border-0 card-elevated h-fit">
          <CardHeader className="pb-3 border-b border-slate-50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-slate-800">Current Session</CardTitle>
                <CardDescription>Academic year timeline and overview</CardDescription>
              </div>
              {activeSession && (
                <Badge className="bg-emerald-100 text-emerald-700 border-0 px-3 py-1">
                  Active
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {activeSession ? (
              <div className="space-y-6">
                {/* Session Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                      <Calendar className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-xl">{activeSession.name}</h3>
                      <p className="text-sm font-medium text-slate-500 mt-1 flex items-center gap-2">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-600">
                          {activeSession.startDate ? new Date(activeSession.startDate).toLocaleDateString() : 'N/A'}
                        </span>
                        <span>to</span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-600">
                          {activeSession.endDate ? new Date(activeSession.endDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigate('sessions')}
                    className="text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
                  >
                    Manage Session
                    <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Session Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Session Progress</span>
                    <span>
                      {(() => {
                        if (!activeSession?.startDate || !activeSession?.endDate) return '0%';
                        const start = new Date(activeSession.startDate).getTime();
                        const end = new Date(activeSession.endDate).getTime();
                        const now = new Date().getTime();
                        const total = end - start;
                        const elapsed = now - start;
                        const percent = Math.min(100, Math.max(0, (elapsed / total) * 100));
                        return Math.round(percent) + '%';
                      })()}
                    </span>
                  </div>
                  <Progress value={(() => {
                    if (!activeSession?.startDate || !activeSession?.endDate) return 0;
                    const start = new Date(activeSession.startDate).getTime();
                    const end = new Date(activeSession.endDate).getTime();
                    const now = new Date().getTime();
                    const total = end - start;
                    const elapsed = now - start;
                    return Math.min(100, Math.max(0, (elapsed / total) * 100));
                  })()} className="h-2 bg-slate-100 [&>div]:bg-gradient-to-r [&>div]:from-indigo-500 [&>div]:to-violet-500" />
                </div>

                {/* Session Key Stats - Enhanced */}
                <div className="grid grid-cols-3 gap-4 pt-2">
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-600 group-hover:bg-indigo-200 group-hover:text-indigo-700 transition-colors">
                        <Users className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Teams</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">{dashboardData.totalTeams}</p>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 hover:border-violet-100 hover:bg-violet-50/30 transition-all group">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-1.5 rounded-lg bg-violet-100 text-violet-600 group-hover:bg-violet-200 group-hover:text-violet-700 transition-colors">
                        <Layers className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Phases</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">{dashboardData.totalPhases}</p>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 hover:border-cyan-100 hover:bg-cyan-50/30 transition-all group">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-1.5 rounded-lg bg-cyan-100 text-cyan-600 group-hover:bg-cyan-200 group-hover:text-cyan-700 transition-colors">
                        <ClipboardList className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Panels</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">{dashboardData.activePanels}</p>
                  </div>
                </div>

                {activeSession.description && (
                  <div className="bg-slate-50/50 rounded-lg p-3 text-sm text-slate-600 border border-slate-100 italic">
                    "{activeSession.description}"
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4 border border-slate-200">
                  <Calendar className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-1">No Active Session</h3>
                <p className="text-slate-500 mb-6 max-w-sm mx-auto">Configure a new academic session to start managing teams and phases.</p>
                <Button onClick={() => onNavigate('sessions')} className="bg-brand-gradient hover:opacity-90 transition-opacity">
                  Create New Session
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions Only - Activity Summary Removed */}
        <div className="space-y-6 lg:col-span-2">
          {/* Quick Actions */}
          <Card className="border-0 card-elevated h-full">
            <CardHeader className="pb-4 border-b border-slate-50">
              <CardTitle className="text-lg font-semibold text-slate-800">Quick Actions</CardTitle>
              <CardDescription>Frequent management tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.tab}
                    onClick={() => onNavigate(action.tab)}
                    className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-white hover:border-indigo-100 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm group-hover:border-indigo-200 group-hover:text-indigo-600 transition-colors">
                        <Icon className="h-5 w-5 text-slate-500 group-hover:text-indigo-600 transition-colors" />
                      </div>
                      <div className="text-left">
                        <span className="block text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">{action.label}</span>
                        <span className="block text-xs text-slate-400 group-hover:text-slate-500">Manage {action.label.toLowerCase().replace('manage ', '').replace('view ', '')}</span>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-transparent flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                      <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

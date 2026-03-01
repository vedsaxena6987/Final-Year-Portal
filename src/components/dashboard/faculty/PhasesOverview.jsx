"use client";

import { useState, useEffect } from 'react';
import { useSession } from '@/context/SessionContext';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, AlertCircle, Users, CalendarClock } from 'lucide-react';
import { format, isBefore, isAfter } from 'date-fns';
import PhaseTeamsView from './PhaseTeamsView';
import ScheduleMeeting from './ScheduleMeeting';
import MeetingsList from './MeetingsList';
import MentorStatusBadge from './MentorStatusBadge';

import { logger } from "../../../lib/logger";
export default function PhasesOverview({ defaultView = 'evaluation' }) {
  const { activeSession } = useSession();
  const { user } = useAuth();
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [activeTab, setActiveTab] = useState(defaultView); // 'evaluation' or 'meetings'

  // Fetch all phases for the active session
  useEffect(() => {
    const fetchPhases = async () => {
      if (!activeSession?.id) return;

      try {
        const phasesRef = collection(db, 'phases');
        const phasesQuery = query(
          phasesRef,
          where('sessionId', '==', activeSession.id),
          orderBy('startDate', 'asc')
        );

        const phasesSnapshot = await getDocs(phasesQuery);
        const phasesData = phasesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setPhases(phasesData);
        
        // Set first phase as default selected
        if (phasesData.length > 0 && !selectedPhase) {
          setSelectedPhase(phasesData[0].id);
        }
      } catch (error) {
        logger.error('Error fetching phases:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPhases();
  }, [activeSession?.id]);

  // Check if phase is active
  const isPhaseActive = (phase) => {
    if (!phase.startDate || !phase.endDate) return false;
    const now = new Date();
    const start = phase.startDate.toDate();
    const end = phase.endDate.toDate();
    return isAfter(now, start) && isBefore(now, end);
  };

  // Get phase status
  const getPhaseStatus = (phase) => {
    if (!phase.startDate || !phase.endDate) {
      return { 
        text: 'No Dates', 
        color: 'gray', 
        icon: Clock,
        gradient: 'from-gray-500 to-slate-500',
        bgGradient: 'from-gray-50 to-slate-50/30',
        borderColor: 'border-gray-300'
      };
    }

    const now = new Date();
    const start = phase.startDate.toDate();
    const end = phase.endDate.toDate();

    // Use date-only comparison for better UX
    // A phase is active if today's date is between start and end (inclusive)
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    
    const startDay = new Date(start);
    startDay.setHours(0, 0, 0, 0);
    
    const endDay = new Date(end);
    endDay.setHours(23, 59, 59, 999);

    if (todayStart < startDay) {
      return { 
        text: 'Upcoming', 
        color: 'blue', 
        icon: Clock,
        gradient: 'from-blue-500 to-cyan-500',
        bgGradient: 'from-blue-50 to-cyan-50/30',
        borderColor: 'border-blue-300'
      };
    } else if (todayStart > endDay) {
      return { 
        text: 'Completed', 
        color: 'gray', 
        icon: Clock,
        gradient: 'from-gray-500 to-slate-500',
        bgGradient: 'from-gray-50 to-slate-50/30',
        borderColor: 'border-gray-300'
      };
    } else {
      return { 
        text: 'Active', 
        color: 'green', 
        icon: AlertCircle,
        gradient: 'from-green-500 to-emerald-500',
        bgGradient: 'from-green-50 to-emerald-50/30',
        borderColor: 'border-green-300'
      };
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (phases.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 bg-white border border-gray-200 rounded-lg">
        <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
        <p className="text-xs font-medium">No phases created</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Compact Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-teal-500 rounded-full" />
            <h2 className="text-lg font-semibold text-gray-900">Phases</h2>
            <Badge className="bg-gray-100 text-gray-700 text-xs">
              {phases.length} total
            </Badge>
          </div>
        </div>
      </div>

      {/* Horizontal Scrollable Timeline */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-teal-600" />
          Select Phase to View Details
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          {phases.map((phase) => {
            const status = getPhaseStatus(phase);
            const StatusIcon = status.icon;
            const isActive = isPhaseActive(phase);
            const isSelected = selectedPhase === phase.id;

            return (
              <button
                key={phase.id}
                onClick={() => setSelectedPhase(phase.id)}
                className={`
                  flex-shrink-0 w-56 p-4 rounded-xl border-2 transition-all duration-200
                  ${isSelected 
                    ? 'border-teal-500 bg-gradient-to-br from-teal-50 to-teal-100/50 shadow-lg scale-105' 
                    : 'border-gray-200 bg-white hover:border-teal-300 hover:shadow-md hover:scale-102'}
                `}
              >
                {/* Phase Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-gray-900 truncate mb-1">
                      {phase.phaseName || phase.name}
                    </h4>
                    {/* Status Badge */}
                    <Badge className={`text-xs px-2 py-0.5 ${
                      status.color === 'green' ? 'bg-green-100 text-green-700 border-green-300' :
                      status.color === 'blue' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                      'bg-gray-100 text-gray-600 border-gray-300'
                    } border`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {status.text}
                    </Badge>
                  </div>
                  {isActive && (
                    <div className="relative ml-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                      <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-400 animate-ping" />
                    </div>
                  )}
                </div>

                {/* Phase Info */}
                <div className="space-y-2">
                  {/* Dates */}
                  <div className="bg-white/60 rounded-lg p-2 space-y-1.5 text-xs">
                    {phase.startDate && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="h-3.5 w-3.5 text-blue-500" />
                        <span className="font-medium">Start:</span>
                        <span className="font-semibold">{format(phase.startDate.toDate(), 'MMM dd, yyyy')}</span>
                      </div>
                    )}
                    {phase.endDate && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                        <span className="font-medium">End:</span>
                        <span className="font-semibold">{format(phase.endDate.toDate(), 'MMM dd, yyyy')}</span>
                      </div>
                    )}
                  </div>

                  {/* Max Marks */}
                  <div className="bg-gradient-to-r from-teal-50 to-teal-100 rounded-lg p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">Max Marks:</span>
                      <span className="text-base font-bold text-teal-700">{phase.maxMarks}</span>
                    </div>
                  </div>

                  {/* Phase Type */}
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3 w-3 text-gray-500" />
                    <span className="text-xs text-gray-600">
                      {phase.phaseType === 'mentor' ? 'Mentor Evaluation' : 'Panel Evaluation'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Phase Content with Tabs */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {selectedPhase && phases.find(p => p.id === selectedPhase) ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Tab Headers */}
            <div className="border-b bg-gray-50/50 px-4 py-3">
              <TabsList className="grid w-full max-w-lg grid-cols-2 bg-white border border-gray-200">
                <TabsTrigger 
                  value="evaluation" 
                  className="flex items-center gap-1 sm:gap-2 data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 px-2 sm:px-3"
                >
                  <Users className="h-4 w-4 shrink-0" />
                  <span className="font-medium text-xs sm:text-sm truncate">Evaluation</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="meetings" 
                  className="flex items-center gap-1 sm:gap-2 data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 px-2 sm:px-3"
                >
                  <CalendarClock className="h-4 w-4 shrink-0" />
                  <span className="font-medium text-xs sm:text-sm">Meetings</span>
                  {phases.find(p => p.id === selectedPhase)?.phaseType === 'mentor' && (
                    <MentorStatusBadge 
                      phaseId={selectedPhase} 
                      facultyId={user?.uid} 
                    />
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Evaluation Tab */}
            <TabsContent value="evaluation" className="p-4 m-0">
              <PhaseTeamsView phase={phases.find(p => p.id === selectedPhase)} />
            </TabsContent>

            {/* Meetings Tab */}
            <TabsContent value="meetings" className="p-4 m-0 space-y-6">
              {/* Schedule New Meeting */}
              <Card className="border-teal-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-teal-700">
                    <CalendarClock className="h-5 w-5" />
                    Schedule New Meeting
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScheduleMeeting phase={phases.find(p => p.id === selectedPhase)} />
                </CardContent>
              </Card>

              {/* Meetings List */}
              <Card className="border-teal-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-teal-700">
                    <Calendar className="h-5 w-5" />
                    Your Scheduled Meetings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <MeetingsList phaseId={selectedPhase} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">Select a phase to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

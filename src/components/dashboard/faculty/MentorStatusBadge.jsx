"use client";

import { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';

import { logger } from "../../../lib/logger";
/**
 * MentorStatusBadge - Shows meeting status for mentor phases
 * Green: At least one meeting completed
 * Yellow: Meeting scheduled but not yet happened
 * Red: No meeting called yet
 */
export default function MentorStatusBadge({ phaseId, facultyId }) {
  const [status, setStatus] = useState('loading'); // 'loading', 'completed', 'scheduled', 'not-called'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!phaseId || !facultyId) return;

    const checkMeetingStatus = async () => {
      try {
        // Query meetings for this phase by this faculty
        const q = query(
          collection(db, 'meetings'),
          where('phaseId', '==', phaseId),
          where('facultyId', '==', facultyId)
        );

        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          // No meetings scheduled
          setStatus('not-called');
        } else {
          // Check if any meeting has happened (completed or past date)
          const now = new Date();
          let hasCompleted = false;
          let hasScheduled = false;

          snapshot.docs.forEach(doc => {
            const meeting = doc.data();
            const meetingDate = meeting.scheduledDate?.toDate();
            
            if (meeting.status === 'completed' || (meetingDate && meetingDate < now)) {
              hasCompleted = true;
            } else if (meeting.status === 'upcoming' && meetingDate && meetingDate > now) {
              hasScheduled = true;
            }
          });

          if (hasCompleted) {
            setStatus('completed');
          } else if (hasScheduled) {
            setStatus('scheduled');
          } else {
            setStatus('not-called');
          }
        }
      } catch (error) {
        logger.error('Error checking meeting status:', error);
        setStatus('not-called');
      } finally {
        setLoading(false);
      }
    };

    checkMeetingStatus();
  }, [phaseId, facultyId]);

  if (loading) {
    return (
      <Badge variant="outline" className="text-xs">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Checking...
      </Badge>
    );
  }

  switch (status) {
    case 'completed':
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-green-300">
          <CheckCircle className="h-3 w-3 mr-1" />
          Met
        </Badge>
      );
    
    case 'scheduled':
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-300">
          <Clock className="h-3 w-3 mr-1" />
          Scheduled
        </Badge>
      );
    
    case 'not-called':
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-red-300">
          <AlertCircle className="h-3 w-3 mr-1" />
          Not Called
        </Badge>
      );
    
    default:
      return null;
  }
}

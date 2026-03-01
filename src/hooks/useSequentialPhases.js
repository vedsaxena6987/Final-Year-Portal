// hooks/useSequentialPhases.js
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

import { logger } from "../lib/logger";
/**
 * Custom hook to manage sequential phase submission logic
 * Determines which phases are locked/active/completed based on submission status
 * 
 * @param {string} teamId - Team ID
 * @param {string} sessionId - Current session ID
 * @returns {Object} { phases, submissions, currentPhase, completedCount, loading, error }
 */
export function useSequentialPhases(teamId, sessionId) {
  const [phases, setPhases] = useState([]);
  const [submissions, setSubmissions] = useState({});
  const [currentPhase, setCurrentPhase] = useState(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!teamId || !sessionId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch all phases for session (ordered by sequence)
        const phasesQuery = query(
          collection(db, "phases"),
          where("sessionId", "==", sessionId),
          where("isActive", "==", true),
          orderBy("sequenceOrder", "asc")
        );
        const phasesSnap = await getDocs(phasesQuery);
        const phasesList = phasesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          startDate: doc.data().startDate?.toDate(),
          endDate: doc.data().endDate?.toDate(),
          createdAt: doc.data().createdAt?.toDate()
        }));

        // Fetch all team submissions
        const submissionsQuery = query(
          collection(db, "submissions"),
          where("teamId", "==", teamId),
          where("sessionId", "==", sessionId)
        );
        const submissionsSnap = await getDocs(submissionsQuery);
        const submissionsMap = {};
        
        submissionsSnap.docs.forEach(doc => {
          const data = doc.data();
          submissionsMap[data.phaseId] = {
            id: doc.id,
            ...data,
            submittedAt: data.submittedAt?.toDate(),
            evaluatedAt: data.evaluatedAt?.toDate(),
            resubmittedAt: data.resubmittedAt?.toDate()
          };
        });

        // Determine phase states and check if deadline has passed
        const now = new Date();
        let completed = 0;
        let activePhaseFound = null;

        const enrichedPhases = phasesList.map((phase, index) => {
          const submission = submissionsMap[phase.id];
          const isSubmitted = !!submission;
          const isEvaluated = submission?.evaluationStatus === 'evaluated';
          const isDeadlinePassed = phase.endDate && now > phase.endDate;
          const isStarted = phase.startDate && now >= phase.startDate;
          
          // Phase is unlocked if:
          // 1. It's the first phase, OR
          // 2. Previous phase is evaluated
          const previousPhase = index > 0 ? phasesList[index - 1] : null;
          const previousSubmission = previousPhase ? submissionsMap[previousPhase.id] : null;
          const isPreviousEvaluated = !previousPhase || previousSubmission?.evaluationStatus === 'evaluated';
          
          const isUnlocked = isPreviousEvaluated && isStarted;

          // Determine phase status
          let status;
          if (isEvaluated) {
            status = 'completed';
            completed++;
          } else if (isSubmitted) {
            status = 'submitted';
          } else if (!isStarted) {
            status = 'upcoming';
          } else if (!isUnlocked) {
            status = 'locked';
          } else if (isDeadlinePassed && !phase.allowLateSubmission) {
            status = 'expired';
          } else {
            status = 'active';
            if (!activePhaseFound) {
              activePhaseFound = { ...phase, status, isUnlocked, submission, isDeadlinePassed };
            }
          }

          return {
            ...phase,
            status,
            isUnlocked,
            isDeadlinePassed,
            isStarted,
            submission,
            canSubmit: status === 'active' || (status === 'submitted' && submission?.evaluationStatus === 'revisions_requested')
          };
        });

        setPhases(enrichedPhases);
        setSubmissions(submissionsMap);
        setCurrentPhase(activePhaseFound);
        setCompletedCount(completed);
        setError(null);
      } catch (err) {
        logger.error('Error fetching sequential phases:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [teamId, sessionId]);

  /**
   * Get the next phase that needs attention
   */
  const getNextPhase = () => {
    return phases.find(p => p.status === 'active' || p.status === 'submitted');
  };

  /**
   * Get progress percentage
   */
  const getProgressPercentage = () => {
    if (phases.length === 0) return 0;
    return Math.round((completedCount / phases.length) * 100);
  };

  /**
   * Check if team has completed all phases
   */
  const isAllPhasesCompleted = () => {
    return phases.length > 0 && completedCount === phases.length;
  };

  /**
   * Get phase by ID with status
   */
  const getPhaseById = (phaseId) => {
    return phases.find(p => p.id === phaseId);
  };

  return {
    phases,
    submissions,
    currentPhase,
    completedCount,
    loading,
    error,
    // Helper methods
    getNextPhase,
    getProgressPercentage,
    isAllPhasesCompleted,
    getPhaseById
  };
}

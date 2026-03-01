// hooks/useMeetingStats.js
import { useState, useEffect } from 'react';
import MeetingStatsService from '@/services/meetingStatsService';
import { canEvaluateTeam } from '@/lib/phaseSchema';

import { logger } from "../lib/logger";
/**
 * Hook to get meeting statistics for a team and phase
 * Useful for checking if panel phase requirements are met
 */
export function useMeetingStats(teamId, phaseId) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!teamId || !phaseId) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const fetchStats = async () => {
      try {
        setLoading(true);
        const meetingStats = await MeetingStatsService.getTeamMeetingStats(teamId, phaseId);
        
        if (mounted) {
          setStats(meetingStats);
          setError(null);
        }
      } catch (err) {
        logger.error('Error fetching meeting stats:', err);
        if (mounted) {
          setError(err.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchStats();

    return () => {
      mounted = false;
    };
  }, [teamId, phaseId]);

  return { stats, loading, error };
}

/**
 * Hook to check if team meets phase requirements (for panel phases)
 */
export function usePhaseEligibility(teamId, phase) {
  const [eligibility, setEligibility] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId || !phase?.id) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const checkEligibility = async () => {
      try {
        setLoading(true);

        // For mentor phases, no meeting requirements
        if (phase.phaseType !== 'panel' || !phase.minPanelistsMeetRequired) {
          if (mounted) {
            setEligibility({
              eligible: true,
              panelistsMet: 0,
              minRequired: 0,
              reason: 'No meeting requirements',
              meetingStats: null
            });
          }
          setLoading(false);
          return;
        }

        // For panel phases, check meeting count
        const panelistsMet = await MeetingStatsService.getPanelistsMeetCount(teamId, phase.id);
        const evaluationCheck = canEvaluateTeam(phase, panelistsMet);

        if (mounted) {
          setEligibility({
            eligible: evaluationCheck.canEvaluate,
            panelistsMet,
            minRequired: phase.minPanelistsMeetRequired,
            remaining: evaluationCheck.missingMeetings,
            reason: evaluationCheck.reason
          });
        }
      } catch (err) {
        logger.error('Error checking phase eligibility:', err);
        if (mounted) {
          setEligibility({
            eligible: false,
            panelistsMet: 0,
            minRequired: phase.minPanelistsMeetRequired || 0,
            remaining: phase.minPanelistsMeetRequired || 0,
            reason: 'Error checking requirements'
          });
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkEligibility();

    return () => {
      mounted = false;
    };
  }, [teamId, phase]);

  return { eligibility, loading };
}

/**
 * Hook to get panelist meet count (lightweight version)
 */
export function usePanelistsMeetCount(teamId, phaseId) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId || !phaseId) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const fetchCount = async () => {
      try {
        const meetCount = await MeetingStatsService.getPanelistsMeetCount(teamId, phaseId);
        if (mounted) {
          setCount(meetCount);
        }
      } catch (err) {
        logger.error('Error fetching panelists count:', err);
        if (mounted) {
          setCount(0);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchCount();

    return () => {
      mounted = false;
    };
  }, [teamId, phaseId]);

  return { count, loading };
}

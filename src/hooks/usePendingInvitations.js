import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

import { logger } from "../lib/logger";
/**
 * Custom hook to get pending invitations count for a team
 * Returns the count of pending join requests
 */
export function usePendingInvitations(teamId) {
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) {
      setPendingCount(0);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'team_invitations'),
      where('teamId', '==', teamId),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setPendingCount(snapshot.size);
        setLoading(false);
      },
      (error) => {
        // Silently handle permission errors (student might not have access to team_invitations)
        if (error.code !== 'permission-denied') {
          logger.error('Error fetching pending invitations count:', error);
        }
        setPendingCount(0);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [teamId]);

  return { pendingCount, loading };
}

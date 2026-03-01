// hooks/useTeamData.js
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

import { logger } from "../lib/logger";
export function useTeamData() {
  const { userData } = useAuth();
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData?.teamId) {
      setLoading(false);
      return;
    }

    const teamRef = doc(db, 'teams', userData.teamId);

    // Use onSnapshot for real-time updates with error handling
    const unsubscribe = onSnapshot(
      teamRef, 
      async (teamDoc) => {
      if (teamDoc.exists()) {
        const teamData = {
          id: teamDoc.id, // Include the document ID
          ...teamDoc.data()
        };
        setTeam(teamData);

        // Fetch details for each member (normalize email to lowercase)
        const memberPromises = teamData.members.map(memberEmail => {
          // CRITICAL: Normalize email to lowercase (users collection keys are lowercase)
          const normalizedEmail = memberEmail.toLowerCase();
          return getDoc(doc(db, 'users', normalizedEmail));
        });
        const memberDocs = await Promise.all(memberPromises);
        
        // Filter out undefined/missing members and add email as fallback
        const memberData = memberDocs
          .map((memberDoc, index) => {
            if (memberDoc.exists()) {
              return memberDoc.data();
            } else {
              // Member document not found - return placeholder with email
              logger.warn(`Member not found in users collection: ${teamData.members[index]}`);
              return {
                email: teamData.members[index].toLowerCase(),
                name: teamData.members[index].split('@')[0],
                uid: null,
                isMissing: true
              };
            }
          })
          .filter(Boolean); // Remove any null/undefined entries
        
        setMembers(memberData);
      } else {
        setTeam(null);
        setMembers([]);
      }
      setLoading(false);
    },
    (error) => {
      if (error.code === 'unavailable') {
        logger.warn('⚠️ useTeamData: Network unavailable, will retry automatically');
      } else if (error.code !== 'permission-denied') {
        logger.error('❌ useTeamData: Error loading team:', error);
      }
      setLoading(false);
    }
    );

    return () => unsubscribe(); // Cleanup listener on unmount
  }, [userData?.teamId]);

  return { team, members, loading };
}

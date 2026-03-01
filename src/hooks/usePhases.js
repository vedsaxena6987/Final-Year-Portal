// hooks/usePhases.js
"use client";

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

import { logger } from "../lib/logger";
/**
 * Custom hook to fetch phases with real-time updates
 * @param {string} sessionId - Optional session ID to filter phases
 * @param {boolean} activeOnly - Optional flag to fetch only active phases
 * @returns {Object} { phases, loading, error }
 */
export function usePhases(sessionId = null, activeOnly = false) {
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // Wait for auth before setting up listeners
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthReady(!!user);
      if (!user) {
        setPhases([]);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Don't query if auth not ready
    if (!authReady) {
      return;
    }

    try {
      // Build query with optional filters
      let q = query(collection(db, "phases"), orderBy("sequenceOrder", "asc"));
      
      // Add session filter if provided
      if (sessionId) {
        q = query(
          collection(db, "phases"),
          where("sessionId", "==", sessionId),
          orderBy("sequenceOrder", "asc")
        );
      }

      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const phasesList = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              phaseName: data.phaseName || data.title, // Support legacy 'title' field
              description: data.description || '',
              startDate: data.startDate?.toDate() || null,
              endDate: data.endDate?.toDate() || null,
              maxMarks: data.maxMarks || 100,
              evaluatorRole: data.evaluatorRole || 'mentor',
              sequenceOrder: data.sequenceOrder || 0,
              sessionId: data.sessionId || null,
              allowLateSubmission: data.allowLateSubmission || false,
              isActive: data.isActive !== false, // Default to true
              createdAt: data.createdAt?.toDate() || null,
              createdBy: data.createdBy || null,
              updatedAt: data.updatedAt?.toDate() || null,
              // Legacy support
              title: data.title || data.phaseName,
              name: data.phaseName || data.title
            };
          });

          // Filter active phases if requested
          const filteredPhases = activeOnly 
            ? phasesList.filter(p => p.isActive) 
            : phasesList;

          setPhases(filteredPhases);
          setLoading(false);
          setError(null);
        },
        (err) => {
          if (err.code === 'unavailable') {
            logger.warn('⚠️ usePhases: Network unavailable, will retry automatically');
            setLoading(false);
          } else if (err.code === 'permission-denied') {
            logger.error('❌ usePhases: Permission denied:', err.message);
            setError(err.message);
            setLoading(false);
          } else {
            logger.error('❌ Error fetching phases:', err);
            setError(err.message);
            setLoading(false);
          }
        }
      );

      return () => unsubscribe();
    } catch (err) {
      logger.error('Error setting up phases listener:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [sessionId, activeOnly, authReady]);

  return { phases, loading, error };
}

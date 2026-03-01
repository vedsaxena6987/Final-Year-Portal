// hooks/useStudentGrades.js
"use client";

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '@/context/AuthContext';

import { logger } from "../lib/logger";
export function useStudentGrades() {
  const { user } = useAuth();
  const [grades, setGrades] = useState([]);
  const [absentGrades, setAbsentGrades] = useState([]); // Track absent statuses separately
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  // Wait for auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthReady(!!user);
      if (!user) {
        setGrades([]);
        setAbsentGrades([]);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
        setLoading(false);
        return;
    };

    // Query by studentEmail (more reliable than studentId)
    const q = query(
      collection(db, "grades"), 
      where("studentEmail", "==", user.email)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const gradesList = [];
      const absentList = [];
      
      for (const gradeDoc of snapshot.docs) {
        const gradeData = { id: gradeDoc.id, ...gradeDoc.data() };

        // Fetch the phase details for each grade
        const phaseDoc = await getDoc(doc(db, "phases", gradeData.phaseId));
        if (phaseDoc.exists()) {
          const phaseData = phaseDoc.data();
          gradeData.phase = phaseData;
          
          // Check if marks are visible for this phase
          gradeData.marksVisible = phaseData.marksVisible !== false;
        }
        
        // If marked absent, always add to absentList (regardless of marksVisible)
        if (gradeData.isAbsent) {
          absentList.push(gradeData);
        }
        
        // Only add grades to visible list if marks are visible
        if (gradeData.marksVisible !== false) {
          gradesList.push(gradeData);
        }
      }
      setGrades(gradesList);
      setAbsentGrades(absentList);
      setLoading(false);
    }, (error) => {
      if (error.code === 'unavailable') {
        logger.warn('⚠️ useStudentGrades: Network unavailable, will retry automatically');
      } else if (error.code !== 'permission-denied') {
        logger.error('❌ useStudentGrades: Error loading grades:', error);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authReady]);

  return { grades, absentGrades, loading };
}

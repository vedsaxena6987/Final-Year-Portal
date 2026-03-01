// context/SessionContext.js
"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import logger from '@/lib/logger';

const SessionContext = createContext();

export const SessionProvider = ({ children }) => {
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Wait for auth to be ready before querying sessions
  useEffect(() => {
    logger.debug('SessionContext: Waiting for auth state...');
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      logger.debug('SessionContext: Auth state changed, user:', user?.email || 'null');
      setCurrentUser(user);
      setAuthReady(true);
      
      // If user logged out, clear session immediately
      if (!user) {
        logger.debug('SessionContext: User logged out, clearing session');
        setActiveSession(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    // Don't set up listener if user is not authenticated
    if (!authReady || !currentUser) {
      return;
    }

    let unsubscribe = null;

    // Add a small delay to ensure auth token is fully propagated
    const timer = setTimeout(() => {
      
      // Listen for active session changes
      const q = query(collection(db, "sessions"), where("isActive", "==", true));
      unsubscribe = onSnapshot(q, (querySnapshot) => {
        
        if (querySnapshot.size > 0) {
          querySnapshot.docs.forEach(doc => {
          });
        }
        
        if (querySnapshot.empty) {
          setActiveSession(null);
        } else {
          // Should only be one active session
          const sessionDoc = querySnapshot.docs[0];
          const sessionData = {
            id: sessionDoc.id,
            ...sessionDoc.data(),
            startDate: sessionDoc.data().startDate?.toDate(),
            endDate: sessionDoc.data().endDate?.toDate(),
            createdAt: sessionDoc.data().createdAt?.toDate()
          };
          logger.debug('SessionContext: Active session found:', sessionData);
          setActiveSession(sessionData);
        }
        setLoading(false);
      }, (error) => {
        // Handle permission errors gracefully during logout
        if (error.code === 'permission-denied') {
          logger.debug('SessionContext: Permission denied (likely due to logout), clearing session');
          setActiveSession(null);
          setLoading(false);
        } else if (error.code === 'unavailable') {
          // Network error - keep current session and retry automatically
          logger.warn('⚠️ SessionContext: Network unavailable, will retry automatically');
          setLoading(false);
        } else {
          logger.error('❌ SessionContext: Error listening to sessions:', error);
          logger.error('Error details:', error.code, error.message);
          setLoading(false);
        }
      });
    }, 500); // 500ms delay

    return () => {
      logger.debug('SessionContext: Cleaning up listener');
      clearTimeout(timer);
      // Only unsubscribe if the function was created
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (error) {
          // Ignore errors during cleanup (user might be logged out)
          logger.debug('SessionContext: Error during cleanup (ignored):', error.message);
        }
      }
    };
  }, [authReady, currentUser]);

  return (
    <SessionContext.Provider value={{ activeSession, loading }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

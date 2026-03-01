// context/AuthContext.js (Updated with Real-time Listener)
"use client";

import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { logger } from '@/lib/logger';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // This is the auth user
  const [userData, setUserData] = useState(null); // This is the Firestore user data
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUserDoc = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      // Cleanup previous user document listener if exists
      if (unsubscribeUserDoc) {
        try {
          unsubscribeUserDoc();
        } catch (error) {
          logger.debug('AuthContext: Error during previous listener cleanup (ignored):', error.message);
        }
        unsubscribeUserDoc = null;
      }

      if (user) {
        try {
          // Use onSnapshot for real-time updates to user document
          const userDocRef = doc(db, 'users', user.email);
          unsubscribeUserDoc = onSnapshot(userDocRef, 
            (userDoc) => {
              if (userDoc.exists()) {
                const data = userDoc.data();
                
                setUserData(data);
              } else {
                logger.warn('User document not found for:', user.email);
                setUserData(null);
              }
              setLoading(false);
            },
            (error) => {
              // Handle permission errors gracefully during logout
              if (error.code === 'permission-denied') {
                logger.debug('AuthContext: Permission denied (likely due to logout), clearing user data');
                setUserData(null);
                setLoading(false);
              } else if (error.code === 'unavailable') {
                // Network error - keep current userData and retry automatically
                logger.warn('⚠️ AuthContext: Network unavailable, will retry automatically');
                setLoading(false);
              } else {
                logger.error('❌ Error fetching user data:', error);
                setUserData(null);
                setLoading(false);
              }
            }
          );
        } catch (error) {
          logger.error('Error setting up user data listener:', error);
          setUserData(null);
          setLoading(false);
        }
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    // Cleanup both listeners
    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) {
        try {
          unsubscribeUserDoc();
        } catch (error) {
          // Ignore errors during cleanup (user might be logged out)
          logger.debug('AuthContext: Error during cleanup (ignored):', error.message);
        }
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

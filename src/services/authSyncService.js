// services/authSyncService.js
"use client";

import { auth, db } from '@/lib/firebase';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp 
} from 'firebase/firestore';

import { logger } from "../lib/logger";
/**
 * AuthSyncService - Handles synchronization between Firebase Auth and Firestore
 * 
 * Primary use cases:
 * 1. Create Auth accounts for CSV-imported users
 * 2. Sync Auth UIDs to Firestore user documents
 * 3. Check if user has Auth account
 * 4. Handle first-time login for imported users
 */
export class AuthSyncService {
  
  /**
   * Check if a user exists in Firestore (by email)
   * @param {string} email - User's email address
   * @returns {Promise<Object|null>} User data if exists, null otherwise
   */
  static async checkUserExistsInFirestore(email) {
    try {
      const userRef = doc(db, 'users', email);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        return { id: userDoc.id, ...userDoc.data() };
      }
      return null;
    } catch (error) {
      logger.error('Error checking user in Firestore:', error);
      return null;
    }
  }
  
  /**
   * Check if a user has a Firebase Auth account
   * Uses Firestore flag to avoid quota limits - only checks Auth API if needed
   * @param {string} email - User's email address
   * @returns {Promise<boolean>} True if Auth account exists
   */
  static async checkAuthAccountExists(email) {
    try {
      // First check Firestore flag (no quota limit)
      const userData = await this.checkUserExistsInFirestore(email);
      if (userData && userData.hasAuthAccount && userData.uid && userData.uid !== email) {
        // Trust the Firestore flag if it's set and has a valid UID
        return true;
      }
      
      // If flag is not set or missing UID, we don't know for sure
      // Return false to allow creation attempt (createUserWithEmailAndPassword will catch duplicates)
      return false;
    } catch (error) {
      logger.error('Error checking Auth account:', error);
      return false;
    }
  }
  
  /**
   * Create Firebase Auth account for a single user
   * IMPORTANT: This method will sign in as the new user temporarily, then sign out.
   * The calling code (bulkCreateAuthAccounts) must re-authenticate the admin after this.
   * @param {string} email - User's email
   * @param {string} password - Password for the account
   * @param {string} adminEmail - Admin's email for re-authentication
   * @param {string} adminPassword - Admin's password for re-authentication
   * @returns {Promise<Object>} Result with success status and uid
   */
  static async createAuthAccountForUser(email, password = this.DEFAULT_PASSWORD, adminEmail = null, adminPassword = null) {
    try {
      // Create Auth account (this will sign in as the new user automatically)
      // We don't check Firestore first because that would require permissions
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const authUser = userCredential.user;
      
      // Sync UID to Firestore while signed in as the new user
      const syncResult = await this.syncAuthUidToFirestore(email, authUser.uid);
      
      // Sign out the new user immediately (admin will re-auth in bulk operations)
      await auth.signOut();
      
      if (!syncResult.success) {
        return {
          success: false,
          error: 'Auth account created but failed to sync UID to Firestore: ' + syncResult.error,
          email,
          partialSuccess: true,
          uid: authUser.uid
        };
      }
      
      return {
        success: true,
        uid: authUser.uid,
        email: authUser.email,
        message: 'Auth account created successfully'
      };
    } catch (error) {
      logger.error(`Error creating Auth account for ${email}:`, error);
      
      // Handle specific error codes
      if (error.code === 'auth/email-already-in-use') {
        // Try to update Firestore with existing account
        try {
          // Get the user to find their UID
          const methods = await fetchSignInMethodsForEmail(auth, email);
          if (methods.length > 0) {
            // Account exists, try to get UID by signing in
            try {
              const cred = await signInWithEmailAndPassword(auth, email, password);
              await this.syncAuthUidToFirestore(email, cred.user.uid);
              await auth.signOut();
              
              return {
                success: false,
                error: 'Auth account already exists (synced UID)',
                errorCode: 'auth/account-exists',
                email,
                skipped: true
              };
            } catch (e) {
              // Can't sign in, just mark as skipped
            }
          }
        } catch (e) {
          logger.error('Error syncing existing account:', e);
        }
        
        return {
          success: false,
          error: 'Auth account already exists',
          errorCode: 'auth/email-already-in-use',
          email,
          skipped: true
        };
      }
      
      return {
        success: false,
        error: error.message,
        errorCode: error.code,
        email
      };
    }
  }
  
  /**
   * Sync Firebase Auth UID to Firestore user document
   * Also updates team references if user is a team leader or mentor
   * @param {string} email - User's email
   * @param {string} uid - Firebase Auth UID
   * @returns {Promise<Object>} Result with success status
   */
  static async syncAuthUidToFirestore(email, uid) {
    try {
      const userRef = doc(db, 'users', email);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        return { success: false, error: 'User document not found', email };
      }

      const userData = userDoc.data();
      const oldUid = userData.uid;
      
      // Update user document
      await updateDoc(userRef, {
        uid: uid,
        hasAuthAccount: true,
        authCreatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // If UID changed from placeholder (email) to real UID, update team references
      if (oldUid && oldUid !== uid) {
        const batch = writeBatch(db);
        
        // Update teams where this user is the leader
        const leaderTeamsQuery = query(
          collection(db, 'teams'),
          where('leaderId', '==', oldUid)
        );
        const leaderTeams = await getDocs(leaderTeamsQuery);
        leaderTeams.forEach(teamDoc => {
          batch.update(doc(db, 'teams', teamDoc.id), {
            leaderId: uid,
            updatedAt: serverTimestamp()
          });
        });
        
        // Update teams where this user is the mentor
        const mentorTeamsQuery = query(
          collection(db, 'teams'),
          where('mentorId', '==', oldUid)
        );
        const mentorTeams = await getDocs(mentorTeamsQuery);
        mentorTeams.forEach(teamDoc => {
          batch.update(doc(db, 'teams', teamDoc.id), {
            mentorId: uid,
            updatedAt: serverTimestamp()
          });
        });
        
        // Commit batch updates
        if (leaderTeams.size > 0 || mentorTeams.size > 0) {
          await batch.commit();
        }
      }
      
      return { success: true, email, uid };
    } catch (error) {
      logger.error(`Error syncing UID for ${email}:`, error);
      return { success: false, error: error.message, email };
    }
  }
  
  /**
   * Bulk create Auth accounts for multiple users
   * @param {Array<string>} emails - Array of user emails
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Summary of creation results
   */
  static async bulkCreateAuthAccounts(emails, progressCallback = null) {
    const results = {
      total: emails.length,
      successful: [],
      failed: [],
      skipped: []
    };
    
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      
      // Progress update
      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total: emails.length,
          email: email,
          percentage: Math.round(((i + 1) / emails.length) * 100)
        });
      }
      
      const result = await this.createAuthAccountForUser(email);
      
      if (result.success) {
        results.successful.push({ email, uid: result.uid });
      } else if (result.skipped || result.errorCode === 'auth/account-exists' || result.errorCode === 'auth/email-already-in-use') {
        // Account already exists - add to skipped
        results.skipped.push({ email, reason: result.error || 'Auth account already exists' });
      } else {
        results.failed.push({ email, error: result.error, errorCode: result.errorCode });
      }
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }
  
  /**
   * Get all users without Auth accounts (for admin dashboard)
   * @param {string} sessionId - Optional session filter
   * @returns {Promise<Array>} List of users without Auth accounts
   */
  static async getUsersWithoutAuthAccounts(sessionId = null) {
    try {
      let q = query(
        collection(db, 'users'),
        where('hasAuthAccount', '==', false)
      );
      
      // Add session filter if provided
      if (sessionId) {
        q = query(
          collection(db, 'users'),
          where('hasAuthAccount', '==', false),
          where('sessionId', '==', sessionId)
        );
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logger.error('Error fetching users without Auth accounts:', error);
      return [];
    }
  }
  
  /**
   * Update existing Auth UID in Firestore (fix mismatches)
   * @param {string} email - User's email
   * @param {string} correctUid - Correct Firebase Auth UID
   * @returns {Promise<Object>} Result with success status
   */
  static async fixUidMismatch(email, correctUid) {
    try {
      // Get current Firestore data
      const userData = await this.checkUserExistsInFirestore(email);
      if (!userData) {
        return { 
          success: false, 
          error: 'User not found in Firestore' 
        };
      }
      
      const oldUid = userData.uid;
      
      // Update UID in Firestore
      await this.syncAuthUidToFirestore(email, correctUid);
      
      // TODO: Update all references to old UID (teams, evaluations, etc.)
      // This is a complex operation that should be done carefully
      logger.warn(`UID updated for ${email}: ${oldUid} → ${correctUid}`);
      logger.warn('Remember to update team.leaderId references if this user is a team leader!');
      
      return { 
        success: true, 
        email, 
        oldUid, 
        newUid: correctUid,
        message: 'UID updated in Firestore'
      };
    } catch (error) {
      logger.error(`Error fixing UID mismatch for ${email}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Smart login check - handles imported users and default password detection
   * @param {string} email - User's email
   * @param {string} password - User's password
   * @returns {Promise<Object>} Login result with user data and password change flag
   */
  static async smartLogin(email, password) {
    try {
      // First, try normal login
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const authUser = userCredential.user;
        
        // Check if UID is synced in Firestore
        const firestoreUser = await this.checkUserExistsInFirestore(email);
        
        if (firestoreUser && firestoreUser.uid !== authUser.uid) {
          // UID mismatch - fix it
          logger.warn('UID mismatch detected, fixing...');
          await this.syncAuthUidToFirestore(email, authUser.uid);
        }
        
        return {
          success: true,
          user: authUser,
          userData: firestoreUser,
          requiresSetup: false,
          needsPasswordChange: false
        };
      } catch (authError) {
        // If user not found in Auth, check Firestore
        if (authError.code === 'auth/user-not-found') {
          const firestoreUser = await this.checkUserExistsInFirestore(email);
          
          if (firestoreUser) {
            // User exists in Firestore but not in Auth
            // This shouldn't happen with auto-bulk creation, but handle it
            return {
              success: false,
              requiresSetup: true,
              firestoreUser: firestoreUser,
              needsPasswordChange: false,
              error: 'Auth account not created yet. Please contact admin.'
            };
          }
        }
        
        // Re-throw other errors
        throw authError;
      }
    } catch (error) {
      return {
        success: false,
        requiresSetup: false,
        needsPasswordChange: false,
        error: error.message,
        errorCode: error.code
      };
    }
  }
  
  /**
   * Send password reset email
   * @param {string} email - User's email
   * @returns {Promise<Object>} Result with success status
   */
  static async sendPasswordReset(email) {
    try {
      await sendPasswordResetEmail(auth, email);
      return {
        success: true,
        message: 'Password reset email sent'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: error.code
      };
    }
  }
}

export default AuthSyncService;

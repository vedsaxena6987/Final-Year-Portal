// services/submissionService.js
// Service for handling phase submissions with Google Drive links

import { db } from '@/lib/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc,
  getDoc,
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { toast } from 'sonner';
import { NotificationService } from './notificationService';

import { logger } from "../lib/logger";
export class SubmissionService {
  
  /**
   * Submit deliverables for a phase
   * 
   * @param {Object} params - Submission parameters
   * @param {string} params.teamId - Team ID
   * @param {string} params.teamName - Team name
   * @param {string} params.phaseId - Phase ID
   * @param {string} params.phaseName - Phase name
   * @param {string} params.phaseType - Phase type (abstract, synopsis, final)
   * @param {string} [params.submissionTitle] - Custom submission title
   * @param {string} [params.notes] - Additional notes about the submission
   * @param {string} [params.projectTitle] - Project title (for abstract submissions)
   * @param {string} [params.abstract] - Project abstract text (for abstract submissions)
   * @param {Array} params.files - Array of {name, url, type} objects
   * @param {string} params.sessionId - Current session ID
   * @param {string} params.submittedBy - Email of submitter
   * @param {boolean} [params.isResubmission] - Whether this is a resubmission
   * @returns {Promise<Object>} {success: boolean, submissionId?: string, submission?: Object, error?: string}
   */
  static async submitPhase({
    teamId,
    teamName,
    phaseId,
    phaseName,
    phaseType,
    submissionTitle,
    notes,
    projectTitle,
    abstract,
    files = [],
    sessionId,
    submittedBy,
    isResubmission = false
  }) {
    try {
      // Basic validation
      if (!teamId || !phaseId || files.length === 0) {
        toast.error('Missing required information');
        return { success: false, error: 'Missing required fields' };
      }
      
      // Check if submission already exists
      const existingQuery = query(
        collection(db, 'submissions'),
        where('teamId', '==', teamId),
        where('phaseId', '==', phaseId)
      );
      
      const existingSubmissions = await getDocs(existingQuery);
      
      const submissionData = {
        teamId,
        teamName: teamName || 'Team',
        phaseId,
        phaseName: phaseName || 'Phase',
        phaseType: phaseType || null,
        sessionId,
        files: files.map(file => ({
          name: file.name,
          url: file.url,
          type: file.type || this._extractFileType(file.name),
          uploadedAt: new Date()
        })),
        fileUrls: files.map(f => f.url), // Keep flat array for backward compatibility
        submittedBy,
        submittedAt: serverTimestamp(),
        status: 'submitted',
        evaluationStatus: 'pending',
        versionNumber: 1, // Will be incremented on resubmissions
        updatedAt: serverTimestamp()
      };

      // Add optional fields if provided
      if (submissionTitle) {
        submissionData.submissionTitle = submissionTitle;
      }
      if (notes) {
        submissionData.notes = notes;
      }
      if (projectTitle) {
        submissionData.projectTitle = projectTitle;
      }
      if (abstract) {
        submissionData.abstract = abstract;
      }
      
      let submissionId;
      
      if (!existingSubmissions.empty) {
        // Update existing submission (resubmission)
        const existingDoc = existingSubmissions.docs[0];
        submissionId = existingDoc.id;
        const submissionRef = doc(db, 'submissions', submissionId);
        
        // Save current submission to history before updating
        await this._saveToHistory({
          id: existingDoc.id,
          ...existingDoc.data()
        });
        
        await updateDoc(submissionRef, {
          ...submissionData,
          resubmittedAt: serverTimestamp(),
          previousSubmissionAt: existingDoc.data().submittedAt,
          versionNumber: (existingDoc.data().versionNumber || 1) + 1
        });
        
        toast.success('Submission updated successfully!', {
          description: 'Your resubmission has been recorded'
        });
      } else {
        // Create new submission
        const docRef = await addDoc(collection(db, 'submissions'), submissionData);
        submissionId = docRef.id;
        
        toast.success('Submission uploaded successfully!', {
          description: 'Your submission has been recorded'
        });
      }
      
      // Notify evaluators
      await this._notifyEvaluators({
        phaseId,
        teamId,
        teamName: teamName || 'Team',
        phaseName: phaseName || 'Phase',
        sessionId
      });

      // Fetch and return the created/updated submission
      const submissionRef = doc(db, 'submissions', submissionId);
      const submissionDoc = await getDoc(submissionRef);
      const submission = submissionDoc.exists() 
        ? { id: submissionDoc.id, ...submissionDoc.data() }
        : null;
      
      return { success: true, submissionId, submission };
      
    } catch (error) {
      logger.error('Error submitting phase:', error);
      toast.error('Failed to submit', {
        description: error.message
      });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get submission for a team and phase
   * 
   * @param {string} teamId - Team ID
   * @param {string} phaseId - Phase ID
   * @returns {Promise<Object|null>} Submission object or null
   */
  static async getSubmission(teamId, phaseId) {
    try {
      const q = query(
        collection(db, 'submissions'),
        where('teamId', '==', teamId),
        where('phaseId', '==', phaseId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt?.toDate(),
        resubmittedAt: doc.data().resubmittedAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      };
      
    } catch (error) {
      logger.error('Error fetching submission:', error);
      return null;
    }
  }
  
  /**
   * Get all submissions for a team
   * 
   * @param {string} teamId - Team ID
   * @returns {Promise<Array>} Array of submission objects
   */
  static async getTeamSubmissions(teamId) {
    try {
      const q = query(
        collection(db, 'submissions'),
        where('teamId', '==', teamId)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt?.toDate(),
        resubmittedAt: doc.data().resubmittedAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      }));
      
    } catch (error) {
      logger.error('Error fetching team submissions:', error);
      return [];
    }
  }
  
  /**
   * Get all submissions for a phase (for evaluators)
   * 
   * @param {string} phaseId - Phase ID
   * @returns {Promise<Array>} Array of submission objects
   */
  static async getPhaseSubmissions(phaseId) {
    try {
      const q = query(
        collection(db, 'submissions'),
        where('phaseId', '==', phaseId)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt?.toDate(),
        resubmittedAt: doc.data().resubmittedAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      }));
      
    } catch (error) {
      logger.error('Error fetching phase submissions:', error);
      return [];
    }
  }
  
  /**
   * Update submission evaluation status
   * Used by faculty/evaluators
   * 
   * @param {string} submissionId - Submission ID
   * @param {string} status - Status: 'pending', 'evaluated', 'revisions_requested'
   * @param {string} feedback - Optional feedback
   * @returns {Promise<Object>} {success: boolean, error?: string}
   */
  static async updateEvaluationStatus(submissionId, status, feedback = '') {
    try {
      const submissionRef = doc(db, 'submissions', submissionId);
      const submissionDoc = await getDoc(submissionRef);
      
      if (!submissionDoc.exists()) {
        toast.error('Submission not found');
        return { success: false, error: 'Submission not found' };
      }
      
      const submissionData = submissionDoc.data();
      
      await updateDoc(submissionRef, {
        evaluationStatus: status,
        evaluationFeedback: feedback,
        evaluatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      toast.success('Evaluation status updated');
      return { success: true };
      
    } catch (error) {
      logger.error('Error updating evaluation status:', error);
      toast.error('Failed to update status');
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Request revisions for a submission
   * 
   * @param {string} submissionId - Submission ID
   * @param {string} feedback - Revision feedback
   * @returns {Promise<Object>} {success: boolean, error?: string}
   */
  static async requestRevisions(submissionId, feedback) {
    try {
      if (!feedback || feedback.trim().length < 10) {
        toast.error('Please provide detailed feedback for revisions');
        return { success: false, error: 'Feedback required' };
      }
      
      const submissionRef = doc(db, 'submissions', submissionId);
      const submissionDoc = await getDoc(submissionRef);
      
      if (!submissionDoc.exists()) {
        toast.error('Submission not found');
        return { success: false, error: 'Submission not found' };
      }
      
      const submissionData = submissionDoc.data();
      
      await updateDoc(submissionRef, {
        evaluationStatus: 'revisions_requested',
        revisionFeedback: feedback,
        revisionsRequestedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Notify team members about revision request
      
      if (submissionData.teamId) {
        try {
          // Get team information
          const teamRef = doc(db, 'teams', submissionData.teamId);
          const teamDoc = await getDoc(teamRef);
          
          if (teamDoc.exists()) {
            const teamData = teamDoc.data();
            
            // Notify team leader
            await addDoc(collection(db, 'notifications'), {
              recipientEmail: teamData.leaderEmail,
              type: 'revision_requested',
              title: 'Revisions Requested for Submission',
              message: `Your mentor has requested revisions to your submission. Please review the feedback and resubmit.`,
              link: '/dashboard',
              isRead: false,
              createdAt: serverTimestamp(),
              metadata: {
                submissionId,
                teamId: submissionData.teamId,
                teamName: teamData.name,
                feedback
              }
            });
            
            // Notify all team members (except leader)
            const members = teamData.members || [];
            for (const memberEmail of members) {
              if (memberEmail !== teamData.leaderEmail) {
                await addDoc(collection(db, 'notifications'), {
                  recipientEmail: memberEmail,
                  type: 'revision_requested',
                  title: 'Team Submission Needs Revision',
                  message: `Your team's submission requires revisions. Check with your team leader for details.`,
                  link: '/dashboard',
                  isRead: false,
                  createdAt: serverTimestamp(),
                  metadata: {
                    submissionId,
                    teamId: submissionData.teamId,
                    teamName: teamData.name
                  }
                });
              }
            }
          }
        } catch (notifError) {
          logger.error('Failed to send revision notifications:', notifError);
          // Don't fail the operation if notification fails
        }
      }
      
      toast.success('Revision request sent to team');
      return { success: true };
      
    } catch (error) {
      logger.error('Error requesting revisions:', error);
      
      // Provide specific error messages
      if (error.code === 'permission-denied') {
        toast.error('Permission denied', {
          description: 'You do not have permission to request revisions for this submission.'
        });
      } else if (error.code === 'not-found') {
        toast.error('Submission not found', {
          description: 'This submission may have been deleted.'
        });
      } else {
        toast.error('Failed to request revisions', {
          description: error.message
        });
      }
      
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Private helper: Extract file type from filename
   */
  static _extractFileType(filename) {
    if (!filename) return 'unknown';
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'unknown';
  }
  
  /**
   * Private helper: Notify appropriate evaluators about new submission
   */
  static async _notifyEvaluators({ phaseId, teamId, teamName, phaseName, sessionId }) {
    try {
      // Get phase details to know who evaluates
      const phaseDoc = await getDoc(doc(db, 'phases', phaseId));
      
      if (!phaseDoc.exists()) {
        return;
      }
      
      const phaseData = phaseDoc.data();
      const evaluatorRole = phaseData.evaluatorRole;
      
      // Get team details
      const teamDoc = await getDoc(doc(db, 'teams', teamId));
      
      if (!teamDoc.exists()) {
        return;
      }
      
      const teamData = teamDoc.data();
      
      // Notify based on evaluator role
      if (evaluatorRole === 'mentor' && teamData.mentorEmail) {
        // Notify mentor
        await NotificationService.onSubmissionReceived(
          [teamData.mentorEmail],
          teamName,
          phaseName,
          sessionId
        );
      } else if (evaluatorRole === 'panel' && teamData.panelId) {
        // Notify panel members
        await NotificationService.notifyPanelMembers(
          teamData.panelId,
          'submission_received',
          { teamName, phaseName },
          sessionId
        );
      }
    } catch (error) {
      logger.error('Error notifying evaluators:', error);
      // Don't throw - notification failure shouldn't break submission
    }
  }

  /**
   * Get submission history for a team and phase
   * Returns all previous versions in chronological order (newest first)
   * 
   * @param {string} teamId - Team ID
   * @param {string} phaseId - Phase ID
   * @returns {Promise<Array>} Array of submission history objects
   */
  static async getSubmissionHistory(teamId, phaseId) {
    try {
      
      const q = query(
        collection(db, 'submission_history'),
        where('teamId', '==', teamId),
        where('phaseId', '==', phaseId),
        orderBy('submittedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      
      const results = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      }));
      
      return results;
      
    } catch (error) {
      logger.error('[SubmissionService] Error fetching submission history:', error);
      logger.error('[SubmissionService] Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      return [];
    }
  }

  /**
   * Check if a deadline has passed
   * Considers extensions if available
   * 
   * @param {string} teamId - Team ID
   * @param {string} phaseId - Phase ID
   * @param {Date} originalDeadline - Original phase deadline
   * @returns {Promise<Object>} { passed: boolean, effectiveDeadline: Date, hasExtension: boolean }
   */
  static async checkDeadline(teamId, phaseId, originalDeadline) {
    try {
      // Check for extension
      const extension = await ExtensionService.getExtensionDetails(teamId, phaseId);
      
      const effectiveDeadline = extension?.extendedDeadline?.toDate() || originalDeadline;
      const passed = new Date() > effectiveDeadline;
      
      return {
        passed,
        effectiveDeadline,
        hasExtension: !!extension,
        extensionReason: extension?.reason
      };
      
    } catch (error) {
      logger.error('Error checking deadline:', error);
      return {
        passed: new Date() > originalDeadline,
        effectiveDeadline: originalDeadline,
        hasExtension: false
      };
    }
  }

  /**
   * Save submission to history before updating
   * Called internally during resubmissions
   * 
   * @param {Object} submission - Current submission object
   * @returns {Promise<boolean>} Success status
   */
  static async _saveToHistory(submission) {
    try {
      const historyData = {
        ...submission,
        originalSubmissionId: submission.id,
        archivedAt: serverTimestamp()
      };
      
      // Remove the id field as it's stored separately
      delete historyData.id;
      
      await addDoc(collection(db, 'submission_history'), historyData);
      return true;
      
    } catch (error) {
      logger.error('Error saving to history:', error);
      return false;
    }
  }
}

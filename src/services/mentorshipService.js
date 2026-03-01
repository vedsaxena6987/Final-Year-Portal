// services/mentorshipService.js
// Service for handling mentorship request workflow

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
  serverTimestamp 
} from 'firebase/firestore';
import { toast } from 'sonner';
import { NotificationService } from './notificationService';

import { logger } from "../lib/logger";
export class MentorshipService {
  
  /**
   * Send a mentorship request from a team to a faculty member
   * Rule: Only one pending request at a time
   * 
   * @param {Object} params - Request parameters
   * @param {string} params.teamId - Team ID
   * @param {string} params.teamName - Team name for notifications
   * @param {string} params.mentorId - Mentor's UID
   * @param {string} params.mentorEmail - Mentor's email
   * @param {string} params.mentorName - Mentor's name
   * @param {string} params.projectTitle - Project title
   * @param {string} params.projectAbstract - Project abstract
   * @param {string} params.sessionId - Current session ID
   * @param {Array} params.teamMembers - Array of team member emails
   * @returns {Promise<Object>} {success: boolean, requestId?: string, error?: string}
   */
  static async sendRequest({
    teamId,
    teamName,
    mentorId,
    mentorEmail,
    mentorName,
    projectTitle,
    projectAbstract,
    sessionId,
    teamMembers = []
  }) {
    try {
      // Validation
      if (!teamId || !mentorId || !projectTitle || !projectAbstract) {
        toast.error('Missing required fields');
        return { success: false, error: 'Missing required fields' };
      }
      
      if (projectAbstract.length < 100) {
        toast.error('Abstract must be at least 100 characters');
        return { success: false, error: 'Abstract too short' };
      }
      
      // Check if team already has a pending request
      const existingQuery = query(
        collection(db, 'mentorship_requests'),
        where('teamId', '==', teamId),
        where('status', '==', 'pending')
      );
      
      const existingRequests = await getDocs(existingQuery);
      
      if (!existingRequests.empty) {
        toast.error('You already have a pending mentorship request', {
          description: 'Please wait for the current request to be processed'
        });
        return { success: false, error: 'Pending request exists' };
      }
      
      // Check if team already has a mentor
      const teamDoc = await getDoc(doc(db, 'teams', teamId));
      if (teamDoc.exists() && teamDoc.data().mentorId) {
        toast.error('Your team already has a mentor');
        return { success: false, error: 'Team already has mentor' };
      }
      
      // Create new mentorship request
      const requestData = {
        teamId,
        teamName: teamName || 'Team',
        mentorId,
        mentorEmail,
        mentorName: mentorName || mentorEmail,
        projectTitle,
        projectAbstract,
        status: 'pending',
        revisionVersion: 0,
        teamMembers: teamMembers || [],
        createdAt: serverTimestamp(),
        sessionId,
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'mentorship_requests'), requestData);
      
      // Fetch project number from team document
      let projectNumber = null;
      if (teamId) {
        try {
          const teamDoc = await getDoc(doc(db, 'teams', teamId));
          if (teamDoc.exists()) {
            projectNumber = teamDoc.data().projectNumber || null;
          }
        } catch (error) {
          logger.error('Failed to fetch team project number:', error);
        }
      }
      
      // Store initial version in revision history
      const initialHistoryData = {
        teamId,
        projectNumber: projectNumber,
        requestId: docRef.id,
        version: 0,
        projectTitle,
        projectAbstract,
        mentorFeedback: null,
        feedbackType: 'initial_submission',
        status: 'submitted',
        submittedByEmail: teamMembers?.[0] || 'unknown@gehu.ac.in',
        mentorId,
        mentorEmail,
        mentorName: mentorName || mentorEmail,
        sessionId,
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'revision_history'), initialHistoryData);
      
      // Send notification to mentor
      await NotificationService.onMentorshipRequest(
        mentorEmail,
        teamName || 'A team',
        projectTitle,
        sessionId
      );
      
      toast.success('Mentorship request sent successfully!', {
        description: `Your request has been sent to ${mentorName}`
      });
      
      return { success: true, requestId: docRef.id };
      
    } catch (error) {
      logger.error('Error sending mentorship request:', error);
      toast.error('Failed to send mentorship request', {
        description: error.message
      });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Accept a mentorship request
   * Updates request status and assigns mentor to team
   * 
   * @param {string} requestId - Request document ID
   * @param {string} sessionId - Current session ID
   * @returns {Promise<Object>} {success: boolean, error?: string}
   */
  static async acceptRequest(requestId, sessionId) {
    try {
      if (!requestId) {
        toast.error('Invalid request ID');
        return { success: false, error: 'Invalid request ID' };
      }
      
      // Get request data
      const requestRef = doc(db, 'mentorship_requests', requestId);
      const requestDoc = await getDoc(requestRef);
      
      if (!requestDoc.exists()) {
        toast.error('Request not found');
        return { success: false, error: 'Request not found' };
      }
      
      const requestData = requestDoc.data();
      
      // Check if request is still pending
      if (requestData.status !== 'pending') {
        toast.error('This request has already been processed');
        return { success: false, error: 'Request already processed' };
      }
      
      const { teamId, mentorId, mentorName, teamMembers } = requestData;
      
      // Check if team already has a mentor
      const teamRef = doc(db, 'teams', teamId);
      const teamDoc = await getDoc(teamRef);
      
      if (teamDoc.exists() && teamDoc.data().mentorId) {
        toast.error('This team already has a mentor');
        return { success: false, error: 'Team already has mentor' };
      }
      
      // Update request status
      await updateDoc(requestRef, {
        status: 'approved',
        respondedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Assign mentor to team and save project details from mentorship request
      await updateDoc(teamRef, {
        mentorId: mentorId,
        mentorEmail: requestData.mentorEmail,
        mentorName: mentorName || requestData.mentorEmail,
        projectTitle: requestData.projectTitle,
        projectAbstract: requestData.projectAbstract,
        updatedAt: serverTimestamp()
      });
      
      // Reject all other pending requests for this team
      const otherRequestsQuery = query(
        collection(db, 'mentorship_requests'),
        where('teamId', '==', teamId),
        where('status', '==', 'pending')
      );
      
      const otherRequests = await getDocs(otherRequestsQuery);
      const rejectPromises = otherRequests.docs
        .filter(doc => doc.id !== requestId)
        .map(doc => 
          updateDoc(doc.ref, {
            status: 'auto_rejected',
            rejectionReason: 'Team accepted another mentor',
            respondedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          })
        );
      
      await Promise.all(rejectPromises);
      
      // Send notification to all team members
      if (teamMembers && teamMembers.length > 0) {
        await NotificationService.onMentorAssigned(
          teamMembers,
          mentorName || requestData.mentorEmail,
          sessionId
        );
      }
      
      toast.success('Mentorship request accepted!', {
        description: 'You are now the mentor for this team'
      });
      
      return { success: true };
      
    } catch (error) {
      logger.error('Error accepting mentorship request:', error);
      toast.error('Failed to accept request', {
        description: error.message
      });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Reject a mentorship request
   * 
   * @param {string} requestId - Request document ID
   * @param {string} reason - Reason for rejection (optional)
   * @returns {Promise<Object>} {success: boolean, error?: string}
   */
  static async rejectRequest(requestId, reason = '') {
    try {
      if (!requestId) {
        toast.error('Invalid request ID');
        return { success: false, error: 'Invalid request ID' };
      }
      
      const requestRef = doc(db, 'mentorship_requests', requestId);
      const requestDoc = await getDoc(requestRef);
      
      if (!requestDoc.exists()) {
        toast.error('Request not found');
        return { success: false, error: 'Request not found' };
      }
      
      const requestData = requestDoc.data();
      
      if (requestData.status !== 'pending') {
        toast.error('This request has already been processed');
        return { success: false, error: 'Request already processed' };
      }
      
      await updateDoc(requestRef, {
        status: 'rejected',
        rejectionReason: reason || 'No reason provided',
        respondedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      toast.success('Mentorship request rejected', {
        description: reason || 'The team can send another request'
      });
      
      return { success: true };
      
    } catch (error) {
      logger.error('Error rejecting mentorship request:', error);
      toast.error('Failed to reject request', {
        description: error.message
      });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Request revisions on a mentorship request
   * Faculty asks team to revise and resubmit their proposal
   * 
   * @param {string} requestId - Request document ID
   * @param {string} feedback - Feedback for revisions (required)
   * @returns {Promise<Object>} {success: boolean, error?: string}
   */
  static async requestRevisions(requestId, feedback) {
    try {
      if (!requestId) {
        toast.error('Invalid request ID');
        return { success: false, error: 'Invalid request ID' };
      }
      
      if (!feedback || feedback.trim().length < 10) {
        toast.error('Feedback is required (minimum 10 characters)');
        return { success: false, error: 'Feedback too short' };
      }
      
      const requestRef = doc(db, 'mentorship_requests', requestId);
      const requestDoc = await getDoc(requestRef);
      
      if (!requestDoc.exists()) {
        toast.error('Request not found');
        return { success: false, error: 'Request not found' };
      }
      
      const requestData = requestDoc.data();
      
      if (requestData.status !== 'pending') {
        toast.error('This request has already been processed');
        return { success: false, error: 'Request already processed' };
      }
      
      // Fetch project number from team document
      let projectNumber = null;
      if (requestData.teamId) {
        try {
          const teamDoc = await getDoc(doc(db, 'teams', requestData.teamId));
          if (teamDoc.exists()) {
            projectNumber = teamDoc.data().projectNumber || null;
          }
        } catch (error) {
          logger.error('Failed to fetch team project number:', error);
        }
      }
      
      // Store feedback in revision history
      const revisionHistoryData = {
        teamId: requestData.teamId,
        projectNumber: projectNumber,
        requestId: requestId,
        version: requestData.revisionVersion || 0,
        projectTitle: requestData.projectTitle,
        projectAbstract: requestData.projectAbstract,
        mentorFeedback: feedback.trim(),
        feedbackType: 'revision_request',
        status: 'revision_requested',
        mentorId: requestData.mentorId,
        mentorEmail: requestData.mentorEmail,
        mentorName: requestData.mentorName,
        sessionId: requestData.sessionId,
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'revision_history'), revisionHistoryData);
      
      // Update request status to revisions_requested
      await updateDoc(requestRef, {
        status: 'revisions_requested',
        revisionFeedback: feedback.trim(),
        respondedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Send notification to team members
      if (requestData.teamMembers && requestData.teamMembers.length > 0) {
        await NotificationService.onRevisionRequested(
          requestData.teamMembers,
          requestData.mentorName || requestData.mentorEmail,
          requestData.sessionId
        );
      }
      
      toast.success('Revision request sent!', {
        description: 'The team will be notified to revise and resubmit their proposal'
      });
      
      return { success: true };
      
    } catch (error) {
      logger.error('Error requesting revisions:', error);
      toast.error('Failed to request revisions', {
        description: error.message
      });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Cancel a pending mentorship request (by team)
   * 
   * @param {string} requestId - Request document ID
   * @returns {Promise<Object>} {success: boolean, error?: string}
   */
  static async cancelRequest(requestId) {
    try {
      if (!requestId) {
        toast.error('Invalid request ID');
        return { success: false, error: 'Invalid request ID' };
      }
      
      const requestRef = doc(db, 'mentorship_requests', requestId);
      const requestDoc = await getDoc(requestRef);
      
      if (!requestDoc.exists()) {
        toast.error('Request not found');
        return { success: false, error: 'Request not found' };
      }
      
      const requestData = requestDoc.data();
      
      if (requestData.status !== 'pending') {
        toast.error('Only pending requests can be cancelled');
        return { success: false, error: 'Request not pending' };
      }
      
      await updateDoc(requestRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      toast.success('Mentorship request cancelled');
      
      return { success: true };
      
    } catch (error) {
      logger.error('Error cancelling mentorship request:', error);
      toast.error('Failed to cancel request', {
        description: error.message
      });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get all mentorship requests for a faculty member
   * 
   * @param {string} mentorId - Faculty member's UID
   * @param {string} status - Optional status filter ('pending', 'approved', 'rejected', 'revisions_requested')
   * @returns {Promise<Array>} Array of request objects
   */
  static async getFacultyRequests(mentorId, status = null) {
    try {
      let q;
      
      if (status) {
        q = query(
          collection(db, 'mentorship_requests'),
          where('mentorId', '==', mentorId),
          where('status', '==', status)
        );
      } else {
        q = query(
          collection(db, 'mentorship_requests'),
          where('mentorId', '==', mentorId)
        );
      }
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        respondedAt: doc.data().respondedAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      }));
      
    } catch (error) {
      logger.error('Error fetching faculty requests:', error);
      return [];
    }
  }
  
  /**
   * Get mentorship request for a specific team
   * 
   * @param {string} teamId - Team ID
   * @returns {Promise<Object|null>} Request object or null
   */
  static async getTeamRequest(teamId) {
    try {
      const q = query(
        collection(db, 'mentorship_requests'),
        where('teamId', '==', teamId),
        where('status', '==', 'pending')
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        respondedAt: doc.data().respondedAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      };
      
    } catch (error) {
      logger.error('Error fetching team request:', error);
      return null;
    }
  }
}

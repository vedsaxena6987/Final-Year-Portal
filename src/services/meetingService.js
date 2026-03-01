import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  getDocs,
  getDoc,
  onSnapshot,
  orderBy,
  Timestamp,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

import { logger } from "../lib/logger";
/**
 * MeetingService - Handles meeting scheduling and management
 * Supports both mentor and panel phase meetings
 */
const MeetingService = {
  /**
   * Create a new meeting announcement
   * @param {Object} meetingData - Meeting details
   * @param {string} meetingData.phaseId - Phase ID
   * @param {string} meetingData.phaseName - Phase name for display
   * @param {string} meetingData.phaseType - 'mentor' or 'panel'
   * @param {string} meetingData.facultyId - Faculty UID creating the meeting
   * @param {string} meetingData.facultyName - Faculty display name
   * @param {string} meetingData.facultyEmail - Faculty email
   * @param {Array<string>} meetingData.invitedTeams - Array of team IDs
   * @param {string} meetingData.meetingType - 'online' or 'offline'
   * @param {string} meetingData.meetingLink - MS Teams/Zoom link (online only)
   * @param {string} meetingData.venue - Physical location (offline only)
   * @param {Date} meetingData.scheduledDate - Meeting date
   * @param {string} meetingData.scheduledTime - Time string (e.g., "10:00 AM")
   * @param {string} meetingData.duration - Optional duration (e.g., "30 mins")
   * @param {string} meetingData.agenda - Optional meeting agenda
   * @returns {Promise<{success: boolean, meetingId?: string, error?: string}>}
   */
  async createMeeting(meetingData) {
    try {
      const {
        phaseId,
        phaseName,
        phaseType,
        facultyId,
        facultyName,
        facultyEmail,
        invitedTeams,
        meetingType,
        meetingLink,
        venue,
        scheduledDate,
        scheduledTime,
        endTime,
        duration, // Keep for backward compatibility
        agenda
      } = meetingData;

      // Validation
      if (!phaseId || !facultyId || !invitedTeams || invitedTeams.length === 0) {
        return { success: false, error: 'Missing required fields' };
      }

      if (meetingType === 'online' && !meetingLink) {
        return { success: false, error: 'Meeting link required for online meetings' };
      }

      if (meetingType === 'offline' && !venue) {
        return { success: false, error: 'Venue required for offline meetings' };
      }

      if (!scheduledDate || !scheduledTime) {
        return { success: false, error: 'Date and time are required' };
      }

      // Create meeting document
      const meetingDoc = {
        phaseId,
        phaseName,
        phaseType,
        facultyId,
        facultyName,
        facultyEmail,
        invitedTeams,
        meetingType,
        scheduledDate: Timestamp.fromDate(new Date(scheduledDate)),
        scheduledTime,
        status: 'upcoming',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Add type-specific fields
      if (meetingType === 'online') {
        meetingDoc.meetingLink = meetingLink;
      } else {
        meetingDoc.venue = venue;
      }

      // Add optional fields
      if (endTime) meetingDoc.endTime = endTime;
      if (duration) meetingDoc.duration = duration; // Keep for backward compatibility
      if (agenda) meetingDoc.agenda = agenda;

      const docRef = await addDoc(collection(db, 'meetings'), meetingDoc);

      // TODO: Send mail notification to all team members
      // await MailService.sendMeetingNotification(docRef.id, meetingData);

      return { success: true, meetingId: docRef.id };
    } catch (error) {
      logger.error('Error creating meeting:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Update an existing meeting
   * @param {string} meetingId - Meeting document ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async updateMeeting(meetingId, updates) {
    try {
      const meetingRef = doc(db, 'meetings', meetingId);
      
      await updateDoc(meetingRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      logger.error('Error updating meeting:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Cancel a meeting
   * @param {string} meetingId - Meeting document ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async cancelMeeting(meetingId) {
    try {
      const meetingRef = doc(db, 'meetings', meetingId);
      
      await updateDoc(meetingRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      logger.error('Error cancelling meeting:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Delete a meeting (hard delete)
   * @param {string} meetingId - Meeting document ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteMeeting(meetingId) {
    try {
      const meetingRef = doc(db, 'meetings', meetingId);
      await deleteDoc(meetingRef);
      return { success: true };
    } catch (error) {
      logger.error('Error deleting meeting:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all meetings for a specific phase
   * @param {string} phaseId - Phase ID
   * @returns {Promise<{success: boolean, meetings?: Array, error?: string}>}
   */
  async getMeetingsByPhase(phaseId) {
    try {
      const q = query(
        collection(db, 'meetings'),
        where('phaseId', '==', phaseId),
        orderBy('scheduledDate', 'asc')
      );

      const snapshot = await getDocs(q);
      const meetings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        scheduledDate: doc.data().scheduledDate?.toDate()
      }));

      return { success: true, meetings };
    } catch (error) {
      logger.error('Error getting meetings by phase:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all meetings for a specific team
   * @param {string} teamId - Team ID
   * @returns {Promise<{success: boolean, meetings?: Array, error?: string}>}
   */
  async getTeamMeetings(teamId) {
    try {
      const q = query(
        collection(db, 'meetings'),
        where('invitedTeams', 'array-contains', teamId),
        orderBy('scheduledDate', 'asc')
      );

      const snapshot = await getDocs(q);
      const meetings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        scheduledDate: doc.data().scheduledDate?.toDate()
      }));

      return { success: true, meetings };
    } catch (error) {
      logger.error('Error getting team meetings:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all meetings created by a faculty member
   * @param {string} facultyId - Faculty UID
   * @returns {Promise<{success: boolean, meetings?: Array, error?: string}>}
   */
  async getFacultyMeetings(facultyId) {
    try {
      const q = query(
        collection(db, 'meetings'),
        where('facultyId', '==', facultyId),
        orderBy('scheduledDate', 'desc')
      );

      const snapshot = await getDocs(q);
      const meetings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        scheduledDate: doc.data().scheduledDate?.toDate()
      }));

      return { success: true, meetings };
    } catch (error) {
      logger.error('Error getting faculty meetings:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Subscribe to meetings for a team (real-time)
   * @param {string} teamId - Team ID
   * @param {Function} callback - Callback function to receive meeting updates
   * @returns {Function} Unsubscribe function
   */
  subscribeToTeamMeetings(teamId, callback) {
    const q = query(
      collection(db, 'meetings'),
      where('invitedTeams', 'array-contains', teamId),
      orderBy('scheduledDate', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      const meetings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        scheduledDate: doc.data().scheduledDate?.toDate()
      }));
      callback(meetings);
    });
  },

  /**
   * Subscribe to meetings for a phase (real-time)
   * @param {string} phaseId - Phase ID
   * @param {Function} callback - Callback function to receive meeting updates
   * @returns {Function} Unsubscribe function
   */
  subscribeToPhaseMeetings(phaseId, callback) {
    const q = query(
      collection(db, 'meetings'),
      where('phaseId', '==', phaseId),
      orderBy('scheduledDate', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      const meetings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        scheduledDate: doc.data().scheduledDate?.toDate()
      }));
      callback(meetings);
    });
  },

  /**
   * Check for meeting time conflicts for a faculty member
   * @param {string} facultyId - Faculty UID
   * @param {Date} scheduledDate - Proposed meeting date
   * @param {string} scheduledTime - Proposed meeting time
   * @param {string} excludeMeetingId - Optional meeting ID to exclude (for updates)
   * @returns {Promise<{hasConflict: boolean, conflictingMeetings?: Array}>}
   */
  async checkTimeConflicts(facultyId, scheduledDate, scheduledTime, excludeMeetingId = null) {
    try {
      // Get all faculty meetings on the same date
      const result = await this.getFacultyMeetings(facultyId);
      if (!result.success) return { hasConflict: false };

      const proposedDate = new Date(scheduledDate);
      const conflicts = result.meetings.filter(meeting => {
        if (excludeMeetingId && meeting.id === excludeMeetingId) return false;
        if (meeting.status === 'cancelled') return false;

        const meetingDate = new Date(meeting.scheduledDate);
        
        // Check if same date (ignore time)
        const sameDay = 
          meetingDate.getDate() === proposedDate.getDate() &&
          meetingDate.getMonth() === proposedDate.getMonth() &&
          meetingDate.getFullYear() === proposedDate.getFullYear();

        if (!sameDay) return false;

        // Check if times are within 1 hour of each other
        const timeDiff = Math.abs(
          this._parseTime(meeting.scheduledTime) - this._parseTime(scheduledTime)
        );
        
        return timeDiff < 60; // Within 60 minutes
      });

      return {
        hasConflict: conflicts.length > 0,
        conflictingMeetings: conflicts
      };
    } catch (error) {
      logger.error('Error checking time conflicts:', error);
      return { hasConflict: false };
    }
  },

  /**
   * Helper: Parse time string to minutes since midnight
   * @private
   */
  _parseTime(timeString) {
    const match = timeString.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 0;

    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3].toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return hours * 60 + minutes;
  },

  /**
   * Mark meetings as completed (status update)
   * Called automatically or manually after meeting time passes
   */
  async markMeetingsAsCompleted() {
    try {
      const now = new Date();
      const q = query(
        collection(db, 'meetings'),
        where('status', '==', 'upcoming')
      );

      const snapshot = await getDocs(q);
      const updates = [];

      snapshot.docs.forEach(doc => {
        const meeting = doc.data();
        const meetingDate = meeting.scheduledDate?.toDate();
        
        if (meetingDate && meetingDate < now) {
          updates.push(
            updateDoc(doc.ref, {
              status: 'completed',
              updatedAt: serverTimestamp()
            })
          );
        }
      });

      await Promise.all(updates);
      return { success: true, updatedCount: updates.length };
    } catch (error) {
      logger.error('Error marking meetings as completed:', error);
      return { success: false, error: error.message };
    }
  }
};

export default MeetingService;

// services/meetingStatsService.js
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

import { logger } from "../lib/logger";
/**
 * MeetingStatsService - Track meeting statistics for teams
 * Used to check if teams meet panel phase requirements
 */

const MeetingStatsService = {
  /**
   * Get count of unique panelists a team has met with for a phase
   * @param {string} teamId - Team ID
   * @param {string} phaseId - Phase ID
   * @returns {Promise<number>} - Number of unique panelists met
   */
  async getPanelistsMeetCount(teamId, phaseId) {
    try {
      const meetingsQuery = query(
        collection(db, 'meetings'),
        where('teamIds', 'array-contains', teamId),
        where('phaseId', '==', phaseId),
        where('status', 'in', ['scheduled', 'completed'])
      );

      const snapshot = await getDocs(meetingsQuery);
      
      // Get unique faculty IDs from all meetings
      const uniqueFaculty = new Set();
      snapshot.docs.forEach(doc => {
        const facultyId = doc.data().facultyId;
        if (facultyId) {
          uniqueFaculty.add(facultyId);
        }
      });

      return uniqueFaculty.size;
    } catch (error) {
      logger.error('Error getting panelists meet count:', error);
      return 0;
    }
  },

  /**
   * Get detailed meeting stats for a team in a phase
   * @param {string} teamId - Team ID
   * @param {string} phaseId - Phase ID
   * @returns {Promise<Object>} - Meeting statistics
   */
  async getTeamMeetingStats(teamId, phaseId) {
    try {
      const meetingsQuery = query(
        collection(db, 'meetings'),
        where('teamIds', 'array-contains', teamId),
        where('phaseId', '==', phaseId)
      );

      const snapshot = await getDocs(meetingsQuery);
      
      const stats = {
        totalMeetings: 0,
        scheduledMeetings: 0,
        completedMeetings: 0,
        cancelledMeetings: 0,
        uniquePanelists: 0,
        panelistDetails: []
      };

      const facultyMap = new Map();

      snapshot.docs.forEach(doc => {
        const meeting = doc.data();
        stats.totalMeetings++;

        switch (meeting.status) {
          case 'scheduled':
            stats.scheduledMeetings++;
            break;
          case 'completed':
            stats.completedMeetings++;
            break;
          case 'cancelled':
            stats.cancelledMeetings++;
            break;
        }

        // Track unique faculty
        if (meeting.facultyId && meeting.status !== 'cancelled') {
          if (!facultyMap.has(meeting.facultyId)) {
            facultyMap.set(meeting.facultyId, {
              id: meeting.facultyId,
              name: meeting.facultyName,
              meetings: []
            });
          }
          facultyMap.get(meeting.facultyId).meetings.push({
            id: doc.id,
            date: meeting.meetingDate,
            status: meeting.status,
            mode: meeting.mode
          });
        }
      });

      stats.uniquePanelists = facultyMap.size;
      stats.panelistDetails = Array.from(facultyMap.values());

      return stats;
    } catch (error) {
      logger.error('Error getting team meeting stats:', error);
      return {
        totalMeetings: 0,
        scheduledMeetings: 0,
        completedMeetings: 0,
        cancelledMeetings: 0,
        uniquePanelists: 0,
        panelistDetails: []
      };
    }
  },

  /**
   * Check if team meets minimum panelist requirement for a phase
   * @param {string} teamId - Team ID
   * @param {string} phaseId - Phase ID
   * @param {number} minRequired - Minimum panelists required
   * @returns {Promise<Object>} - { meets: boolean, count: number, required: number }
   */
  async checkMeetingRequirement(teamId, phaseId, minRequired) {
    try {
      const count = await this.getPanelistsMeetCount(teamId, phaseId);
      
      return {
        meets: count >= minRequired,
        count,
        required: minRequired,
        remaining: Math.max(0, minRequired - count)
      };
    } catch (error) {
      logger.error('Error checking meeting requirement:', error);
      return {
        meets: false,
        count: 0,
        required: minRequired,
        remaining: minRequired
      };
    }
  },

  /**
   * Get all teams that don't meet minimum panelist requirement
   * @param {string} phaseId - Phase ID
   * @param {number} minRequired - Minimum panelists required
   * @param {Array<string>} teamIds - Array of team IDs to check
   * @returns {Promise<Array>} - Teams that don't meet requirements
   */
  async getTeamsNotMeetingRequirement(phaseId, minRequired, teamIds) {
    try {
      const results = await Promise.all(
        teamIds.map(async (teamId) => {
          const check = await this.checkMeetingRequirement(teamId, phaseId, minRequired);
          return {
            teamId,
            ...check
          };
        })
      );

      return results.filter(result => !result.meets);
    } catch (error) {
      logger.error('Error getting teams not meeting requirement:', error);
      return [];
    }
  },

  /**
   * Get meeting progress for multiple teams (bulk operation)
   * @param {Array<string>} teamIds - Array of team IDs
   * @param {string} phaseId - Phase ID
   * @returns {Promise<Map>} - Map of teamId -> panelistCount
   */
  async getBulkMeetingProgress(teamIds, phaseId) {
    try {
      const progressMap = new Map();

      await Promise.all(
        teamIds.map(async (teamId) => {
          const count = await this.getPanelistsMeetCount(teamId, phaseId);
          progressMap.set(teamId, count);
        })
      );

      return progressMap;
    } catch (error) {
      logger.error('Error getting bulk meeting progress:', error);
      return new Map();
    }
  }
};

export default MeetingStatsService;

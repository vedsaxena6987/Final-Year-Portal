import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';

import { logger } from "../lib/logger";
/**
 * Faculty Service - Utility functions for fetching faculty-related data
 * Handles mentored teams and panel-assigned teams with caching
 */

// Simple in-memory cache
const cache = {
  mentoredTeams: new Map(),
  panelTeams: new Map(),
  allTeams: new Map(),
  timestamp: new Map(),
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Check if cached data is still valid
 */
const isCacheValid = (key) => {
  const timestamp = cache.timestamp.get(key);
  if (!timestamp) return false;
  return Date.now() - timestamp < CACHE_DURATION;
};

/**
 * Get cached data if valid, otherwise return null
 */
const getCachedData = (cacheMap, key) => {
  if (isCacheValid(key)) {
    return cacheMap.get(key);
  }
  return null;
};

/**
 * Set data in cache with timestamp
 */
const setCachedData = (cacheMap, key, data) => {
  cacheMap.set(key, data);
  cache.timestamp.set(key, Date.now());
};

/**
 * Clear all cache
 */
export const clearFacultyCache = () => {
  cache.mentoredTeams.clear();
  cache.panelTeams.clear();
  cache.allTeams.clear();
  cache.timestamp.clear();
};

/**
 * Fetch teams where faculty is the mentor
 * @param {string} facultyId - Faculty user UID
 * @param {string} sessionId - Active session ID (optional, filters by session if provided)
 * @returns {Promise<Array>} Array of team objects with id
 */
export const getMentoredTeams = async (facultyId, sessionId = null) => {
  try {
    const cacheKey = `${facultyId}-${sessionId || 'all'}`;
    
    // Check cache first
    const cachedData = getCachedData(cache.mentoredTeams, cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const teamsRef = collection(db, 'teams');
    
    // Get faculty email for email-based query
    const facultyDoc = await getDoc(doc(db, 'users', facultyId));
    const facultyEmail = facultyDoc.exists() ? facultyDoc.data().email || facultyId : facultyId;
    
    
    // Query by mentorEmail (primary method after import)
    let q;
    if (sessionId) {
      q = query(
        teamsRef,
        where('mentorEmail', '==', facultyEmail),
        where('sessionId', '==', sessionId),
        orderBy('projectNumber', 'asc')
      );
    } else {
      q = query(
        teamsRef,
        where('mentorEmail', '==', facultyEmail),
        orderBy('projectNumber', 'asc')
      );
    }

    const snapshot = await getDocs(q);
    const teams = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    
    // Cache the result
    setCachedData(cache.mentoredTeams, cacheKey, teams);

    return teams;
  } catch (error) {
    logger.error('Error fetching mentored teams:', error);
    throw error;
  }
};

/**
 * Fetch teams assigned to panels where faculty is a member
 * Handles Firestore 'in' query limitation (max 10 items)
 * @param {string} facultyId - Faculty user UID
 * @param {string} sessionId - Active session ID
 * @returns {Promise<Array>} Array of team objects with id
 */
export const getPanelAssignedTeams = async (facultyId, sessionId) => {
  try {
    const cacheKey = `${facultyId}-${sessionId}`;
    
    // Check cache first
    const cachedData = getCachedData(cache.panelTeams, cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // Step 1: Find all panels where faculty is a member
    const panelsRef = collection(db, 'panels');
    const panelsQuery = query(
      panelsRef,
      where('sessionId', '==', sessionId),
      where('facultyMembers', 'array-contains', { uid: facultyId })
    );

    const panelsSnapshot = await getDocs(panelsQuery);
    const panelIds = panelsSnapshot.docs.map(doc => doc.id);

    if (panelIds.length === 0) {
      setCachedData(cache.panelTeams, cacheKey, []);
      return [];
    }

    // Step 2: Fetch teams for these panels
    // Handle Firestore 'in' limitation (max 10 items)
    const teamsRef = collection(db, 'teams');
    const allTeams = [];

    // Split panelIds into chunks of 10
    const chunkSize = 10;
    for (let i = 0; i < panelIds.length; i += chunkSize) {
      const chunk = panelIds.slice(i, i + chunkSize);
      
      const teamsQuery = query(
        teamsRef,
        where('sessionId', '==', sessionId),
        where('panelId', 'in', chunk),
        orderBy('projectNumber', 'asc')
      );

      const teamsSnapshot = await getDocs(teamsQuery);
      const teams = teamsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      allTeams.push(...teams);
    }

    // Remove duplicates (in case a team somehow appears in multiple panels)
    const uniqueTeams = Array.from(
      new Map(allTeams.map(team => [team.id, team])).values()
    );

    // Cache the result
    setCachedData(cache.panelTeams, cacheKey, uniqueTeams);

    return uniqueTeams;
  } catch (error) {
    logger.error('Error fetching panel-assigned teams:', error);
    throw error;
  }
};

/**
 * Fetch all teams (mentored + panel-assigned) for a faculty member
 * Removes duplicates if a team appears in both lists
 * @param {string} facultyId - Faculty user UID
 * @param {string} sessionId - Active session ID
 * @returns {Promise<Object>} Object with { all, mentored, panelOnly }
 */
export const getAllFacultyTeams = async (facultyId, sessionId) => {
  try {
    const cacheKey = `${facultyId}-${sessionId}`;
    
    // Check cache first
    const cachedData = getCachedData(cache.allTeams, cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // Fetch both types in parallel
    const [mentoredTeams, panelTeams] = await Promise.all([
      getMentoredTeams(facultyId, sessionId),
      getPanelAssignedTeams(facultyId, sessionId)
    ]);

    // Create a map to track mentored team IDs
    const mentoredTeamIds = new Set(mentoredTeams.map(team => team.id));

    // Separate panel-only teams (not mentored)
    const panelOnlyTeams = panelTeams.filter(team => !mentoredTeamIds.has(team.id));

    // Combine all unique teams
    const allTeams = [...mentoredTeams, ...panelOnlyTeams];

    // Sort by project number
    allTeams.sort((a, b) => (a.projectNumber || 0) - (b.projectNumber || 0));

    const result = {
      all: allTeams,
      mentored: mentoredTeams,
      panelOnly: panelOnlyTeams,
      stats: {
        total: allTeams.length,
        mentoredCount: mentoredTeams.length,
        panelOnlyCount: panelOnlyTeams.length
      }
    };

    // Cache the result
    setCachedData(cache.allTeams, cacheKey, result);

    return result;
  } catch (error) {
    logger.error('Error fetching all faculty teams:', error);
    throw error;
  }
};

/**
 * Fetch teams with additional filters
 * @param {string} facultyId - Faculty user UID
 * @param {string} sessionId - Active session ID
 * @param {Object} filters - Filter options
 * @param {string} filters.status - Team status (approved, under_review, rejected)
 * @param {string} filters.abstractStatus - Abstract status
 * @param {boolean} filters.mentoredOnly - Only mentored teams
 * @param {boolean} filters.panelOnly - Only panel-assigned teams
 * @returns {Promise<Array>} Filtered array of teams
 */
export const getFilteredFacultyTeams = async (facultyId, sessionId, filters = {}) => {
  try {
    const { all, mentored, panelOnly } = await getAllFacultyTeams(facultyId, sessionId);
    
    // Start with the appropriate base array
    let teams = all;
    if (filters.mentoredOnly) {
      teams = mentored;
    } else if (filters.panelOnly) {
      teams = panelOnly;
    }

    // Apply filters
    let filteredTeams = teams;

    if (filters.status) {
      filteredTeams = filteredTeams.filter(team => team.status === filters.status);
    }

    if (filters.abstractStatus) {
      filteredTeams = filteredTeams.filter(team => team.abstractStatus === filters.abstractStatus);
    }

    return filteredTeams;
  } catch (error) {
    logger.error('Error fetching filtered faculty teams:', error);
    throw error;
  }
};

/**
 * Check if faculty is mentor of a specific team
 * @param {string} facultyId - Faculty user UID
 * @param {string} teamId - Team ID
 * @returns {Promise<boolean>}
 */
export const isMentorOfTeam = async (facultyId, teamId) => {
  try {
    const teamsRef = collection(db, 'teams');
    const q = query(
      teamsRef,
      where('__name__', '==', teamId),
      where('mentorId', '==', facultyId)
    );

    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    logger.error('Error checking mentor status:', error);
    return false;
  }
};

/**
 * Check if faculty is on panel for a specific team
 * @param {string} facultyId - Faculty user UID
 * @param {string} teamId - Team ID
 * @returns {Promise<boolean>}
 */
export const isOnPanelForTeam = async (facultyId, teamId) => {
  try {
    // Get the team to find its panelId
    const teamsRef = collection(db, 'teams');
    const teamQuery = query(teamsRef, where('__name__', '==', teamId));
    const teamSnapshot = await getDocs(teamQuery);
    
    if (teamSnapshot.empty) return false;
    
    const team = teamSnapshot.docs[0].data();
    if (!team.panelId) return false;

    // Check if faculty is in this panel
    const panelsRef = collection(db, 'panels');
    const panelQuery = query(
      panelsRef,
      where('__name__', '==', team.panelId),
      where('facultyMembers', 'array-contains', { uid: facultyId })
    );

    const panelSnapshot = await getDocs(panelQuery);
    return !panelSnapshot.empty;
  } catch (error) {
    logger.error('Error checking panel status:', error);
    return false;
  }
};

/**
 * Check if faculty has access to a team (mentor OR panel member)
 * @param {string} facultyId - Faculty user UID
 * @param {string} teamId - Team ID
 * @returns {Promise<Object>} { hasAccess: boolean, isMentor: boolean, isPanel: boolean }
 */
export const checkTeamAccess = async (facultyId, teamId) => {
  try {
    const [isMentor, isPanel] = await Promise.all([
      isMentorOfTeam(facultyId, teamId),
      isOnPanelForTeam(facultyId, teamId)
    ]);

    return {
      hasAccess: isMentor || isPanel,
      isMentor,
      isPanel
    };
  } catch (error) {
    logger.error('Error checking team access:', error);
    return {
      hasAccess: false,
      isMentor: false,
      isPanel: false
    };
  }
};

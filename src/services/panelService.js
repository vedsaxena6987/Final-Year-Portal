// src/services/panelService.js
"use client";

import { db } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy,
  writeBatch,
  runTransaction,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { toast } from 'sonner';

import { logger } from "../lib/logger";
/**
 * Panel Service
 * Manages evaluation panels - creation, faculty assignment, team assignment
 */
export class PanelService {
  
  /**
   * Get next panel number for a session
   * Uses Firestore transaction for atomic counter increment
   */
  static async getNextPanelNumber(sessionId) {
    try {
      const counterRef = doc(db, 'counters', `panel_${sessionId}`);
      
      const nextNumber = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        
        if (!counterDoc.exists()) {
          // Initialize counter
          transaction.set(counterRef, {
            sessionId,
            currentValue: 1,
            createdAt: serverTimestamp()
          });
          return 1;
        }
        
        const currentValue = counterDoc.data().currentValue || 0;
        const nextValue = currentValue + 1;
        
        transaction.update(counterRef, {
          currentValue: nextValue,
          updatedAt: serverTimestamp()
        });
        
        return nextValue;
      });
      
      return nextNumber;
    } catch (error) {
      logger.error('Error getting next panel number:', error);
      throw error;
    }
  }
  
  /**
   * Balance faculty expertise across panels
   * Groups faculty by expertise tags and distributes evenly
   */
  static balanceExpertiseAcrossPanels(facultyList, panelSize) {
    // Group faculty by expertise
    const expertiseGroups = {};
    
    facultyList.forEach(faculty => {
      if (faculty.expertise && Array.isArray(faculty.expertise)) {
        faculty.expertise.forEach(tag => {
          if (!expertiseGroups[tag]) {
            expertiseGroups[tag] = [];
          }
          expertiseGroups[tag].push(faculty);
        });
      }
    });
    
    // Calculate number of panels
    const numPanels = Math.ceil(facultyList.length / panelSize);
    const panels = Array.from({ length: numPanels }, () => []);
    
    // Distribute faculty with expertise tags first
    const assignedFaculty = new Set();
    
    Object.keys(expertiseGroups).forEach(expertise => {
      const facultyWithExpertise = expertiseGroups[expertise];
      
      // Sort by how many times this faculty has been assigned
      facultyWithExpertise.sort((a, b) => {
        const aAssigned = Array.from(assignedFaculty).filter(uid => uid === a.uid).length;
        const bAssigned = Array.from(assignedFaculty).filter(uid => uid === b.uid).length;
        return aAssigned - bAssigned;
      });
      
      // Distribute across panels
      facultyWithExpertise.forEach((faculty, index) => {
        const panelIndex = index % numPanels;
        if (!panels[panelIndex].find(f => f.uid === faculty.uid)) {
          panels[panelIndex].push(faculty);
          assignedFaculty.add(faculty.uid);
        }
      });
    });
    
    // Assign remaining faculty without specific expertise
    facultyList.forEach(faculty => {
      if (!assignedFaculty.has(faculty.uid)) {
        // Find panel with fewest members
        const smallestPanel = panels.reduce((min, panel, index) => 
          panel.length < panels[min].length ? index : min, 0
        );
        panels[smallestPanel].push(faculty);
        assignedFaculty.add(faculty.uid);
      }
    });
    
    return panels;
  }
  
  /**
   * Create panels for a session
   * Distributes faculty across panels with expertise balancing
   */
  static async createPanels(sessionId, panelSize, facultyList, createdBy) {
    try {
      if (!sessionId || !panelSize || !facultyList || facultyList.length === 0) {
        throw new Error('Invalid parameters for panel creation');
      }
      
      if (panelSize < 2) {
        throw new Error('Panel size must be at least 2');
      }
      
      // Balance expertise across panels
      const balancedPanels = this.balanceExpertiseAcrossPanels(facultyList, panelSize);
      
      const batch = writeBatch(db);
      const createdPanels = [];
      
      for (let i = 0; i < balancedPanels.length; i++) {
        const panelNumber = await this.getNextPanelNumber(sessionId);
        const panelId = `panel_${sessionId}_${panelNumber}`;
        const panelRef = doc(db, 'panels', panelId);
        
        const panelData = {
          id: panelId,
          panelNumber,
          sessionId,
          facultyMembers: balancedPanels[i].map(f => ({
            uid: f.uid,
            email: f.email,
            name: f.name,
            expertise: f.expertise || []
          })),
          assignedTeams: [], // Teams assigned later
          panelSize: panelSize, // Original intended size
          actualSize: balancedPanels[i].length,
          createdAt: serverTimestamp(),
          createdBy,
          updatedAt: serverTimestamp()
        };
        
        batch.set(panelRef, panelData);
        
        // Update each faculty member's document with panelId
        for (const faculty of balancedPanels[i]) {
          const userRef = doc(db, 'users', faculty.email);
          batch.update(userRef, {
            panelId: panelId,
            panelNumber: panelNumber,
            sessionId: sessionId,
            updatedAt: serverTimestamp()
          });
        }
        
        createdPanels.push({ ...panelData, id: panelId });
      }
      
      await batch.commit();
      
      toast.success('Panels created successfully!', {
        description: `Created ${balancedPanels.length} panel(s) with expertise balancing`
      });
      
      return {
        success: true,
        panels: createdPanels,
        totalPanels: balancedPanels.length
      };
      
    } catch (error) {
      logger.error('Error creating panels:', error);
      toast.error('Failed to create panels', {
        description: error.message
      });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Check if a team would have a mentor conflict with a panel
   * Returns true if team's mentor is in the panel
   */
  static async checkMentorConflict(teamId, panelId) {
    try {
      // Get team document
      const teamDoc = await getDoc(doc(db, 'teams', teamId));
      if (!teamDoc.exists()) {
        return { hasConflict: false, reason: 'Team not found' };
      }
      
      const team = teamDoc.data();
      const mentorId = team.mentorId;
      
      if (!mentorId) {
        return { hasConflict: false, reason: 'Team has no mentor' };
      }
      
      // Get panel document
      const panelDoc = await getDoc(doc(db, 'panels', panelId));
      if (!panelDoc.exists()) {
        return { hasConflict: false, reason: 'Panel not found' };
      }
      
      const panel = panelDoc.data();
      const facultyUids = panel.facultyMembers.map(f => f.uid);
      
      // Check if mentor is in panel
      if (facultyUids.includes(mentorId)) {
        return {
          hasConflict: true,
          reason: `Team's mentor is in Panel ${panel.panelNumber}`,
          mentorId,
          panelNumber: panel.panelNumber
        };
      }
      
      return { hasConflict: false };
      
    } catch (error) {
      logger.error('Error checking mentor conflict:', error);
      return { hasConflict: false, error: error.message };
    }
  }
  
  /**
   * Distribute teams equally across panels (avoiding mentor conflicts)
   * Returns array of team IDs per panel
   */
  static async distributeTeamsEqually(teams, panels) {
    const distribution = panels.map(() => []);
    
    for (const team of teams) {
      let assigned = false;
      
      // Try to assign to panel without conflict
      for (let i = 0; i < panels.length; i++) {
        const panel = panels[i];
        const facultyUids = panel.facultyMembers.map(f => f.uid);
        
        // Check if team's mentor is NOT in this panel
        if (!facultyUids.includes(team.mentorId)) {
          distribution[i].push(team.id);
          assigned = true;
          break;
        }
      }
      
      // If no conflict-free panel found, assign to smallest panel
      // (This shouldn't happen with proper panel design, but handles edge cases)
      if (!assigned) {
        const smallestPanelIndex = distribution.reduce((min, panel, index) => 
          panel.length < distribution[min].length ? index : min, 0
        );
        distribution[smallestPanelIndex].push(team.id);
        logger.warn(`Team ${team.name} has mentor conflict with all panels, assigned to Panel ${smallestPanelIndex + 1}`);
      }
    }
    
    return distribution;
  }
  
  /**
   * Assign teams to panels (random + balanced + conflict-free)
   */
  static async assignTeamsToPanels(sessionId, teamsList) {
    try {
      if (!sessionId || !teamsList || teamsList.length === 0) {
        throw new Error('Invalid parameters for team assignment');
      }
      
      // Get all panels for this session
      const panelsQuery = query(
        collection(db, 'panels'),
        where('sessionId', '==', sessionId),
        orderBy('panelNumber', 'asc')
      );
      
      const panelsSnapshot = await getDocs(panelsQuery);
      const panels = panelsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      if (panels.length === 0) {
        throw new Error('No panels found for this session');
      }
      
      // Distribute teams
      const distribution = await this.distributeTeamsEqually(teamsList, panels);
      
      const batch = writeBatch(db);
      let conflicts = [];
      
      // Update panel documents, team documents, and faculty documents
      for (let i = 0; i < panels.length; i++) {
        const panel = panels[i];
        const teamIds = distribution[i];
        
        // Update panel with assigned teams
        const panelRef = doc(db, 'panels', panel.id);
        batch.update(panelRef, {
          assignedTeams: teamIds,
          teamCount: teamIds.length,
          updatedAt: serverTimestamp()
        });
        
        // Update faculty members' user documents with panelId (if not already set)
        if (panel.facultyMembers && panel.facultyMembers.length > 0) {
          for (const faculty of panel.facultyMembers) {
            const facultyRef = doc(db, 'users', faculty.email);
            batch.update(facultyRef, {
              panelId: panel.id,
              panelNumber: panel.panelNumber,
              sessionId: sessionId,
              updatedAt: serverTimestamp()
            });
          }
        }
        
        // Update each team with panelId
        for (const teamId of teamIds) {
          const team = teamsList.find(t => t.id === teamId);
          const teamRef = doc(db, 'teams', teamId);
          
          // Check for conflict
          const conflictCheck = await this.checkMentorConflict(teamId, panel.id);
          if (conflictCheck.hasConflict) {
            conflicts.push({
              teamId,
              teamName: team?.name,
              panelNumber: panel.panelNumber,
              reason: conflictCheck.reason
            });
          }
          
          batch.update(teamRef, {
            panelId: panel.id,
            panelNumber: panel.panelNumber,
            sessionId: sessionId,
            updatedAt: serverTimestamp()
          });
        }
      }
      
      await batch.commit();
      
      if (conflicts.length > 0) {
        logger.warn('Mentor conflicts detected:', conflicts);
        toast.warning('Teams assigned with some conflicts', {
          description: `${conflicts.length} team(s) have mentor conflicts. Review panel assignments.`
        });
      } else {
        toast.success('Teams assigned successfully!', {
          description: `Assigned ${teamsList.length} teams across ${panels.length} panels`
        });
      }
      
      return {
        success: true,
        distribution,
        conflicts,
        totalTeams: teamsList.length,
        totalPanels: panels.length
      };
      
    } catch (error) {
      logger.error('Error assigning teams to panels:', error);
      toast.error('Failed to assign teams', {
        description: error.message
      });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get all panels for a session
   */
  static async getPanelsBySession(sessionId) {
    try {
      const panelsQuery = query(
        collection(db, 'panels'),
        where('sessionId', '==', sessionId),
        orderBy('panelNumber', 'asc')
      );
      
      const snapshot = await getDocs(panelsQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
    } catch (error) {
      logger.error('Error fetching panels:', error);
      return [];
    }
  }
  
  /**
   * Get panel details by ID
   */
  static async getPanelDetails(panelId) {
    try {
      const panelDoc = await getDoc(doc(db, 'panels', panelId));
      
      if (!panelDoc.exists()) {
        return null;
      }
      
      return {
        id: panelDoc.id,
        ...panelDoc.data()
      };
      
    } catch (error) {
      logger.error('Error fetching panel details:', error);
      return null;
    }
  }
  
  /**
   * Add faculty member to panel
   */
  static async addFacultyToPanel(panelId, faculty) {
    try {
      const panelRef = doc(db, 'panels', panelId);
      const panelDoc = await getDoc(panelRef);
      
      if (!panelDoc.exists()) {
        throw new Error('Panel not found');
      }
      
      const panel = panelDoc.data();
      const facultyMembers = panel.facultyMembers || [];
      
      // Check if faculty already in panel
      if (facultyMembers.find(f => f.uid === faculty.uid)) {
        toast.info('Faculty already in this panel');
        return { success: false, message: 'Faculty already in panel' };
      }
      
      // Add faculty to panel
      facultyMembers.push({
        uid: faculty.uid,
        email: faculty.email,
        name: faculty.name,
        expertise: faculty.expertise || []
      });
      
      const batch = writeBatch(db);
      
      // Update panel
      batch.update(panelRef, {
        facultyMembers,
        actualSize: facultyMembers.length,
        updatedAt: serverTimestamp()
      });
      
      // Update faculty user document
      const userRef = doc(db, 'users', faculty.email);
      batch.update(userRef, {
        panelId: panelId,
        panelNumber: panel.panelNumber,
        sessionId: panel.sessionId,
        updatedAt: serverTimestamp()
      });
      
      await batch.commit();
      
      toast.success('Faculty added to panel');
      return { success: true };
      
    } catch (error) {
      logger.error('Error adding faculty to panel:', error);
      toast.error('Failed to add faculty', { description: error.message });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Remove faculty member from panel
   */
  static async removeFacultyFromPanel(panelId, facultyUid) {
    try {
      const panelRef = doc(db, 'panels', panelId);
      const panelDoc = await getDoc(panelRef);
      
      if (!panelDoc.exists()) {
        throw new Error('Panel not found');
      }
      
      const panel = panelDoc.data();
      const facultyMembers = panel.facultyMembers || [];
      
      // Find faculty
      const faculty = facultyMembers.find(f => f.uid === facultyUid);
      if (!faculty) {
        toast.info('Faculty not in this panel');
        return { success: false, message: 'Faculty not in panel' };
      }
      
      // Remove faculty from panel
      const updatedFacultyMembers = facultyMembers.filter(f => f.uid !== facultyUid);
      
      const batch = writeBatch(db);
      
      // Update panel
      batch.update(panelRef, {
        facultyMembers: updatedFacultyMembers,
        actualSize: updatedFacultyMembers.length,
        updatedAt: serverTimestamp()
      });
      
      // Update faculty user document (remove panelId)
      const userRef = doc(db, 'users', faculty.email);
      batch.update(userRef, {
        panelId: null,
        panelNumber: null,
        updatedAt: serverTimestamp()
      });
      
      await batch.commit();
      
      toast.success('Faculty removed from panel');
      return { success: true };
      
    } catch (error) {
      logger.error('Error removing faculty from panel:', error);
      toast.error('Failed to remove faculty', { description: error.message });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Add team to panel (manual assignment)
   */
  static async addTeamToPanel(panelId, teamId) {
    try {
      // Check for mentor conflict first
      const conflictCheck = await this.checkMentorConflict(teamId, panelId);
      
      if (conflictCheck.hasConflict) {
        toast.error('Cannot assign team', {
          description: conflictCheck.reason
        });
        return { 
          success: false, 
          conflict: true,
          reason: conflictCheck.reason 
        };
      }
      
      const panelRef = doc(db, 'panels', panelId);
      const panelDoc = await getDoc(panelRef);
      
      if (!panelDoc.exists()) {
        throw new Error('Panel not found');
      }
      
      const panel = panelDoc.data();
      const assignedTeams = panel.assignedTeams || [];
      
      // Check if team already assigned
      if (assignedTeams.includes(teamId)) {
        toast.info('Team already assigned to this panel');
        return { success: false, message: 'Team already assigned' };
      }
      
      // Add team to panel
      assignedTeams.push(teamId);
      
      const batch = writeBatch(db);
      
      // Update panel
      batch.update(panelRef, {
        assignedTeams,
        teamCount: assignedTeams.length,
        updatedAt: serverTimestamp()
      });
      
      // Update team document
      const teamRef = doc(db, 'teams', teamId);
      batch.update(teamRef, {
        panelId: panelId,
        panelNumber: panel.panelNumber,
        sessionId: panel.sessionId,
        updatedAt: serverTimestamp()
      });
      
      await batch.commit();
      
      toast.success('Team assigned to panel');
      return { success: true };
      
    } catch (error) {
      logger.error('Error adding team to panel:', error);
      toast.error('Failed to assign team', { description: error.message });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Remove team from panel
   */
  static async removeTeamFromPanel(panelId, teamId) {
    try {
      const panelRef = doc(db, 'panels', panelId);
      const panelDoc = await getDoc(panelRef);
      
      if (!panelDoc.exists()) {
        throw new Error('Panel not found');
      }
      
      const panel = panelDoc.data();
      const assignedTeams = panel.assignedTeams || [];
      
      // Remove team
      const updatedTeams = assignedTeams.filter(id => id !== teamId);
      
      const batch = writeBatch(db);
      
      // Update panel
      batch.update(panelRef, {
        assignedTeams: updatedTeams,
        teamCount: updatedTeams.length,
        updatedAt: serverTimestamp()
      });
      
      // Update team document (remove panelId)
      const teamRef = doc(db, 'teams', teamId);
      batch.update(teamRef, {
        panelId: null,
        panelNumber: null,
        updatedAt: serverTimestamp()
      });
      
      await batch.commit();
      
      toast.success('Team removed from panel');
      return { success: true };
      
    } catch (error) {
      logger.error('Error removing team from panel:', error);
      toast.error('Failed to remove team', { description: error.message });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Handle mentor change - check for panel conflicts and reassign if needed
   */
  static async handleMentorChange(teamId, oldMentorId, newMentorId) {
    try {
      const teamDoc = await getDoc(doc(db, 'teams', teamId));
      if (!teamDoc.exists()) {
        return { success: false, error: 'Team not found' };
      }
      
      const team = teamDoc.data();
      const currentPanelId = team.panelId;
      
      if (!currentPanelId) {
        // Team not assigned to panel yet, no conflict possible
        return { success: true, noAction: true };
      }
      
      // Check if new mentor is in current panel
      const conflictCheck = await this.checkMentorConflict(teamId, currentPanelId);
      
      if (conflictCheck.hasConflict) {
        // Need to reassign team to different panel
        
        // Remove from current panel
        await this.removeTeamFromPanel(currentPanelId, teamId);
        
        // Find suitable panel
        const panels = await this.getPanelsBySession(team.sessionId);
        
        for (const panel of panels) {
          if (panel.id === currentPanelId) continue; // Skip current panel
          
          const facultyUids = panel.facultyMembers.map(f => f.uid);
          if (!facultyUids.includes(newMentorId)) {
            // This panel is conflict-free
            await this.addTeamToPanel(panel.id, teamId);
            
            toast.success('Team reassigned due to mentor change', {
              description: `Moved to Panel ${panel.panelNumber}`
            });
            
            return { 
              success: true, 
              reassigned: true,
              newPanelId: panel.id,
              newPanelNumber: panel.panelNumber
            };
          }
        }
        
        // If no conflict-free panel found
        toast.warning('No suitable panel found', {
          description: 'Admin needs to manually reassign this team'
        });
        
        return { 
          success: false, 
          noSuitablePanel: true,
          message: 'Team needs manual panel assignment'
        };
      }
      
      // No conflict, no action needed
      return { success: true, noAction: true };
      
    } catch (error) {
      logger.error('Error handling mentor change:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Delete panel
   */
  static async deletePanel(panelId) {
    try {
      const panelDoc = await getDoc(doc(db, 'panels', panelId));
      
      if (!panelDoc.exists()) {
        throw new Error('Panel not found');
      }
      
      const panel = panelDoc.data();
      const batch = writeBatch(db);
      
      // Remove panelId from all faculty members
      for (const faculty of panel.facultyMembers) {
        const userRef = doc(db, 'users', faculty.email);
        batch.update(userRef, {
          panelId: null,
          panelNumber: null,
          updatedAt: serverTimestamp()
        });
      }
      
      // Remove panelId from all assigned teams
      for (const teamId of panel.assignedTeams) {
        const teamRef = doc(db, 'teams', teamId);
        batch.update(teamRef, {
          panelId: null,
          panelNumber: null,
          updatedAt: serverTimestamp()
        });
      }
      
      // Delete panel document
      batch.delete(doc(db, 'panels', panelId));
      
      await batch.commit();
      
      toast.success('Panel deleted successfully');
      return { success: true };
      
    } catch (error) {
      logger.error('Error deleting panel:', error);
      toast.error('Failed to delete panel', { description: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete ALL panels for a session
   * Removes all panel assignments from faculty and teams
   */
  static async deleteAllPanels(sessionId) {
    try {
      // Get all panels for this session
      const panelsQuery = query(
        collection(db, 'panels'),
        where('sessionId', '==', sessionId)
      );
      
      const panelsSnapshot = await getDocs(panelsQuery);
      
      if (panelsSnapshot.empty) {
        toast.info('No panels found to delete');
        return { success: true, deletedCount: 0 };
      }

      // Get all users and teams for this session to clear their panel assignments
      const usersQuery = query(
        collection(db, 'users'),
        where('sessionId', '==', sessionId)
      );
      const teamsQuery = query(
        collection(db, 'teams'),
        where('sessionId', '==', sessionId)
      );

      const [usersSnapshot, teamsSnapshot] = await Promise.all([
        getDocs(usersQuery),
        getDocs(teamsQuery)
      ]);

      // Use batched writes (Firestore limit is 500 operations per batch)
      const batchSize = 500;
      let operationCount = 0;
      let currentBatch = writeBatch(db);
      const batches = [currentBatch];

      // Clear panelId from all users
      usersSnapshot.docs.forEach((userDoc) => {
        if (userDoc.data().panelId) {
          currentBatch.update(userDoc.ref, {
            panelId: null,
            panelNumber: null,
            updatedAt: serverTimestamp()
          });
          operationCount++;

          if (operationCount >= batchSize) {
            currentBatch = writeBatch(db);
            batches.push(currentBatch);
            operationCount = 0;
          }
        }
      });

      // Clear panelId from all teams
      teamsSnapshot.docs.forEach((teamDoc) => {
        if (teamDoc.data().panelId) {
          currentBatch.update(teamDoc.ref, {
            panelId: null,
            panelNumber: null,
            updatedAt: serverTimestamp()
          });
          operationCount++;

          if (operationCount >= batchSize) {
            currentBatch = writeBatch(db);
            batches.push(currentBatch);
            operationCount = 0;
          }
        }
      });

      // Delete all panel documents
      panelsSnapshot.docs.forEach((panelDoc) => {
        currentBatch.delete(panelDoc.ref);
        operationCount++;

        if (operationCount >= batchSize) {
          currentBatch = writeBatch(db);
          batches.push(currentBatch);
          operationCount = 0;
        }
      });

      // Commit all batches
      await Promise.all(batches.map(batch => batch.commit()));

      return { 
        success: true, 
        deletedCount: panelsSnapshot.size,
        clearedFaculty: usersSnapshot.docs.filter(d => d.data().panelId).length,
        clearedTeams: teamsSnapshot.docs.filter(d => d.data().panelId).length
      };
      
    } catch (error) {
      logger.error('Error deleting all panels:', error);
      throw new Error(`Failed to delete all panels: ${error.message}`);
    }
  }

  /**
   * Bulk assign teams to panels based on project number ranges from CSV
   * CSV format: panel number, start range, end range (inclusive)
   * @param {string} sessionId - Session ID
   * @param {Array} panelRanges - Array of {panelNumber, startRange, endRange}
   * @returns {Object} Result with success status and assignment stats
   */
  static async bulkAssignTeamsByProjectRanges(sessionId, panelRanges) {
    try {
      if (!sessionId || !panelRanges || panelRanges.length === 0) {
        throw new Error('Invalid parameters for bulk assignment');
      }

      // Get all panels for this session
      const panelsQuery = query(
        collection(db, 'panels'),
        where('sessionId', '==', sessionId),
        orderBy('panelNumber', 'asc')
      );
      const panelsSnapshot = await getDocs(panelsQuery);
      const panels = panelsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (panels.length === 0) {
        throw new Error('No panels found for this session. Please create panels first.');
      }

      // Create panelNumber -> panelId mapping
      const panelMap = {};
      panels.forEach(panel => {
        panelMap[panel.panelNumber] = panel;
      });

      // Validate all panel numbers in CSV exist
      const missingPanels = [...new Set(panelRanges.map(r => r.panelNumber))]
        .filter(pn => !panelMap[pn]);
      
      if (missingPanels.length > 0) {
        throw new Error(`Panels not found: ${missingPanels.join(', ')}`);
      }

      // Get all teams for this session
      const teamsQuery = query(
        collection(db, 'teams'),
        where('sessionId', '==', sessionId),
        orderBy('projectNumber', 'asc')
      );
      const teamsSnapshot = await getDocs(teamsQuery);
      const teams = teamsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (teams.length === 0) {
        throw new Error('No teams found for this session');
      }

      // Create projectNumber -> team mapping
      const teamByProjectNumber = {};
      teams.forEach(team => {
        if (team.projectNumber) {
          teamByProjectNumber[team.projectNumber] = team;
        }
      });

      // Build panel assignments: panelId -> [teamIds]
      const panelAssignments = {};
      panels.forEach(panel => {
        panelAssignments[panel.id] = [];
      });

      let assignedCount = 0;
      let notFoundCount = 0;
      const notFoundProjectNumbers = [];

      // Process each range from CSV
      for (const range of panelRanges) {
        const { panelNumber, startRange, endRange } = range;
        const panel = panelMap[panelNumber];

        for (let pn = startRange; pn <= endRange; pn++) {
          const team = teamByProjectNumber[pn];
          if (team) {
            panelAssignments[panel.id].push({
              teamId: team.id,
              panelId: panel.id,
              panelNumber: panel.panelNumber
            });
            assignedCount++;
          } else {
            notFoundCount++;
            notFoundProjectNumbers.push(pn);
          }
        }
      }

      // Execute batch updates (handle 500-op limit)
      const batchSize = 450; // Leave room for panel updates
      let currentBatch = writeBatch(db);
      let operationCount = 0;
      const batches = [currentBatch];

      // Update team documents with panelId
      for (const panelId of Object.keys(panelAssignments)) {
        const assignments = panelAssignments[panelId];
        
        for (const assignment of assignments) {
          const teamRef = doc(db, 'teams', assignment.teamId);
          currentBatch.update(teamRef, {
            panelId: assignment.panelId,
            panelNumber: assignment.panelNumber,
            updatedAt: serverTimestamp()
          });
          operationCount++;

          if (operationCount >= batchSize) {
            currentBatch = writeBatch(db);
            batches.push(currentBatch);
            operationCount = 0;
          }
        }
      }

      // Update panel documents with assignedTeams arrays
      for (const panelId of Object.keys(panelAssignments)) {
        const teamIds = panelAssignments[panelId].map(a => a.teamId);
        const panelRef = doc(db, 'panels', panelId);
        
        currentBatch.update(panelRef, {
          assignedTeams: teamIds,
          teamCount: teamIds.length,
          updatedAt: serverTimestamp()
        });
        operationCount++;

        if (operationCount >= batchSize) {
          currentBatch = writeBatch(db);
          batches.push(currentBatch);
          operationCount = 0;
        }
      }

      // Commit all batches
      await Promise.all(batches.map(batch => batch.commit()));

      const result = {
        success: true,
        assignedCount,
        notFoundCount,
        notFoundProjectNumbers: notFoundProjectNumbers.slice(0, 20), // Limit for display
        totalPanels: panels.length,
        batchCount: batches.length
      };

      if (notFoundCount > 0) {
        toast.success(`Assigned ${assignedCount} teams`, {
          description: `${notFoundCount} project number(s) not found`
        });
      } else {
        toast.success(`Successfully assigned ${assignedCount} teams to panels!`);
      }

      return result;

    } catch (error) {
      logger.error('Error in bulk panel assignment:', error);
      toast.error('Bulk assignment failed', {
        description: error.message
      });
      return { success: false, error: error.message };
    }
  }
}

export default PanelService;

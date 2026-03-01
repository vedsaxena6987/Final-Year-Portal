// services/extensionService.js
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  where,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

import { logger } from "../lib/logger";
/**
 * ExtensionService - Manages phase deadline extensions for teams
 * 
 * Extensions Collection Schema:
 * {
 *   phaseId: string,
 *   teamId: string,
 *   originalDeadline: Timestamp,
 *   extendedDeadline: Timestamp,
 *   reason: string,
 *   grantedBy: string (admin email),
 *   grantedAt: Timestamp,
 *   active: boolean
 * }
 */

const ExtensionService = {
  /**
   * Grant a deadline extension to a team for a specific phase
   */
  async grantExtension({ phaseId, teamId, extendedDeadline, reason, grantedBy }) {
    try {
      // Validate inputs
      if (!phaseId || !teamId || !extendedDeadline) {
        return { success: false, error: 'Missing required fields' };
      }

      // Get phase to validate extended deadline is after original
      const phaseRef = doc(db, 'phases', phaseId);
      const phaseSnap = await getDoc(phaseRef);
      
      if (!phaseSnap.exists()) {
        return { success: false, error: 'Phase not found' };
      }

      const phaseData = phaseSnap.data();
      const originalDeadline = phaseData.endDate;

      // Validate extended deadline is after original
      if (extendedDeadline <= originalDeadline.toDate()) {
        return { success: false, error: 'Extended deadline must be after original deadline' };
      }

      // Check if extension already exists (revoke old one first)
      const existingExtensions = await this.getTeamExtensions(teamId, phaseId);
      if (existingExtensions.length > 0) {
        // Revoke existing extensions
        for (const ext of existingExtensions) {
          await deleteDoc(doc(db, 'extensions', ext.id));
        }
      }

      // Create new extension
      const extensionData = {
        phaseId,
        teamId,
        originalDeadline,
        extendedDeadline: Timestamp.fromDate(new Date(extendedDeadline)),
        reason: reason || 'No reason provided',
        grantedBy,
        grantedAt: serverTimestamp(),
        active: true
      };

      const extensionRef = await addDoc(collection(db, 'extensions'), extensionData);

      return { 
        success: true, 
        extensionId: extensionRef.id,
        message: 'Extension granted successfully' 
      };
    } catch (error) {
      logger.error('Error granting extension:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Grant extensions to multiple teams at once
   */
  async grantBulkExtensions({ phaseId, teamIds, extendedDeadline, reason, grantedBy }) {
    try {
      const results = {
        successful: [],
        failed: []
      };

      for (const teamId of teamIds) {
        const result = await this.grantExtension({
          phaseId,
          teamId,
          extendedDeadline,
          reason,
          grantedBy
        });

        if (result.success) {
          results.successful.push(teamId);
        } else {
          results.failed.push({ teamId, error: result.error });
        }
      }

      return {
        success: true,
        results,
        message: `Extensions granted to ${results.successful.length} team(s)`
      };
    } catch (error) {
      logger.error('Error granting bulk extensions:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Revoke an extension
   */
  async revokeExtension(extensionId) {
    try {
      await deleteDoc(doc(db, 'extensions', extensionId));
      return { success: true, message: 'Extension revoked successfully' };
    } catch (error) {
      logger.error('Error revoking extension:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Check if a team has an active extension for a phase
   */
  async hasExtension(teamId, phaseId) {
    try {
      const extensions = await this.getTeamExtensions(teamId, phaseId);
      return extensions.length > 0;
    } catch (error) {
      logger.error('Error checking extension:', error);
      return false;
    }
  },

  /**
   * Get extension details for a team and phase
   */
  async getExtensionDetails(teamId, phaseId) {
    try {
      const extensions = await this.getTeamExtensions(teamId, phaseId);
      return extensions.length > 0 ? extensions[0] : null;
    } catch (error) {
      logger.error('Error getting extension details:', error);
      return null;
    }
  },

  /**
   * Get all extensions for a team in a specific phase
   */
  async getTeamExtensions(teamId, phaseId) {
    try {
      const q = query(
        collection(db, 'extensions'),
        where('teamId', '==', teamId),
        where('phaseId', '==', phaseId),
        where('active', '==', true)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      logger.error('Error getting team extensions:', error);
      return [];
    }
  },

  /**
   * Get all extensions for a phase
   */
  async getPhaseExtensions(phaseId) {
    try {
      const q = query(
        collection(db, 'extensions'),
        where('phaseId', '==', phaseId),
        where('active', '==', true)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      logger.error('Error getting phase extensions:', error);
      return [];
    }
  },

  /**
   * Get effective deadline for a team (with extension if exists)
   */
  async getEffectiveDeadline(teamId, phaseId, originalDeadline) {
    try {
      const extension = await this.getExtensionDetails(teamId, phaseId);
      
      if (extension && extension.extendedDeadline) {
        return {
          deadline: extension.extendedDeadline.toDate(),
          isExtended: true,
          extensionId: extension.id,
          reason: extension.reason
        };
      }

      return {
        deadline: originalDeadline,
        isExtended: false
      };
    } catch (error) {
      logger.error('Error getting effective deadline:', error);
      return {
        deadline: originalDeadline,
        isExtended: false
      };
    }
  },

  /**
   * Check if deadline has passed (considering extensions)
   */
  async isDeadlinePassed(teamId, phaseId, originalDeadline) {
    try {
      const { deadline } = await this.getEffectiveDeadline(teamId, phaseId, originalDeadline);
      return new Date() > new Date(deadline);
    } catch (error) {
      logger.error('Error checking deadline:', error);
      return new Date() > new Date(originalDeadline);
    }
  },

  /**
   * Update extension deadline
   */
  async updateExtension(extensionId, { extendedDeadline, reason }) {
    try {
      const updateData = {};
      
      if (extendedDeadline) {
        updateData.extendedDeadline = Timestamp.fromDate(new Date(extendedDeadline));
      }
      
      if (reason) {
        updateData.reason = reason;
      }

      updateData.updatedAt = serverTimestamp();

      await updateDoc(doc(db, 'extensions', extensionId), updateData);

      return { success: true, message: 'Extension updated successfully' };
    } catch (error) {
      logger.error('Error updating extension:', error);
      return { success: false, error: error.message };
    }
  }
};

export default ExtensionService;

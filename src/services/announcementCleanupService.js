// services/announcementCleanupService.js
"use client";

import { 
  collection, 
  query, 
  where, 
  getDocs, 
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

import { logger } from "../lib/logger";
/**
 * Service for cleaning up old system announcements
 * Automatically marks announcements older than specified days as read
 */
export class AnnouncementCleanupService {
  /**
   * Mark announcements older than specified days as read
   * @param {number} daysOld - Number of days after which to mark as read (default: 7)
   * @returns {Promise<{success: boolean, cleaned: number, error?: string}>}
   */
  static async cleanupOldAnnouncements(daysOld = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

      // Query for unread system announcements older than cutoff date
      const q = query(
        collection(db, 'notifications'),
        where('type', '==', 'system_announcement'),
        where('read', '==', false),
        where('createdAt', '<', cutoffTimestamp)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return { success: true, cleaned: 0 };
      }

      // Batch update to mark as read
      const batch = writeBatch(db);
      let count = 0;

      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { 
          read: true,
          autoCleanedAt: Timestamp.now()
        });
        count++;
      });

      await batch.commit();

      
      return { 
        success: true, 
        cleaned: count 
      };
    } catch (error) {
      logger.error('Error cleaning up announcements:', error);
      return { 
        success: false, 
        cleaned: 0, 
        error: error.message 
      };
    }
  }

  /**
   * Delete (permanently remove) announcements older than specified days
   * Use this for permanent cleanup instead of just marking as read
   * @param {number} daysOld - Number of days after which to delete (default: 30)
   * @returns {Promise<{success: boolean, deleted: number, error?: string}>}
   */
  static async deleteOldAnnouncements(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

      // Query for system announcements older than cutoff date
      const q = query(
        collection(db, 'notifications'),
        where('type', '==', 'system_announcement'),
        where('createdAt', '<', cutoffTimestamp)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return { success: true, deleted: 0 };
      }

      // Batch delete
      const batch = writeBatch(db);
      let count = 0;

      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        count++;
      });

      await batch.commit();

      
      return { 
        success: true, 
        deleted: count 
      };
    } catch (error) {
      logger.error('Error deleting announcements:', error);
      return { 
        success: false, 
        deleted: 0, 
        error: error.message 
      };
    }
  }

  /**
   * Mark all announcements for a specific user as read
   * @param {string} userEmail - User's email address
   * @returns {Promise<{success: boolean, marked: number, error?: string}>}
   */
  static async markAllAsRead(userEmail) {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('type', '==', 'system_announcement'),
        where('recipientEmail', '==', userEmail),
        where('read', '==', false)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return { success: true, marked: 0 };
      }

      const batch = writeBatch(db);
      let count = 0;

      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { 
          read: true,
          markedReadAt: Timestamp.now()
        });
        count++;
      });

      await batch.commit();
      
      return { 
        success: true, 
        marked: count 
      };
    } catch (error) {
      logger.error('Error marking announcements as read:', error);
      return { 
        success: false, 
        marked: 0, 
        error: error.message 
      };
    }
  }

  /**
   * Get statistics about announcements
   * @returns {Promise<{total: number, unread: number, old: number}>}
   */
  static async getAnnouncementStats() {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const cutoffTimestamp = Timestamp.fromDate(sevenDaysAgo);

      // Get all system announcements
      const allQuery = query(
        collection(db, 'notifications'),
        where('type', '==', 'system_announcement')
      );

      // Get unread announcements
      const unreadQuery = query(
        collection(db, 'notifications'),
        where('type', '==', 'system_announcement'),
        where('read', '==', false)
      );

      // Get old unread announcements
      const oldQuery = query(
        collection(db, 'notifications'),
        where('type', '==', 'system_announcement'),
        where('read', '==', false),
        where('createdAt', '<', cutoffTimestamp)
      );

      const [allSnap, unreadSnap, oldSnap] = await Promise.all([
        getDocs(allQuery),
        getDocs(unreadQuery),
        getDocs(oldQuery)
      ]);

      return {
        total: allSnap.size,
        unread: unreadSnap.size,
        old: oldSnap.size
      };
    } catch (error) {
      logger.error('Error getting announcement stats:', error);
      return { total: 0, unread: 0, old: 0 };
    }
  }
}

export default AnnouncementCleanupService;

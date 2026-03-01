// hooks/useNotifications.js
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSession } from '@/context/SessionContext';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit, 
  doc, 
  writeBatch, 
  serverTimestamp,
  getDocs,
  updateDoc
} from 'firebase/firestore';
import { toast } from 'sonner';

import { logger } from "../lib/logger";
export function useNotifications() {
  const { userData } = useAuth();
  const { activeSession } = useSession();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData?.email || !activeSession?.id) {
      setLoading(false);
      return;
    }

    // Listen for notifications
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('recipientEmail', '==', userData.email),
      where('sessionId', '==', activeSession.id),
      orderBy('createdAt', 'desc'),
      limit(50) // Limit to recent notifications
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const notificationsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));
      
      setNotifications(notificationsList);
      setUnreadCount(notificationsList.filter(n => !n.read).length);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData?.email, activeSession?.id]);

  const markAsRead = async (notificationId) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        read: true,
        readAt: serverTimestamp()
      });
    } catch (error) {
      logger.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const batch = writeBatch(db);
      const unreadNotifications = notifications.filter(n => !n.read);
      
      unreadNotifications.forEach(notification => {
        const notificationRef = doc(db, 'notifications', notification.id);
        batch.update(notificationRef, {
          read: true,
          readAt: serverTimestamp()
        });
      });

      await batch.commit();
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      toast.error('Failed to mark notifications as read');
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead
  };
}

// Notification creation utilities
export async function createNotification(data) {
  try {
    const batch = writeBatch(db);
    const notificationRef = doc(collection(db, 'notifications'));
    
    batch.set(notificationRef, {
      ...data,
      read: false,
      createdAt: serverTimestamp()
    });

    await batch.commit();
    return true;
  } catch (error) {
    logger.error('Error creating notification:', error);
    return false;
  }
}

export async function createBulkNotifications(notifications) {
  try {
    const batch = writeBatch(db);
    
    notifications.forEach(notification => {
      const notificationRef = doc(collection(db, 'notifications'));
      batch.set(notificationRef, {
        ...notification,
        read: false,
        createdAt: serverTimestamp()
      });
    });

    await batch.commit();
    return true;
  } catch (error) {
    logger.error('Error creating bulk notifications:', error);
    return false;
  }
}

// Notification templates
export const NotificationTypes = {
  TEAM_INVITATION: 'team_invitation',
  MENTOR_REQUEST: 'mentor_request', 
  MENTOR_ASSIGNED: 'mentor_assigned',
  REVISION_REQUESTED: 'revision_requested',
  SUBMISSION_DUE: 'submission_due',
  SUBMISSION_SUBMITTED: 'submission_submitted',
  EVALUATION_ASSIGNED: 'evaluation_assigned',
  EVALUATION_COMPLETED: 'evaluation_completed',
  PHASE_CREATED: 'phase_created',
  DEADLINE_REMINDER: 'deadline_reminder',
  SYSTEM_ANNOUNCEMENT: 'system_announcement'
};

export const createNotificationTemplate = (type, data) => {
  const templates = {
    [NotificationTypes.TEAM_INVITATION]: {
      title: 'Team Invitation',
      message: `You've been invited to join team "${data.teamName}"`,
      type: 'team_invitation',
      priority: 'high',
      actionUrl: '/dashboard',
      icon: '👥'
    },
    [NotificationTypes.MENTOR_REQUEST]: {
      title: 'Mentorship Request',
      message: `New mentorship request from team "${data.teamName}" for project "${data.projectTitle}"`,
      type: 'mentor_request', 
      priority: 'medium',
      actionUrl: '/dashboard',
      icon: '🎓'
    },
    [NotificationTypes.MENTOR_ASSIGNED]: {
      title: 'Mentor Assigned',
      message: `${data.mentorName} has been assigned as your mentor`,
      type: 'mentor_assigned',
      priority: 'high', 
      actionUrl: '/dashboard',
      icon: '✅'
    },
    [NotificationTypes.REVISION_REQUESTED]: {
      title: 'Revision Requested',
      message: data.message || `${data.mentorName} has requested revisions to your project proposal`,
      type: 'revision_requested',
      priority: 'high',
      actionUrl: '/dashboard',
      icon: '📝'
    },
    [NotificationTypes.SUBMISSION_DUE]: {
      title: 'Submission Due Soon',
      message: `"${data.phaseName}" submission is due on ${data.dueDate}`,
      type: 'submission_due',
      priority: 'urgent',
      actionUrl: '/dashboard',
      icon: '⏰'
    },
    [NotificationTypes.SUBMISSION_SUBMITTED]: {
      title: 'Submission Received',
      message: `Team "${data.teamName}" submitted their "${data.phaseName}" deliverable`,
      type: 'submission_submitted',
      priority: 'low',
      actionUrl: '/dashboard',
      icon: '📄'
    },
    [NotificationTypes.EVALUATION_ASSIGNED]: {
      title: 'Evaluation Assignment',
      message: `You've been assigned to evaluate ${data.teamsCount} teams for "${data.phaseName}"`,
      type: 'evaluation_assigned',
      priority: 'medium',
      actionUrl: '/dashboard',
      icon: '📊'
    },
    [NotificationTypes.EVALUATION_COMPLETED]: {
      title: 'Evaluation Complete',
      message: `Your "${data.phaseName}" evaluation has been completed`,
      type: 'evaluation_completed',
      priority: 'medium',
      actionUrl: '/dashboard',
      icon: '🎯'
    },
    [NotificationTypes.PHASE_CREATED]: {
      title: 'New Phase Added',
      message: `New phase "${data.phaseName}" has been created with deadline ${data.deadline}`,
      type: 'phase_created',
      priority: 'medium',
      actionUrl: '/dashboard',
      icon: '📅'
    },
    [NotificationTypes.DEADLINE_REMINDER]: {
      title: 'Deadline Reminder',
      message: `"${data.phaseName}" deadline is in ${data.timeRemaining}`,
      type: 'deadline_reminder', 
      priority: 'urgent',
      actionUrl: '/dashboard',
      icon: '🚨'
    },
    [NotificationTypes.SYSTEM_ANNOUNCEMENT]: {
      title: data.title || 'System Announcement',
      message: data.message,
      type: 'system_announcement',
      priority: data.priority || 'medium',
      actionUrl: data.actionUrl || '/dashboard',
      icon: '📢'
    }
  };

  return templates[type] || {
    title: 'Notification',
    message: data.message || 'You have a new notification',
    type: 'general',
    priority: 'medium',
    actionUrl: '/dashboard',
    icon: '🔔'
  };
};

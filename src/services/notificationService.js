// services/notificationService.js
"use client";

import { 
  collection, 
  query, 
  where, 
  getDocs, 
  writeBatch, 
  serverTimestamp,
  doc,
  addDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createNotificationTemplate, NotificationTypes } from '@/hooks/useNotifications';

import { logger } from "../lib/logger";
export class NotificationService {
  // Send notification to a single user
  static async sendNotification(recipientEmail, type, data, sessionId) {
    try {
      const template = createNotificationTemplate(type, data);
      
      const notificationData = {
        ...template,
        recipientEmail,
        sessionId,
        read: false,
        createdAt: serverTimestamp(),
        ...data // Override template with specific data if provided
      };

      await addDoc(collection(db, 'notifications'), notificationData);
      return true;
    } catch (error) {
      logger.error('Error sending notification:', error);
      return false;
    }
  }

  // Send bulk notifications to multiple users
  static async sendBulkNotifications(recipients, type, data, sessionId) {
    try {
      const template = createNotificationTemplate(type, data);
      const batch = writeBatch(db);

      recipients.forEach(recipientEmail => {
        const notificationRef = doc(collection(db, 'notifications'));
        const notificationData = {
          ...template,
          recipientEmail,
          sessionId,
          read: false,
          createdAt: serverTimestamp(),
          ...data // Override template with specific data if provided
        };
        
        batch.set(notificationRef, notificationData);
      });

      await batch.commit();
      return true;
    } catch (error) {
      logger.error('Error sending bulk notifications:', error);
      return false;
    }
  }

  // Notify all students in a session
  static async notifyAllStudents(type, data, sessionId) {
    try {
      const studentsQuery = query(
        collection(db, 'users'),
        where('role', '==', 'student'),
        where('sessionId', '==', sessionId)
      );

      const studentsSnapshot = await getDocs(studentsQuery);
      const studentEmails = studentsSnapshot.docs.map(doc => doc.id);

      if (studentEmails.length > 0) {
        return await this.sendBulkNotifications(studentEmails, type, data, sessionId);
      }
      return true;
    } catch (error) {
      logger.error('Error notifying all students:', error);
      return false;
    }
  }

  // Notify all faculty in a session
  static async notifyAllFaculty(type, data, sessionId) {
    try {
      const facultyQuery = query(
        collection(db, 'users'),
        where('role', '==', 'faculty'),
        where('sessionId', '==', sessionId)
      );

      const facultySnapshot = await getDocs(facultyQuery);
      const facultyEmails = facultySnapshot.docs.map(doc => doc.id);

      if (facultyEmails.length > 0) {
        return await this.sendBulkNotifications(facultyEmails, type, data, sessionId);
      }
      return true;
    } catch (error) {
      logger.error('Error notifying all faculty:', error);
      return false;
    }
  }

  // Notify all users in a session (students + faculty + admins)
  static async notifyAllUsers(type, data, sessionId) {
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('sessionId', '==', sessionId)
      );

      const usersSnapshot = await getDocs(usersQuery);
      const userEmails = usersSnapshot.docs.map(doc => doc.id);

      if (userEmails.length > 0) {
        return await this.sendBulkNotifications(userEmails, type, data, sessionId);
      }
      return true;
    } catch (error) {
      logger.error('Error notifying all users:', error);
      return false;
    }
  }

  // Team-specific notifications
  static async notifyTeamMembers(teamId, type, data, sessionId) {
    try {
      const teamDoc = await getDocs(query(collection(db, 'teams'), where('__name__', '==', teamId)));
      if (teamDoc.empty) return false;

      const team = teamDoc.docs[0].data();
      const memberEmails = team.members || [];

      if (memberEmails.length > 0) {
        return await this.sendBulkNotifications(memberEmails, type, data, sessionId);
      }
      return true;
    } catch (error) {
      logger.error('Error notifying team members:', error);
      return false;
    }
  }

  // Mentor-specific notifications
  static async notifyMentor(mentorEmail, type, data, sessionId) {
    return await this.sendNotification(mentorEmail, type, data, sessionId);
  }

  // Panel-specific notifications
  static async notifyPanelMembers(panelId, type, data, sessionId) {
    try {
      const panelDoc = await getDocs(query(collection(db, 'panels'), where('__name__', '==', panelId)));
      if (panelDoc.empty) return false;

      const panel = panelDoc.docs[0].data();
      const memberEmails = panel.members || [];

      if (memberEmails.length > 0) {
        return await this.sendBulkNotifications(memberEmails, type, data, sessionId);
      }
      return true;
    } catch (error) {
      logger.error('Error notifying panel members:', error);
      return false;
    }
  }

  // Deadline reminder notifications
  static async sendDeadlineReminders(sessionId) {
    try {
      // Get active phases with upcoming deadlines
      const phasesQuery = query(
        collection(db, 'phases'),
        where('sessionId', '==', sessionId),
        where('isActive', '==', true)
      );

      const phasesSnapshot = await getDocs(phasesQuery);
      const now = new Date();
      const twoDaysFromNow = new Date(now.getTime() + (2 * 24 * 60 * 60 * 1000));
      const oneDayFromNow = new Date(now.getTime() + (24 * 60 * 60 * 1000));

      for (const phaseDoc of phasesSnapshot.docs) {
        const phase = phaseDoc.data();
        const deadline = phase.deadline?.toDate();
        
        if (!deadline) continue;

        let reminderType = null;
        let timeRemaining = '';

        // Check if deadline is within reminder window
        if (deadline > now && deadline <= twoDaysFromNow) {
          const hoursRemaining = Math.ceil((deadline - now) / (1000 * 60 * 60));
          if (hoursRemaining <= 24) {
            reminderType = 'urgent';
            timeRemaining = `${hoursRemaining} hours`;
          } else if (hoursRemaining <= 48) {
            reminderType = 'high';
            timeRemaining = `${Math.ceil(hoursRemaining / 24)} days`;
          }

          if (reminderType) {
            const data = {
              phaseName: phase.name,
              timeRemaining,
              deadline: deadline.toLocaleDateString(),
              priority: reminderType
            };

            // Notify appropriate users based on phase type
            if (phase.targetRole === 'student') {
              await this.notifyAllStudents(NotificationTypes.DEADLINE_REMINDER, data, sessionId);
            } else if (phase.targetRole === 'faculty') {
              await this.notifyAllFaculty(NotificationTypes.DEADLINE_REMINDER, data, sessionId);
            } else {
              await this.notifyAllUsers(NotificationTypes.DEADLINE_REMINDER, data, sessionId);
            }
          }
        }
      }

      return true;
    } catch (error) {
      logger.error('Error sending deadline reminders:', error);
      return false;
    }
  }

  // Auto-notification triggers for common events
  static async onTeamInvitation(inviterEmail, inviteeEmail, teamName, sessionId) {
    const data = {
      teamName,
      inviterName: inviterEmail // You might want to fetch the actual name
    };
    return await this.sendNotification(inviteeEmail, NotificationTypes.TEAM_INVITATION, data, sessionId);
  }

  static async onMentorshipRequest(mentorEmail, teamName, projectTitle, sessionId) {
    const data = {
      teamName,
      projectTitle
    };
    return await this.sendNotification(mentorEmail, NotificationTypes.MENTOR_REQUEST, data, sessionId);
  }

  static async onMentorAssigned(teamMembers, mentorName, sessionId) {
    const data = {
      mentorName
    };
    return await this.sendBulkNotifications(teamMembers, NotificationTypes.MENTOR_ASSIGNED, data, sessionId);
  }

  static async onRevisionRequested(teamMembers, mentorName, sessionId) {
    const data = {
      mentorName,
      message: `${mentorName} has requested revisions to your project proposal. Please review the feedback and resubmit.`
    };
    return await this.sendBulkNotifications(teamMembers, NotificationTypes.REVISION_REQUESTED, data, sessionId);
  }

  static async onSubmissionReceived(evaluatorEmails, teamName, phaseName, sessionId) {
    const data = {
      teamName,
      phaseName
    };
    return await this.sendBulkNotifications(evaluatorEmails, NotificationTypes.SUBMISSION_SUBMITTED, data, sessionId);
  }

  static async onEvaluationCompleted(teamMembers, phaseName, sessionId) {
    const data = {
      phaseName
    };
    return await this.sendBulkNotifications(teamMembers, NotificationTypes.EVALUATION_COMPLETED, data, sessionId);
  }

  static async onPhaseCreated(phaseName, deadline, targetRole, sessionId) {
    const data = {
      phaseName,
      deadline: deadline.toLocaleDateString()
    };

    if (targetRole === 'student') {
      return await this.notifyAllStudents(NotificationTypes.PHASE_CREATED, data, sessionId);
    } else if (targetRole === 'faculty') {
      return await this.notifyAllFaculty(NotificationTypes.PHASE_CREATED, data, sessionId);
    } else {
      return await this.notifyAllUsers(NotificationTypes.PHASE_CREATED, data, sessionId);
    }
  }

  static async onEvaluationAssigned(evaluatorEmails, teamsCount, phaseName, sessionId) {
    const data = {
      teamsCount,
      phaseName
    };
    return await this.sendBulkNotifications(evaluatorEmails, NotificationTypes.EVALUATION_ASSIGNED, data, sessionId);
  }

  // System announcements
  static async sendSystemAnnouncement(title, message, priority, targetRole, sessionId) {
    const data = {
      title,
      message,
      priority
    };

    if (targetRole === 'student') {
      return await this.notifyAllStudents(NotificationTypes.SYSTEM_ANNOUNCEMENT, data, sessionId);
    } else if (targetRole === 'faculty') {
      return await this.notifyAllFaculty(NotificationTypes.SYSTEM_ANNOUNCEMENT, data, sessionId);
    } else {
      return await this.notifyAllUsers(NotificationTypes.SYSTEM_ANNOUNCEMENT, data, sessionId);
    }
  }
}

// Auto-run deadline reminders (could be called by a cron job or cloud function)
export const setupNotificationScheduler = () => {
  // This would typically be implemented as a Cloud Function or cron job
  // For demo purposes, showing how it could be called
  
  // Example: Check for deadline reminders every hour
  // setInterval(async () => {
  //   const activeSession = await getActiveSession();
  //   if (activeSession) {
  //     await NotificationService.sendDeadlineReminders(activeSession.id);
  //   }
  // }, 60 * 60 * 1000); // 1 hour
};

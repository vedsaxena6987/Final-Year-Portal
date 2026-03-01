"use client";

import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { toast } from "sonner";

import { logger } from "../lib/logger";
/**
 * Team Invitation Service
 *
 * Handles the invitation workflow:
 * 1. Student requests to join team (creates invitation with status: 'pending')
 * 2. Team leader approves/rejects invitation
 * 3. If approved, student is IMMEDIATELY added to team (one-step approval)
 *
 * Status flow: pending → approved OR rejected_by_leader
 */

export const TeamInvitationService = {
  /**
   * Student requests to join a team using team code
   * Creates an invitation request that team leader must approve
   */
  async requestToJoin(
    teamCode,
    studentEmail,
    studentName,
    studentUid,
    sessionId,
  ) {
    try {
      // Find team by code
      const teamsQuery = query(
        collection(db, "teams"),
        where("teamCode", "==", teamCode.trim().toUpperCase()),
        where("sessionId", "==", sessionId),
      );

      const teamsSnapshot = await getDocs(teamsQuery);

      if (teamsSnapshot.empty) {
        return {
          success: false,
          message: "Team not found. Please check the team code.",
        };
      }

      const teamDoc = teamsSnapshot.docs[0];
      const teamData = teamDoc.data();

      // Validation checks
      if (teamData.members?.includes(studentEmail)) {
        return {
          success: false,
          message: "You are already a member of this team.",
        };
      }

      if (teamData.members?.length >= 4) {
        return {
          success: false,
          message: "This team is full (maximum 4 members).",
        };
      }

      // Check for existing pending invitation
      const existingQuery = query(
        collection(db, "team_invitations"),
        where("teamId", "==", teamDoc.id),
        where("studentEmail", "==", studentEmail),
        where("status", "in", ["pending", "approved_by_leader"]),
      );
      const existingSnapshot = await getDocs(existingQuery);

      if (!existingSnapshot.empty) {
        const status = existingSnapshot.docs[0].data().status;
        if (status === "pending") {
          return {
            success: false,
            message: "You already have a pending request to join this team.",
          };
        } else if (status === "approved_by_leader") {
          return {
            success: false,
            message:
              "Your request has been approved by the leader. Please check your notifications to accept.",
          };
        }
      }

      // Create invitation request
      const invitationData = {
        teamId: teamDoc.id,
        teamName: teamData.name,
        teamCode: teamData.teamCode,
        projectNumber: teamData.projectNumber,
        leaderId: teamData.leaderId,
        leaderName: teamData.leaderName,
        leaderEmail: teamData.leaderEmail,
        studentEmail,
        studentName,
        studentUid,
        status: "pending", // pending → approved_by_leader → accepted
        requestedAt: serverTimestamp(),
        sessionId,
      };

      const invitationRef = await addDoc(
        collection(db, "team_invitations"),
        invitationData,
      );

      // Notify team leader
      try {
        await addDoc(collection(db, "notifications"), {
          recipientEmail: teamData.leaderEmail,
          type: "team_join_request",
          title: "New Team Join Request",
          message: `${studentName} wants to join your team "${teamData.name}"`,
          link: "/dashboard",
          isRead: false,
          createdAt: serverTimestamp(),
          metadata: {
            invitationId: invitationRef.id,
            studentName,
            studentEmail,
            teamName: teamData.name,
          },
        });
      } catch (notifError) {
        logger.error("Failed to create notification:", notifError);
        // Continue - notification failure shouldn't block the request
      }

      toast.success("Join request sent!", {
        description: `Your request to join "${teamData.name}" has been sent to the team leader.`,
      });

      return {
        success: true,
        invitationId: invitationRef.id,
        message: "Join request sent successfully!",
      };
    } catch (error) {
      logger.error("Error requesting to join team:", error);
      toast.error("Failed to send join request", {
        description: error.message,
      });
      return {
        success: false,
        message: error.message,
      };
    }
  },

  /**
   * Team leader approves a join request
   * Immediately adds student to team and updates invitation status to 'approved'
   */
  async approveByLeader(invitationId) {
    try {
      const invitationRef = doc(db, "team_invitations", invitationId);
      const invitationDoc = await getDoc(invitationRef);

      if (!invitationDoc.exists()) {
        toast.error("Invitation not found");
        return { success: false, message: "Invitation not found" };
      }

      const invitationData = invitationDoc.data();

      // Use transaction to atomically add student to team
      // Capacity check MUST happen inside transaction to prevent race conditions
      await runTransaction(db, async (transaction) => {
        const teamRef = doc(db, "teams", invitationData.teamId);
        const teamDoc = await transaction.get(teamRef);

        if (!teamDoc.exists()) {
          throw new Error("Team not found");
        }

        const teamData = teamDoc.data();

        // CRITICAL: Validate team capacity inside transaction to prevent concurrent approvals
        const currentMemberCount = teamData.members?.length || 0;
        if (currentMemberCount >= 4) {
          throw new Error("Team is now full (maximum 4 members)");
        }

        // Validate student not already a member
        if (teamData.members?.includes(invitationData.studentEmail)) {
          throw new Error("Student is already a member of this team");
        }

        // Add student to team
        const updatedMembers = [
          ...(teamData.members || []),
          invitationData.studentEmail,
        ];
        const updatedMemberDetails = [
          ...(teamData.memberDetails || []),
          {
            email: invitationData.studentEmail,
            name: invitationData.studentName,
            uid: invitationData.studentUid,
            joinedAt: new Date(),
          },
        ];

        transaction.update(teamRef, {
          members: updatedMembers,
          memberDetails: updatedMemberDetails,
          updatedAt: serverTimestamp(),
        });

        // Update student's user document
        const userRef = doc(db, "users", invitationData.studentEmail);
        transaction.update(userRef, {
          teamId: invitationData.teamId,
          projectNumber: invitationData.projectNumber,
          updatedAt: serverTimestamp(),
        });

        // Update invitation status
        transaction.update(invitationRef, {
          status: "approved",
          approvedAt: serverTimestamp(),
        });
      });

      // Notify student that they've been added to team
      try {
        await addDoc(collection(db, "notifications"), {
          recipientEmail: invitationData.studentEmail,
          type: "team_join_approved",
          title: "Welcome to the Team! 🎉",
          message: `You have been added to "${invitationData.teamName}" by ${invitationData.leaderName}.`,
          link: "/dashboard",
          isRead: false,
          createdAt: serverTimestamp(),
          metadata: {
            invitationId,
            teamName: invitationData.teamName,
            leaderName: invitationData.leaderName,
            projectNumber: invitationData.projectNumber,
          },
        });
      } catch (notifError) {
        logger.error("Failed to create notification for student:", notifError);
      }

      // Notify team leader
      try {
        await addDoc(collection(db, "notifications"), {
          recipientEmail: invitationData.leaderEmail,
          type: "team_member_joined",
          title: "New Team Member Joined! 🎉",
          message: `${invitationData.studentName} has joined your team "${invitationData.teamName}".`,
          link: "/dashboard",
          isRead: false,
          createdAt: serverTimestamp(),
          metadata: {
            studentName: invitationData.studentName,
            teamName: invitationData.teamName,
          },
        });
      } catch (notifError) {
        logger.error("Failed to create notification for leader:", notifError);
      }

      toast.success("Student added to team!", {
        description: `${invitationData.studentName} is now a member of your team.`,
      });

      return {
        success: true,
        message: "Student added to team successfully!",
      };
    } catch (error) {
      logger.error("Error approving join request:", error);
      toast.error("Failed to approve request", {
        description: error.message,
      });
      return {
        success: false,
        message: error.message,
      };
    }
  },

  /**
   * Team leader rejects a join request
   */
  async rejectByLeader(invitationId, reason = "") {
    try {
      const invitationRef = doc(db, "team_invitations", invitationId);
      const invitationDoc = await getDoc(invitationRef);

      if (!invitationDoc.exists()) {
        toast.error("Invitation not found");
        return { success: false, message: "Invitation not found" };
      }

      const invitationData = invitationDoc.data();

      // Update invitation status
      await updateDoc(invitationRef, {
        status: "rejected_by_leader",
        rejectedByLeaderAt: serverTimestamp(),
        rejectionReason: reason,
      });

      // Notify student
      try {
        await addDoc(collection(db, "notifications"), {
          recipientEmail: invitationData.studentEmail,
          type: "team_join_rejected",
          title: "Team Join Request Declined",
          message: `Your request to join "${invitationData.teamName}" was declined.${reason ? ` Reason: ${reason}` : ""}`,
          link: "/dashboard",
          isRead: false,
          createdAt: serverTimestamp(),
          metadata: {
            invitationId,
            teamName: invitationData.teamName,
            reason,
          },
        });
      } catch (notifError) {
        logger.error("Failed to create notification for student:", notifError);
      }

      toast.success("Join request rejected");

      return {
        success: true,
        message: "Join request rejected successfully!",
      };
    } catch (error) {
      logger.error("Error rejecting join request:", error);
      toast.error("Failed to reject request", {
        description: error.message,
      });
      return {
        success: false,
        message: error.message,
      };
    }
  },

  /**
   * Get pending invitations for a team (for leader to review)
   */
  async getTeamInvitations(teamId) {
    try {
      const q = query(
        collection(db, "team_invitations"),
        where("teamId", "==", teamId),
        where("status", "==", "pending"),
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logger.error("Error fetching team invitations:", error);
      return [];
    }
  },
};

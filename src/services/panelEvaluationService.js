/**
 * Panel Evaluation Service
 * 
 * Handles evaluation logic for panel-type phases where multiple faculty members
 * evaluate the same team. Tracks which panelists have evaluated and calculates
 * aggregated marks.
 */

import { db } from '@/lib/firebase';
import { aggregatePanelEvaluations, getPanelProgressMeta } from '@/lib/panelAggregation';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';

import { logger } from "../lib/logger";
const PanelEvaluationService = {
  /**
   * Check if a faculty member has already evaluated a team for a specific phase
   * @param {string} teamId - Team ID
   * @param {string} phaseId - Phase ID
   * @param {string} facultyId - Faculty UID
   * @returns {Promise<{ hasEvaluated: boolean, evaluationId: string|null }>}
   */
  async checkFacultyEvaluation(teamId, phaseId, facultyId) {
    try {
      const evaluationsRef = collection(db, 'panelEvaluations');
      const q = query(
        evaluationsRef,
        where('teamId', '==', teamId),
        where('phaseId', '==', phaseId),
        where('evaluatorId', '==', facultyId)
      );

      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        return {
          hasEvaluated: true,
          evaluationId: snapshot.docs[0].id,
          evaluation: { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }
        };
      }

      return { hasEvaluated: false, evaluationId: null, evaluation: null };
    } catch (error) {
      logger.error('Error checking faculty evaluation:', error);
      throw error;
    }
  },

  /**
   * Submit or update panel evaluation for a team
   * @param {Object} evaluationData - Evaluation details
   * @param {string} evaluationData.teamId
   * @param {string} evaluationData.phaseId
   * @param {string} evaluationData.evaluatorId - Faculty UID
   * @param {Array} evaluationData.marks - Array of {studentEmail, studentName, marks}
   * @param {string} evaluationData.feedback
   * @param {number} evaluationData.maxMarks
   * @param {string} evaluationData.sessionId
   * @param {string} existingEvaluationId - If updating existing evaluation
   * @returns {Promise<{ success: boolean, evaluationId: string, error?: string }>}
   */
  async submitPanelEvaluation(evaluationData, existingEvaluationId = null) {
    try {
      const {
        teamId,
        phaseId,
        evaluatorId,
        marks,
        feedback,
        maxMarks,
        sessionId,
        phaseName
      } = evaluationData;

      const evalData = {
        teamId,
        phaseId,
        phaseName,
        evaluatorId,
        maxMarks,
        marks, // Array of individual student marks
        feedback,
        sessionId,
        submittedAt: serverTimestamp(),
        status: 'completed'
      };

      let evaluationId;

      if (existingEvaluationId) {
        // Update existing evaluation
        const evalRef = doc(db, 'panelEvaluations', existingEvaluationId);
        await updateDoc(evalRef, {
          ...evalData,
          updatedAt: serverTimestamp()
        });
        evaluationId = existingEvaluationId;
      } else {
        // Create new evaluation
        const evalRef = doc(collection(db, 'panelEvaluations'));
        await setDoc(evalRef, evalData);
        evaluationId = evalRef.id;
      }

      // Update submission + grade summaries after each evaluation
      await this.updateTeamEvaluationStatus(teamId, phaseId);
      await this.updateSubmissionAfterPanelEvaluation(teamId, phaseId);

      return {
        success: true,
        evaluationId
      };
    } catch (error) {
      logger.error('Error submitting panel evaluation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Get all evaluations for a team in a specific phase
   * @param {string} teamId
   * @param {string} phaseId
   * @returns {Promise<Array>} Array of evaluation objects
   */
  async getTeamPhaseEvaluations(teamId, phaseId) {
    try {
      const evaluationsRef = collection(db, 'panelEvaluations');
      const q = query(
        evaluationsRef,
        where('teamId', '==', teamId),
        where('phaseId', '==', phaseId)
      );

      const snapshot = await getDocs(q);
      const evaluations = [];

      for (const docSnap of snapshot.docs) {
        const evalData = docSnap.data();
        
        // Fetch evaluator name
        const evaluatorDoc = await getDoc(doc(db, 'users', evalData.evaluatorId));
        const evaluatorName = evaluatorDoc.exists() 
          ? evaluatorDoc.data().name 
          : 'Unknown Evaluator';

        evaluations.push({
          id: docSnap.id,
          ...evalData,
          evaluatorName
        });
      }

      return evaluations;
    } catch (error) {
      logger.error('Error fetching team evaluations:', error);
      return [];
    }
  },

  /**
   * Calculate aggregated marks across all panel evaluations
   * @param {string} teamId
   * @param {string} phaseId
   * @returns {Promise<Object>} Aggregated marks data
   */
  async calculateAggregatedMarks(teamId, phaseId) {
    try {
      const evaluations = await this.getTeamPhaseEvaluations(teamId, phaseId);
      const aggregated = aggregatePanelEvaluations(evaluations);

      return {
        ...aggregated,
        evaluations
      };
    } catch (error) {
      logger.error('Error calculating aggregated marks:', error);
      return {
        hasEvaluations: false,
        evaluationCount: 0,
        aggregatedMarks: [],
        teamAverage: 0,
        absentStudents: []
      };
    }
  },

  /**
   * Get panel members and their evaluation status for a phase
   * @param {string} teamId
   * @param {string} phaseId
   * @param {string} panelId
   * @returns {Promise<Array>} Panel members with evaluation status
   */
  async getPanelEvaluationStatus(teamId, phaseId, panelId) {
    try {
      // Get panel details
      const panelDoc = await getDoc(doc(db, 'panels', panelId));
      if (!panelDoc.exists()) {
        return [];
      }

      const panel = panelDoc.data();
      const facultyMembers = panel.facultyMembers || [];

      // Get all evaluations for this team and phase
      const evaluations = await this.getTeamPhaseEvaluations(teamId, phaseId);
      const evaluatedByIds = evaluations.map(e => e.evaluatorId);

      // Map panel members with their evaluation status
      const membersStatus = facultyMembers.map(member => ({
        uid: member.uid,
        name: member.name,
        email: member.email,
        hasEvaluated: evaluatedByIds.includes(member.uid),
        evaluation: evaluations.find(e => e.evaluatorId === member.uid) || null
      }));

      return membersStatus;
    } catch (error) {
      logger.error('Error getting panel evaluation status:', error);
      return [];
    }
  },

  /**
   * Get detailed evaluation data for student view
   * Shows per-panelist evaluation status including marks, feedback, and absent status
   * @param {string} teamId - Team ID
   * @param {string} phaseId - Phase ID
   * @param {string} panelId - Panel ID
   * @param {string} studentEmail - Student's email to get their specific marks
   * @returns {Promise<Object>} Detailed evaluation data for student view
   */
  async getStudentEvaluationDetails(teamId, phaseId, panelId, studentEmail) {
    try {
      // Get panel details
      const panelDoc = await getDoc(doc(db, 'panels', panelId));
      if (!panelDoc.exists()) {
        return { panelMembers: [], studentAverageMarks: null };
      }

      const panel = panelDoc.data();
      const facultyMembers = panel.facultyMembers || [];

      // Get all evaluations for this team and phase
      const evaluations = await this.getTeamPhaseEvaluations(teamId, phaseId);

      // Build detailed panel member evaluation data
      let totalMarks = 0;
      let evaluatedCount = 0;

      const panelMembers = facultyMembers.map(member => {
        const evaluation = evaluations.find(e => e.evaluatorId === member.uid);
        
        // Find this student's data in the evaluation
        let studentData = null;
        if (evaluation && evaluation.marks) {
          const studentMark = evaluation.marks.find(
            m => m.studentEmail?.toLowerCase() === studentEmail?.toLowerCase()
          );
          if (studentMark) {
            studentData = {
              marks: studentMark.marks,
              isAbsent: !studentMark.isPresent || studentMark.isAbsent,
              feedback: studentMark.feedback || ''
            };
            
            // Only count marks if student was present
            if (!studentData.isAbsent && typeof studentMark.marks === 'number') {
              totalMarks += studentMark.marks;
              evaluatedCount++;
            }
          }
        }

        return {
          uid: member.uid,
          name: member.name,
          email: member.email,
          hasEvaluated: Boolean(evaluation),
          evaluatedAt: evaluation?.submittedAt?.toDate?.() || evaluation?.submittedAt || null,
          studentData // Contains marks, isAbsent, feedback for this specific student
        };
      });

      // Calculate student's average marks (only from panelists who evaluated and marked present)
      const studentAverageMarks = evaluatedCount > 0 
        ? Number((totalMarks / evaluatedCount).toFixed(2))
        : null;

      return {
        panelMembers,
        studentAverageMarks,
        evaluatedCount,
        totalPanelists: facultyMembers.length
      };
    } catch (error) {
      logger.error('Error getting student evaluation details:', error);
      return { panelMembers: [], studentAverageMarks: null };
    }
  },

  /**
   * Check if minimum panelists requirement is met
   * @param {string} teamId
   * @param {string} phaseId
   * @param {number} minRequired - Minimum number of panelists required
   * @returns {Promise<{ isMet: boolean, current: number, required: number }>}
   */
  async checkMinimumPanelistsRequirement(teamId, phaseId, minRequired) {
    try {
      const evaluations = await this.getTeamPhaseEvaluations(teamId, phaseId);
      
      return {
        isMet: evaluations.length >= minRequired,
        current: evaluations.length,
        required: minRequired
      };
    } catch (error) {
      logger.error('Error checking minimum requirement:', error);
      return {
        isMet: false,
        current: 0,
        required: minRequired
      };
    }
  },

  /**
   * Update team's evaluation status (internal helper)
   */
  async updateTeamEvaluationStatus(teamId, phaseId) {
    try {
      // Get team document
      const teamRef = doc(db, 'teams', teamId);
      const teamSnap = await getDoc(teamRef);
      
      if (!teamSnap.exists()) return;

      const evaluatedPhases = teamSnap.data().evaluatedPhases || {};
      evaluatedPhases[phaseId] = {
        lastEvaluatedAt: serverTimestamp(),
        status: 'evaluated'
      };

      await updateDoc(teamRef, {
        evaluatedPhases
      });
    } catch (error) {
      logger.error('Error updating team evaluation status:', error);
    }
  },

  /**
   * Update submission doc + grades after panel evaluation to reflect progress
   */
  async updateSubmissionAfterPanelEvaluation(teamId, phaseId) {
    try {
      const [phaseDoc, teamDoc] = await Promise.all([
        getDoc(doc(db, 'phases', phaseId)),
        getDoc(doc(db, 'teams', teamId))
      ]);

      const phaseData = phaseDoc.exists() ? phaseDoc.data() : null;
      const teamData = teamDoc.exists() ? teamDoc.data() : null;
      const minRequired = phaseData?.minPanelistsMeetRequired || 1;

      const aggregatedData = await this.calculateAggregatedMarks(teamId, phaseId);

      let totalPanelists = null;
      if (teamData?.panelId) {
        const panelDoc = await getDoc(doc(db, 'panels', teamData.panelId));
        totalPanelists = panelDoc.exists() 
          ? (panelDoc.data().facultyMembers || []).length 
          : null;
      }

      const { status, progress } = getPanelProgressMeta({
        evaluationCount: aggregatedData.evaluationCount,
        minRequired,
        totalPanelists
      });

      const submissionQuery = query(
        collection(db, 'submissions'),
        where('teamId', '==', teamId),
        where('phaseId', '==', phaseId),
        limit(1)
      );

      const submissionSnapshot = await getDocs(submissionQuery);
      if (!submissionSnapshot.empty) {
        const submissionRef = doc(db, 'submissions', submissionSnapshot.docs[0].id);
        const updatePayload = {
          evaluationStatus: status,
          updatedAt: serverTimestamp(),
          panelEvaluationProgress: {
            ...progress,
            lastUpdated: serverTimestamp()
          },
          panelEvaluationSummary: {
            teamAverage: aggregatedData.teamAverage,
            aggregatedMarks: aggregatedData.aggregatedMarks,
            evaluationCount: aggregatedData.evaluationCount,
            absentStudents: aggregatedData.absentStudents || []
          }
        };

        if (status === 'evaluated') {
          updatePayload.evaluatedAt = serverTimestamp();
        }

        await updateDoc(submissionRef, updatePayload);
      }

      if (status === 'evaluated' && aggregatedData.aggregatedMarks.length > 0) {
        await this.syncGradesFromPanelEvaluations({
          teamId,
          phaseId,
          teamData,
          phaseData,
          aggregatedMarks: aggregatedData.aggregatedMarks
        });
      }
    } catch (error) {
      logger.error('Error updating submission after panel evaluation:', error);
    }
  },

  /**
   * Upsert aggregated grades for each student once panel requirement is met
   */
  async syncGradesFromPanelEvaluations({ teamId, phaseId, teamData, phaseData, aggregatedMarks }) {
    try {
      const phaseName = phaseData?.phaseName || phaseData?.name || 'Phase';
      const maxMarks = phaseData?.maxMarks || 100;
      const sessionId = teamData?.sessionId;
      const teamName = teamData?.name || teamData?.teamName || 'Team';

      for (const student of aggregatedMarks) {
        const gradesQuery = query(
          collection(db, 'grades'),
          where('studentEmail', '==', student.studentEmail),
          where('phaseId', '==', phaseId),
          where('teamId', '==', teamId),
          limit(1)
        );

        const gradesSnapshot = await getDocs(gradesQuery);
        const gradePayload = {
          studentEmail: student.studentEmail,
          studentName: student.studentName,
          teamId,
          teamName,
          phaseId,
          phaseName,
          maxMarks,
          marks: Number(student.averageMarks.toFixed(2)),
          isAbsent: student.wasAbsent || false,
          feedback: student.wasAbsent
            ? 'Marked absent by panel'
            : `Average of ${student.individualMarks.length} panelist evaluation${student.individualMarks.length === 1 ? '' : 's'}`,
          evaluatedBy: 'panel_average',
          evaluatedAt: serverTimestamp(),
          sessionId
        };

        if (!gradesSnapshot.empty) {
          await updateDoc(doc(db, 'grades', gradesSnapshot.docs[0].id), {
            ...gradePayload,
            updatedAt: serverTimestamp()
          });
        } else {
          await addDoc(collection(db, 'grades'), gradePayload);
        }
      }
    } catch (error) {
      logger.error('Error syncing panel grades:', error);
    }
  }
};

export default PanelEvaluationService;

// lib/phaseSchema.js
/**
 * Phase Management System - Data Structure Schema & Validation
 * 
 * This file defines the Firestore schema for phases, submissions, and evaluations.
 * It also provides validation functions to ensure data integrity.
 */

/**
 * Phase Document Schema (Firestore collection: 'phases')
 * 
 * @typedef {Object} Phase
 * @property {string} id - Auto-generated Firestore document ID
 * @property {string} phaseName - Custom phase name (e.g., "Mid-Term Demo")
 * @property {string} description - Phase instructions and requirements
 * @property {Date|Timestamp} startDate - When phase becomes active/visible
 * @property {Date|Timestamp} endDate - Submission deadline
 * @property {number} maxMarks - Maximum points for this phase (e.g., 100)
 * @property {('mentor'|'panel')} evaluatorRole - Who evaluates: mentor or panel
 * @property {number} sequenceOrder - Phase order (1, 2, 3...) for sequential completion
 * @property {string} sessionId - Academic session ID
 * @property {boolean} allowLateSubmission - Admin toggle for late submissions
 * @property {boolean} isActive - Phase can be deactivated without deletion
 * @property {Date|Timestamp} createdAt - Phase creation time (for 1-hour delete window)
 * @property {string} createdBy - Admin email who created the phase
 * @property {Date|Timestamp} updatedAt - Last modification time
 */

/**
 * Submission Document Schema (Firestore collection: 'submissions')
 * 
 * @typedef {Object} Submission
 * @property {string} id - Auto-generated Firestore document ID
 * @property {string} teamId - Team ID
 * @property {string} teamName - Team name for display
 * @property {string} phaseId - Phase ID
 * @property {string} phaseName - Phase name for display
 * @property {string} sessionId - Academic session ID
 * @property {Array<File>} files - Array of file objects with drive links
 * @property {string} description - Optional text description
 * @property {string} submittedBy - Student email who submitted
 * @property {Date|Timestamp} submittedAt - Submission timestamp
 * @property {Date|Timestamp} resubmittedAt - Resubmission timestamp (if any)
 * @property {('submitted'|'pending'|'evaluated'|'revisions_requested')} status - Submission status
 * @property {('pending'|'evaluated'|'revisions_requested')} evaluationStatus - Evaluation status
 * @property {boolean} isLateSubmission - Flag for submissions after deadline
 * @property {string} lateSubmissionApprovedBy - Admin who approved late submission
 * @property {string} evaluationFeedback - Feedback from evaluator
 * @property {string} revisionFeedback - Feedback requesting revisions
 * @property {Date|Timestamp} evaluatedAt - When evaluation was completed
 * @property {Date|Timestamp} updatedAt - Last update timestamp
 */

/**
 * File Object Schema (nested in Submission)
 * 
 * @typedef {Object} File
 * @property {string} name - File name/description
 * @property {string} url - Google Drive link
 * @property {string} type - File type (pdf, ppt, video, etc.)
 * @property {Date|Timestamp} uploadedAt - Upload timestamp
 */

/**
 * Evaluation Document Schema (Firestore collection: 'evaluations')
 * NEW - For individual member grading
 * 
 * @typedef {Object} Evaluation
 * @property {string} id - Auto-generated Firestore document ID
 * @property {string} submissionId - Reference to submission
 * @property {string} phaseId - Phase ID
 * @property {string} teamId - Team ID
 * @property {string} studentEmail - Individual student being graded
 * @property {string} studentName - Student name
 * @property {string} studentUid - Student user ID
 * @property {number} points - Score out of phase.maxMarks
 * @property {string} feedback - Individual feedback for student
 * @property {string} evaluatorEmail - Faculty email who evaluated
 * @property {string} evaluatorName - Faculty name
 * @property {Date|Timestamp} evaluatedAt - Evaluation timestamp
 * @property {string} sessionId - Academic session ID
 * @property {number} phaseSequence - Phase sequence order (for GPA calculation)
 */

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validate Phase data before creation/update
 * @param {Object} phaseData - Phase data to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validatePhaseData(phaseData) {
  const errors = [];

  // Required fields
  if (!phaseData.phaseName || phaseData.phaseName.trim().length < 3) {
    errors.push('Phase name must be at least 3 characters long');
  }

  // Description is optional now
  if (phaseData.description && phaseData.description.trim().length < 10) {
    errors.push('Description must be at least 10 characters long');
  }

  if (!phaseData.startDate) {
    errors.push('Start date is required');
  }

  if (!phaseData.endDate) {
    errors.push('End date is required');
  }

  // Validate dates
  if (phaseData.startDate && phaseData.endDate) {
    const start = phaseData.startDate instanceof Date 
      ? phaseData.startDate 
      : phaseData.startDate.toDate();
    const end = phaseData.endDate instanceof Date 
      ? phaseData.endDate 
      : phaseData.endDate.toDate();

    if (end <= start) {
      errors.push('End date must be after start date');
    }

    // Allow today's date - only check if start date is before today (not including today)
    if (!phaseData.id) {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset to start of day
      const startDateOnly = new Date(start);
      startDateOnly.setHours(0, 0, 0, 0); // Reset to start of day
      
      if (startDateOnly < today) {
        errors.push('Start date cannot be in the past for new phases');
      }
    }
  }

  // Validate marks
  if (!phaseData.maxMarks || phaseData.maxMarks < 1) {
    errors.push('Maximum marks must be at least 1');
  }

  if (phaseData.maxMarks > 1000) {
    errors.push('Maximum marks cannot exceed 1000');
  }

  // Validate evaluator role (supports phaseType, evaluatorRole, and evaluationMode)
  const evaluatorRole = phaseData.phaseType || phaseData.evaluatorRole || phaseData.evaluationMode;
  if (!['mentor', 'panel', 'external'].includes(evaluatorRole)) {
    errors.push('Evaluator role must be "mentor", "panel", or "external"');
  }

  // Validate sequence order
  if (phaseData.sequenceOrder !== undefined && phaseData.sequenceOrder < 1) {
    errors.push('Sequence order must be at least 1');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if phase can be deleted (within 1 hour of creation)
 * @param {Date|Timestamp} createdAt - Phase creation timestamp
 * @returns {boolean}
 */
export function canDeletePhase(createdAt) {
  if (!createdAt) return false;
  
  const creationTime = createdAt instanceof Date 
    ? createdAt 
    : createdAt.toDate();
  
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return creationTime > oneHourAgo;
}

/**
 * Check if deadline has passed for a phase
 * @param {Date|Timestamp} endDate - Phase deadline
 * @returns {boolean}
 */
export function isDeadlinePassed(endDate) {
  if (!endDate) return false;
  
  const deadline = endDate instanceof Date 
    ? endDate 
    : endDate.toDate();
  
  return new Date() > deadline;
}

/**
 * Check if phase has started
 * @param {Date|Timestamp} startDate - Phase start date
 * @returns {boolean}
 */
export function hasPhaseStarted(startDate) {
  if (!startDate) return true; // If no start date, assume started
  
  const start = startDate instanceof Date 
    ? startDate 
    : startDate.toDate();
  
  return new Date() >= start;
}

/**
 * Check if phase is currently active (between start and end date)
 * This is used to determine if editing/evaluation is allowed
 * @param {Object} phase - Phase object with startDate and endDate
 * @returns {boolean} - True if phase is active, false otherwise
 */
export function isPhaseActive(phase) {
  if (!phase || !phase.startDate || !phase.endDate) return false;

  const now = new Date();
  
  const startDate = phase.startDate instanceof Date 
    ? phase.startDate 
    : phase.startDate.toDate();
  
  const endDate = phase.endDate instanceof Date 
    ? phase.endDate 
    : phase.endDate.toDate();

  return now >= startDate && now <= endDate;
}

/**
 * Get the current status of a phase
 * @param {Object} phase - Phase object with startDate and endDate
 * @returns {string} - Phase status: 'upcoming', 'active', or 'completed'
 */
/**
 * Get phase status considering meeting requirements for panel phases
 * @param {Object} phase - Phase object with startDate, endDate, phaseType, etc.
 * @param {Object} options - Optional context: { teamId, meetingsCompleted, panelistsMet }
 * @returns {string|Object} - Status string or object with details
 */
export function getPhaseStatus(phase, options = {}) {
  if (!phase || !phase.startDate || !phase.endDate) return 'unknown';

  const now = new Date();
  
  const startDate = phase.startDate instanceof Date 
    ? phase.startDate 
    : phase.startDate.toDate();
  
  const endDate = phase.endDate instanceof Date 
    ? phase.endDate 
    : phase.endDate.toDate();

  // Basic time-based status
  let timeBasedStatus;
  if (now < startDate) {
    timeBasedStatus = 'upcoming';
  } else if (now >= startDate && now <= endDate) {
    timeBasedStatus = 'active';
  } else {
    timeBasedStatus = 'completed';
  }

  // If no options provided, return simple status
  if (!options.includeDetails) {
    return timeBasedStatus;
  }

  // For panel phases with meeting requirements
  if (phase.phaseType === 'panel' && phase.minPanelistsMeetRequired && options.panelistsMet !== undefined) {
    const meetingRequirementMet = options.panelistsMet >= phase.minPanelistsMeetRequired;
    
    return {
      status: timeBasedStatus,
      requiresMeeting: true,
      minPanelistsRequired: phase.minPanelistsMeetRequired,
      panelistsMet: options.panelistsMet || 0,
      meetingRequirementMet,
      canSubmit: timeBasedStatus === 'active',
      canEvaluate: timeBasedStatus === 'active' || timeBasedStatus === 'completed',
      message: !meetingRequirementMet && timeBasedStatus === 'active'
        ? `Must meet at least ${phase.minPanelistsMeetRequired} panelists before evaluation`
        : null
    };
  }

  // For mentor phases or panel phases without specific requirements
  return {
    status: timeBasedStatus,
    requiresMeeting: false,
    canSubmit: timeBasedStatus === 'active',
    canEvaluate: timeBasedStatus === 'active' || timeBasedStatus === 'completed',
    message: null
  };
}

/**
 * Check if evaluation can be edited for a phase
 * Handles both mentor and panel phases with meeting requirements
 * @param {Object} phase - Phase object with startDate, endDate, phaseType
 * @param {Object} options - Optional: { panelistsMet } for panel phases
 * @returns {Object} - { canEdit: boolean, reason: string }
 */
export function canEditEvaluation(phase, options = {}) {
  if (!phase) {
    return { canEdit: false, reason: 'Phase not found' };
  }

  if (!phase.startDate || !phase.endDate) {
    return { canEdit: false, reason: 'Phase dates not configured' };
  }

  const phaseStatus = getPhaseStatus(phase, { 
    includeDetails: true, 
    panelistsMet: options.panelistsMet 
  });

  // Handle detailed status object
  const status = typeof phaseStatus === 'object' ? phaseStatus.status : phaseStatus;

  if (status === 'upcoming') {
    return { canEdit: false, reason: 'Phase has not started yet' };
  }

  if (status === 'completed') {
    const deadline = phase.endDate instanceof Date 
      ? phase.endDate 
      : phase.endDate.toDate();
    
    return { 
      canEdit: false, 
      reason: `Phase ended on ${deadline.toLocaleDateString()}` 
    };
  }

  // Check panel meeting requirements
  if (typeof phaseStatus === 'object' && phaseStatus.requiresMeeting) {
    if (!phaseStatus.meetingRequirementMet) {
      return {
        canEdit: false,
        reason: `Team must meet at least ${phaseStatus.minPanelistsRequired} panelists before evaluation`
      };
    }
  }

  if (status === 'active') {
    return { canEdit: true, reason: 'Phase is currently active' };
  }

  return { canEdit: false, reason: 'Unknown phase status' };
}

/**
 * Check if a team can be evaluated based on meeting requirements
 * @param {Object} phase - Phase object
 * @param {number} panelistsMet - Number of panelists team has met
 * @returns {Object} - { canEvaluate: boolean, reason: string, missingMeetings: number }
 */
export function canEvaluateTeam(phase, panelistsMet = 0) {
  if (!phase) {
    return { canEvaluate: false, reason: 'Phase not found', missingMeetings: 0 };
  }

  // Check if phase is panel type
  if (phase.phaseType === 'panel' && phase.minPanelistsMeetRequired) {
    const required = phase.minPanelistsMeetRequired;
    const met = panelistsMet || 0;

    if (met < required) {
      return {
        canEvaluate: false,
        reason: `Team must meet ${required} panelists (currently met ${met})`,
        missingMeetings: required - met
      };
    }

    return {
      canEvaluate: true,
      reason: 'Meeting requirements fulfilled',
      missingMeetings: 0
    };
  }

  // Mentor phases don't have meeting requirements
  return {
    canEvaluate: true,
    reason: 'No meeting requirements',
    missingMeetings: 0
  };
}

/**
 * Get phase type display info
 * @param {Object} phase - Phase object
 * @returns {Object} - { type, label, icon, description }
 */
export function getPhaseTypeInfo(phase) {
  if (!phase || !phase.phaseType) {
    return {
      type: 'mentor',
      label: 'Mentor Evaluation',
      icon: 'user',
      description: 'Evaluated by assigned mentor'
    };
  }

  if (phase.phaseType === 'panel') {
    return {
      type: 'panel',
      label: 'Panel Evaluation',
      icon: 'users',
      description: phase.minPanelistsMeetRequired
        ? `Requires meeting ${phase.minPanelistsMeetRequired} panelists`
        : 'Evaluated by panel members'
    };
  }

  return {
    type: 'mentor',
    label: 'Mentor Evaluation',
    icon: 'user',
    description: 'Evaluated by assigned mentor'
  };
}

/**
 * Calculate time remaining until deadline
 * @param {Date|Timestamp} endDate - Phase deadline
 * @returns {Object} { days, hours, minutes, isUrgent, hasExpired }
 */
export function getTimeRemaining(endDate) {
  if (!endDate) {
    return { days: 0, hours: 0, minutes: 0, isUrgent: false, hasExpired: false };
  }

  const deadline = endDate instanceof Date 
    ? endDate 
    : endDate.toDate();
  
  const now = new Date();
  const diff = deadline - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, isUrgent: false, hasExpired: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  // Urgent if less than 24 hours remaining
  const isUrgent = diff < (24 * 60 * 60 * 1000);

  return { days, hours, minutes, isUrgent, hasExpired: false };
}

/**
 * Format time remaining as human-readable string
 * @param {Date|Timestamp} endDate - Phase deadline
 * @returns {string}
 */
export function formatTimeRemaining(endDate) {
  const { days, hours, minutes, hasExpired } = getTimeRemaining(endDate);

  if (hasExpired) return 'Deadline passed';

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} remaining`;
  }

  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} remaining`;
  }

  return `${minutes} minute${minutes > 1 ? 's' : ''} remaining`;
}

/**
 * Validate evaluation data
 * @param {Object} evaluationData - Evaluation data to validate
 * @param {number} maxMarks - Maximum marks for the phase
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateEvaluationData(evaluationData, maxMarks) {
  const errors = [];

  if (!evaluationData.studentEmail) {
    errors.push('Student email is required');
  }

  if (evaluationData.points === undefined || evaluationData.points === null) {
    errors.push('Points are required');
  }

  if (evaluationData.points < 0) {
    errors.push('Points cannot be negative');
  }

  if (evaluationData.points > maxMarks) {
    errors.push(`Points cannot exceed maximum marks (${maxMarks})`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Default phase data structure
 */
export const DEFAULT_PHASE = {
  phaseName: '',
  description: '',
  startDate: null,
  endDate: null,
  maxMarks: 100,
  evaluatorRole: 'mentor',
  sequenceOrder: 1,
  allowLateSubmission: false,
  isActive: true
};

/**
 * Phase status constants
 */
export const PHASE_STATUS = {
  UPCOMING: 'upcoming',      // Not started yet
  LOCKED: 'locked',          // Previous phase not completed
  ACTIVE: 'active',          // Can submit
  SUBMITTED: 'submitted',    // Submitted, awaiting evaluation
  COMPLETED: 'completed',    // Evaluated
  EXPIRED: 'expired'         // Deadline passed, no late submission allowed
};

/**
 * Evaluation status constants
 */
export const EVALUATION_STATUS = {
  PENDING: 'pending',
  EVALUATED: 'evaluated',
  REVISIONS_REQUESTED: 'revisions_requested'
};

/**
 * Evaluator role constants
 */
export const EVALUATOR_ROLES = {
  MENTOR: 'mentor',
  PANEL: 'panel',
  EXTERNAL: 'external'
};

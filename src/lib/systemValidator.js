// lib/systemValidator.js
/**
 * System Validation Utilities
 * Comprehensive validation for all implemented features
 */

import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import MeetingService from '@/services/meetingService';
import ExtensionService from '@/services/extensionService';
import MeetingStatsService from '@/services/meetingStatsService';
import PanelEvaluationService from '@/services/panelEvaluationService';
import { getPhaseStatus, canEvaluateTeam, canEditEvaluation } from '@/lib/phaseSchema';

import { logger } from "./logger";
/**
 * Validation result structure
 * @typedef {Object} ValidationResult
 * @property {boolean} passed - Whether validation passed
 * @property {string} message - Success or error message
 * @property {Object} details - Additional validation details
 * @property {Date} timestamp - When validation ran
 */

export const SystemValidator = {
  /**
   * Validate Meeting Scheduling System
   */
  async validateMeetingSystem(sessionId) {
    const results = {
      testName: 'Meeting Scheduling System',
      timestamp: new Date(),
      checks: []
    };

    try {
      // Check 1: Verify meetings collection exists
      const meetingsQuery = query(
        collection(db, 'meetings'),
        where('sessionId', '==', sessionId)
      );
      const meetingsSnapshot = await getDocs(meetingsQuery);
      
      results.checks.push({
        name: 'Meetings Collection Accessible',
        passed: true,
        message: `Found ${meetingsSnapshot.size} meetings in session`,
        count: meetingsSnapshot.size
      });

      // Check 2: Validate meeting data structure
      let validStructureCount = 0;
      let invalidMeetings = [];

      meetingsSnapshot.docs.forEach(doc => {
        const meeting = doc.data();
        const required = ['phaseId', 'facultyId', 'teamIds', 'meetingDate', 'mode', 'status'];
        const hasAllFields = required.every(field => meeting.hasOwnProperty(field));
        
        if (hasAllFields) {
          validStructureCount++;
        } else {
          const missing = required.filter(field => !meeting.hasOwnProperty(field));
          invalidMeetings.push({ id: doc.id, missing });
        }
      });

      results.checks.push({
        name: 'Meeting Data Structure',
        passed: invalidMeetings.length === 0,
        message: invalidMeetings.length === 0 
          ? `All ${validStructureCount} meetings have valid structure`
          : `${invalidMeetings.length} meetings missing required fields`,
        details: invalidMeetings.length > 0 ? invalidMeetings : null
      });

      // Check 3: Verify meeting status values
      const validStatuses = ['scheduled', 'completed', 'cancelled'];
      let invalidStatuses = [];

      meetingsSnapshot.docs.forEach(doc => {
        const meeting = doc.data();
        if (!validStatuses.includes(meeting.status)) {
          invalidStatuses.push({ id: doc.id, status: meeting.status });
        }
      });

      results.checks.push({
        name: 'Meeting Status Values',
        passed: invalidStatuses.length === 0,
        message: invalidStatuses.length === 0
          ? 'All meetings have valid status'
          : `${invalidStatuses.length} meetings have invalid status`,
        details: invalidStatuses.length > 0 ? invalidStatuses : null
      });

      // Check 4: Test MeetingService methods
      try {
        const testPhaseId = meetingsSnapshot.docs[0]?.data().phaseId;
        if (testPhaseId) {
          const phaseMeetings = await MeetingService.getMeetingsByPhase(testPhaseId);
          results.checks.push({
            name: 'MeetingService.getMeetingsByPhase',
            passed: true,
            message: `Service working - found ${phaseMeetings.length} meetings`
          });
        }
      } catch (error) {
        results.checks.push({
          name: 'MeetingService.getMeetingsByPhase',
          passed: false,
          message: `Service error: ${error.message}`
        });
      }

    } catch (error) {
      results.checks.push({
        name: 'Meeting System Validation',
        passed: false,
        message: `Critical error: ${error.message}`
      });
    }

    results.passed = results.checks.every(check => check.passed);
    return results;
  },

  /**
   * Validate Panel Evaluation System
   */
  async validatePanelEvaluationSystem(sessionId) {
    const results = {
      testName: 'Panel Evaluation System',
      timestamp: new Date(),
      checks: []
    };

    try {
      // Check 1: Verify panelEvaluations collection
      const panelEvalsQuery = query(
        collection(db, 'panelEvaluations'),
        where('sessionId', '==', sessionId)
      );
      const panelEvalsSnapshot = await getDocs(panelEvalsQuery);

      results.checks.push({
        name: 'Panel Evaluations Collection',
        passed: true,
        message: `Found ${panelEvalsSnapshot.size} panel evaluations`,
        count: panelEvalsSnapshot.size
      });

      // Check 2: Validate panel evaluation structure
      let validEvals = 0;
      let invalidEvals = [];

      panelEvalsSnapshot.docs.forEach(doc => {
        const evaluation = doc.data();
        const required = ['teamId', 'phaseId', 'evaluatedBy', 'marks', 'aggregatedMarks'];
        const hasAllFields = required.every(field => evaluation.hasOwnProperty(field));

        if (hasAllFields && Array.isArray(evaluation.evaluatedBy)) {
          validEvals++;
        } else {
          invalidEvals.push({ id: doc.id, issues: 'Missing required fields or evaluatedBy not array' });
        }
      });

      results.checks.push({
        name: 'Panel Evaluation Structure',
        passed: invalidEvals.length === 0,
        message: invalidEvals.length === 0
          ? `All ${validEvals} evaluations have valid structure`
          : `${invalidEvals.length} evaluations have issues`,
        details: invalidEvals.length > 0 ? invalidEvals : null
      });

      // Check 3: Validate aggregated marks calculation
      let calculationErrors = [];

      panelEvalsSnapshot.docs.forEach(doc => {
        const evaluation = doc.data();
        if (evaluation.marks && Array.isArray(evaluation.marks) && evaluation.marks.length > 0) {
          // Recalculate average
          const totalMarks = evaluation.marks.reduce((sum, m) => sum + (m.totalMarks || 0), 0);
          const calculatedAvg = totalMarks / evaluation.marks.length;
          const storedAvg = evaluation.aggregatedMarks?.totalMarks || 0;
          
          // Allow small floating point differences
          if (Math.abs(calculatedAvg - storedAvg) > 0.01) {
            calculationErrors.push({
              id: doc.id,
              calculated: calculatedAvg,
              stored: storedAvg,
              difference: Math.abs(calculatedAvg - storedAvg)
            });
          }
        }
      });

      results.checks.push({
        name: 'Aggregated Marks Calculation',
        passed: calculationErrors.length === 0,
        message: calculationErrors.length === 0
          ? 'All aggregated marks correctly calculated'
          : `${calculationErrors.length} evaluations have calculation errors`,
        details: calculationErrors.length > 0 ? calculationErrors : null
      });

      // Check 4: Test PanelEvaluationService
      try {
        const testTeamId = panelEvalsSnapshot.docs[0]?.data().teamId;
        const testPhaseId = panelEvalsSnapshot.docs[0]?.data().phaseId;
        
        if (testTeamId && testPhaseId) {
          const status = await PanelEvaluationService.getEvaluationStatus(testTeamId, testPhaseId);
          results.checks.push({
            name: 'PanelEvaluationService.getEvaluationStatus',
            passed: true,
            message: `Service working - status retrieved`,
            details: { evaluatedCount: status?.evaluatedBy?.length || 0 }
          });
        }
      } catch (error) {
        results.checks.push({
          name: 'PanelEvaluationService.getEvaluationStatus',
          passed: false,
          message: `Service error: ${error.message}`
        });
      }

    } catch (error) {
      results.checks.push({
        name: 'Panel Evaluation System',
        passed: false,
        message: `Critical error: ${error.message}`
      });
    }

    results.passed = results.checks.every(check => check.passed);
    return results;
  },

  /**
   * Validate Extension System
   */
  async validateExtensionSystem(sessionId) {
    const results = {
      testName: 'Deadline Extension System',
      timestamp: new Date(),
      checks: []
    };

    try {
      // Check 1: Verify extensions collection
      const extensionsQuery = query(
        collection(db, 'extensions'),
        where('active', '==', true)
      );
      const extensionsSnapshot = await getDocs(extensionsQuery);

      results.checks.push({
        name: 'Extensions Collection',
        passed: true,
        message: `Found ${extensionsSnapshot.size} active extensions`,
        count: extensionsSnapshot.size
      });

      // Check 2: Validate extension structure
      let validExtensions = 0;
      let invalidExtensions = [];

      extensionsSnapshot.docs.forEach(doc => {
        const extension = doc.data();
        const required = ['phaseId', 'teamId', 'originalDeadline', 'extendedDeadline', 'grantedBy', 'active'];
        const hasAllFields = required.every(field => extension.hasOwnProperty(field));

        if (hasAllFields) {
          // Validate extended deadline is after original
          const original = extension.originalDeadline.toDate();
          const extended = extension.extendedDeadline.toDate();
          
          if (extended > original) {
            validExtensions++;
          } else {
            invalidExtensions.push({
              id: doc.id,
              issue: 'Extended deadline not after original'
            });
          }
        } else {
          invalidExtensions.push({
            id: doc.id,
            issue: 'Missing required fields'
          });
        }
      });

      results.checks.push({
        name: 'Extension Data Validation',
        passed: invalidExtensions.length === 0,
        message: invalidExtensions.length === 0
          ? `All ${validExtensions} extensions are valid`
          : `${invalidExtensions.length} extensions have issues`,
        details: invalidExtensions.length > 0 ? invalidExtensions : null
      });

      // Check 3: Test ExtensionService methods
      try {
        const testTeamId = extensionsSnapshot.docs[0]?.data().teamId;
        const testPhaseId = extensionsSnapshot.docs[0]?.data().phaseId;

        if (testTeamId && testPhaseId) {
          const hasExtension = await ExtensionService.hasExtension(testTeamId, testPhaseId);
          const details = await ExtensionService.getExtensionDetails(testTeamId, testPhaseId);

          results.checks.push({
            name: 'ExtensionService Methods',
            passed: hasExtension && details !== null,
            message: 'Service methods working correctly',
            details: { hasExtension, hasDetails: details !== null }
          });
        }
      } catch (error) {
        results.checks.push({
          name: 'ExtensionService Methods',
          passed: false,
          message: `Service error: ${error.message}`
        });
      }

      // Check 4: Check for duplicate extensions
      const extensionMap = new Map();
      let duplicates = [];

      extensionsSnapshot.docs.forEach(doc => {
        const extension = doc.data();
        const key = `${extension.teamId}-${extension.phaseId}`;
        
        if (extensionMap.has(key)) {
          duplicates.push({
            teamId: extension.teamId,
            phaseId: extension.phaseId,
            ids: [extensionMap.get(key), doc.id]
          });
        } else {
          extensionMap.set(key, doc.id);
        }
      });

      results.checks.push({
        name: 'No Duplicate Extensions',
        passed: duplicates.length === 0,
        message: duplicates.length === 0
          ? 'No duplicate extensions found'
          : `${duplicates.length} team-phase combinations have multiple extensions`,
        details: duplicates.length > 0 ? duplicates : null
      });

    } catch (error) {
      results.checks.push({
        name: 'Extension System',
        passed: false,
        message: `Critical error: ${error.message}`
      });
    }

    results.passed = results.checks.every(check => check.passed);
    return results;
  },

  /**
   * Validate Meeting Requirements System
   */
  async validateMeetingRequirements(sessionId) {
    const results = {
      testName: 'Meeting Requirements & Phase Status',
      timestamp: new Date(),
      checks: []
    };

    try {
      // Check 1: Verify phases with meeting requirements
      const phasesQuery = query(
        collection(db, 'phases'),
        where('sessionId', '==', sessionId),
        where('phaseType', '==', 'panel')
      );
      const phasesSnapshot = await getDocs(phasesQuery);

      const panelPhasesWithRequirements = phasesSnapshot.docs.filter(
        doc => doc.data().minPanelistsMeetRequired > 0
      );

      results.checks.push({
        name: 'Panel Phases with Requirements',
        passed: true,
        message: `Found ${panelPhasesWithRequirements.length} panel phases with meeting requirements`,
        count: panelPhasesWithRequirements.length
      });

      // Check 2: Test MeetingStatsService
      if (panelPhasesWithRequirements.length > 0) {
        const testPhase = panelPhasesWithRequirements[0].data();
        const teamsQuery = query(
          collection(db, 'teams'),
          where('sessionId', '==', sessionId)
        );
        const teamsSnapshot = await getDocs(teamsQuery);

        if (teamsSnapshot.size > 0) {
          const testTeam = teamsSnapshot.docs[0];
          
          try {
            const meetCount = await MeetingStatsService.getPanelistsMeetCount(
              testTeam.id,
              panelPhasesWithRequirements[0].id
            );
            
            results.checks.push({
              name: 'MeetingStatsService.getPanelistsMeetCount',
              passed: true,
              message: `Service working - team met ${meetCount} panelists`,
              count: meetCount
            });
          } catch (error) {
            results.checks.push({
              name: 'MeetingStatsService.getPanelistsMeetCount',
              passed: false,
              message: `Service error: ${error.message}`
            });
          }
        }
      }

      // Check 3: Test phase status logic
      if (panelPhasesWithRequirements.length > 0) {
        const testPhase = panelPhasesWithRequirements[0].data();
        
        try {
          const statusSimple = getPhaseStatus(testPhase);
          const statusDetailed = getPhaseStatus(testPhase, { 
            includeDetails: true, 
            panelistsMet: 2 
          });

          results.checks.push({
            name: 'Enhanced getPhaseStatus',
            passed: typeof statusDetailed === 'object' && statusDetailed.status !== undefined,
            message: 'Phase status function working with meeting context',
            details: {
              simpleStatus: statusSimple,
              detailedStatus: statusDetailed.status,
              requiresMeeting: statusDetailed.requiresMeeting
            }
          });
        } catch (error) {
          results.checks.push({
            name: 'Enhanced getPhaseStatus',
            passed: false,
            message: `Function error: ${error.message}`
          });
        }
      }

      // Check 4: Test canEvaluateTeam logic
      if (panelPhasesWithRequirements.length > 0) {
        const testPhase = panelPhasesWithRequirements[0].data();
        
        try {
          const canEvaluate0 = canEvaluateTeam(testPhase, 0);
          const canEvaluateMax = canEvaluateTeam(testPhase, testPhase.minPanelistsMeetRequired);

          results.checks.push({
            name: 'canEvaluateTeam Logic',
            passed: !canEvaluate0.canEvaluate && canEvaluateMax.canEvaluate,
            message: 'Meeting requirement validation working correctly',
            details: {
              withZeroMeetings: canEvaluate0.canEvaluate,
              withRequiredMeetings: canEvaluateMax.canEvaluate
            }
          });
        } catch (error) {
          results.checks.push({
            name: 'canEvaluateTeam Logic',
            passed: false,
            message: `Function error: ${error.message}`
          });
        }
      }

    } catch (error) {
      results.checks.push({
        name: 'Meeting Requirements System',
        passed: false,
        message: `Critical error: ${error.message}`
      });
    }

    results.passed = results.checks.every(check => check.passed);
    return results;
  },

  /**
   * Validate Marks Visibility System
   */
  async validateMarksVisibility(sessionId) {
    const results = {
      testName: 'Marks Visibility Control',
      timestamp: new Date(),
      checks: []
    };

    try {
      // Check 1: Verify phases have marksVisible field
      const phasesQuery = query(
        collection(db, 'phases'),
        where('sessionId', '==', sessionId)
      );
      const phasesSnapshot = await getDocs(phasesQuery);

      let phasesWithField = 0;
      let phasesWithoutField = [];

      phasesSnapshot.docs.forEach(doc => {
        const phase = doc.data();
        if (phase.hasOwnProperty('marksVisible')) {
          phasesWithField++;
        } else {
          phasesWithoutField.push({ id: doc.id, name: phase.phaseName });
        }
      });

      results.checks.push({
        name: 'Phases Have marksVisible Field',
        passed: phasesWithoutField.length === 0,
        message: phasesWithoutField.length === 0
          ? `All ${phasesWithField} phases have marksVisible field`
          : `${phasesWithoutField.length} phases missing marksVisible field`,
        details: phasesWithoutField.length > 0 ? phasesWithoutField : null
      });

      // Check 2: Check visibility distribution
      let visibleCount = 0;
      let hiddenCount = 0;

      phasesSnapshot.docs.forEach(doc => {
        const phase = doc.data();
        if (phase.marksVisible !== false) {
          visibleCount++;
        } else {
          hiddenCount++;
        }
      });

      results.checks.push({
        name: 'Visibility Distribution',
        passed: true,
        message: `${visibleCount} phases visible, ${hiddenCount} phases hidden`,
        details: { visible: visibleCount, hidden: hiddenCount }
      });

    } catch (error) {
      results.checks.push({
        name: 'Marks Visibility System',
        passed: false,
        message: `Critical error: ${error.message}`
      });
    }

    results.passed = results.checks.every(check => check.passed);
    return results;
  },

  /**
   * Run all validation tests
   */
  async runAllValidations(sessionId) {
    
    const allResults = {
      sessionId,
      timestamp: new Date(),
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0
      },
      results: []
    };

    // Run all validation tests
    const tests = [
      () => this.validateMeetingSystem(sessionId),
      () => this.validatePanelEvaluationSystem(sessionId),
      () => this.validateExtensionSystem(sessionId),
      () => this.validateMeetingRequirements(sessionId),
      () => this.validateMarksVisibility(sessionId)
    ];

    for (const test of tests) {
      try {
        const result = await test();
        allResults.results.push(result);
        
        const passed = result.checks.filter(c => c.passed).length;
        const failed = result.checks.filter(c => !c.passed).length;
        
        allResults.summary.totalTests += result.checks.length;
        allResults.summary.passedTests += passed;
        allResults.summary.failedTests += failed;

      } catch (error) {
        logger.error(`✗ Test failed: ${error.message}`);
        allResults.summary.failedTests++;
      }
    }

    allResults.summary.overallPassed = allResults.summary.failedTests === 0;
    

    return allResults;
  }
};

export default SystemValidator;

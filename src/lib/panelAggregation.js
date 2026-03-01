export function aggregatePanelEvaluations(evaluations = []) {
  if (!Array.isArray(evaluations) || evaluations.length === 0) {
    return {
      hasEvaluations: false,
      evaluationCount: 0,
      aggregatedMarks: [],
      teamAverage: 0,
      absentStudents: []
    };
  }

  const studentMarksMap = {};
  const absentStudents = [];

  evaluations.forEach((evaluation) => {
    const marks = evaluation?.marks || [];
    marks.forEach((mark) => {
      if (!mark?.studentEmail) {
        return;
      }

      if (!studentMarksMap[mark.studentEmail]) {
        studentMarksMap[mark.studentEmail] = {
          studentEmail: mark.studentEmail,
          studentName: mark.studentName,
          marks: [],
          attendance: []
        };
      }

      const isPresent = mark.isPresent ?? !mark.isAbsent ?? true;
      const numericMarks = typeof mark.marks === 'number' ? mark.marks : Number(mark.marks || 0);

      studentMarksMap[mark.studentEmail].marks.push(numericMarks);
      studentMarksMap[mark.studentEmail].attendance.push(isPresent);
    });
  });

  const aggregatedMarks = Object.values(studentMarksMap).map((student) => {
    const total = student.marks.reduce((sum, value) => sum + value, 0);
    const average = student.marks.length > 0 ? total / student.marks.length : 0;
    const presentCount = student.attendance.filter(Boolean).length;
    const absentCount = student.attendance.length - presentCount;
    const wasAbsent = presentCount === 0 && absentCount > 0;

    if (wasAbsent) {
      absentStudents.push({
        studentEmail: student.studentEmail,
        studentName: student.studentName
      });
    }

    return {
      studentEmail: student.studentEmail,
      studentName: student.studentName,
      individualMarks: student.marks,
      averageMarks: Number(average.toFixed(2)),
      evaluationCount: student.marks.length,
      presentCount,
      absentCount,
      wasAbsent
    };
  });

  const teamTotal = aggregatedMarks.reduce((sum, student) => sum + student.averageMarks, 0);
  const teamAverage = aggregatedMarks.length > 0 ? Number((teamTotal / aggregatedMarks.length).toFixed(2)) : 0;

  return {
    hasEvaluations: true,
    evaluationCount: evaluations.length,
    aggregatedMarks,
    teamAverage,
    absentStudents
  };
}

export function getPanelProgressMeta({
  evaluationCount = 0,
  minRequired = 1,
  totalPanelists = null
} = {}) {
  const requiredCount = Math.max(1, Number(minRequired) || 1);
  const completedCount = Number(evaluationCount) || 0;
  const pendingCount = Math.max(0, requiredCount - completedCount);
  const statusMet = completedCount >= requiredCount;
  const nextPanelistNumber = statusMet ? requiredCount : Math.min(requiredCount, completedCount + 1);
  
  // Check if ALL panelists have evaluated (for full completion status)
  const allCompleted = totalPanelists !== null && completedCount >= totalPanelists;

  return {
    status: statusMet ? 'evaluated' : 'awaiting_panelists',
    progress: {
      completedCount,
      requiredCount,
      pendingCount,
      totalPanelists,
      allPanelistsCompleted: allCompleted,
      statusLabel: allCompleted
        ? 'Fully Evaluated'
        : statusMet
        ? `Evaluated (${completedCount}/${totalPanelists || requiredCount} panelists)`
        : `Awaiting Panelist ${nextPanelistNumber} of ${requiredCount}`
    }
  };
}

package com.university.platform.assessment.dto;

import java.util.List;
import java.util.UUID;

/**
 * Post-exam results for a single student, returned once a live exam's grades
 * have been revealed. Aggregated from {@code exam_attempt_results} (best score
 * per problem) plus the student's latest submission code per problem.
 */
public record ExamResultsDTO(
    UUID assessmentId,
    String title,
    int finalScore,      // sum of best scores across problems
    int totalPoints,     // sum of problem max points
    int gradePercent,    // finalScore / totalPoints, rounded
    int passingScore,    // pass threshold (percent)
    boolean passed,
    int submittedCount,  // problems with at least one attempt
    int acceptedCount,   // problems fully accepted
    int problemCount,
    List<ProblemResultDTO> problems
) {
    public record ProblemResultDTO(
        UUID problemId,
        String label,
        String title,
        int earnedPoints,
        int maxPoints,
        int passedCases,
        int totalCases,
        /** AC | PARTIAL | WA | NS */
        String verdict,
        String submittedCode,  // nullable — student's latest submission
        String language        // nullable
    ) {}
}

-- The `is_published` gate (now actually enforced by SubmissionService,
-- AssessmentController#studentView/examRoom, and the student discovery query)
-- was previously dead: every assessment was created with is_published=false
-- and nothing ever set it to true. Backfill pre-existing rows to published so
-- assessments that were already live for students don't silently disappear.
UPDATE assessments SET is_published = true WHERE is_published = false;

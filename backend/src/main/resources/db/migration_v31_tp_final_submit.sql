-- Per-STUDENT final TP submission. Deliberately a separate table rather than a
-- column on assessments: a "submitted_at" on the shared assessment row would
-- lock the TP for every student the moment one person final-submits.
CREATE TABLE IF NOT EXISTS tp_final_submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL,
  student_id    UUID NOT NULL,
  submitted_at  TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_tp_final_submission UNIQUE (assessment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_tp_final_assessment_student
  ON tp_final_submissions (assessment_id, student_id);

package com.university.platform.assessment.model;

import com.university.platform.identity.model.Student;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "exam_violations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExamViolation {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "violation_id", updatable = false, nullable = false, columnDefinition = "uuid")
    private UUID violationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assessment_id", nullable = false)
    private Assessment assessment;

    @Column(name = "violation_type", nullable = false)
    private String violationType; 

    @Column(name = "timestamp", nullable = false)
    private LocalDateTime timestamp;
}

package com.university.platform.assessment.model;
import com.university.platform.execution.service.ExecutionWorkerService;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;
import com.fasterxml.jackson.annotation.JsonIgnore;

import java.util.UUID;

@Entity
@Table(
    name = "test_cases",
    indexes = {
        @Index(name = "idx_test_cases_problem_id", columnList = "problem_id")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TestCase {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "test_case_id", updatable = false, nullable = false, columnDefinition = "uuid")
    private UUID testCaseId;

    @Column(name = "input_data", nullable = false, columnDefinition = "TEXT")
    private String inputData;

    @Column(name = "expected_output", nullable = false, columnDefinition = "TEXT")
    private String expectedOutput;

    @Builder.Default
    @Column(name = "is_hidden", nullable = false)
    private Boolean isHidden = false;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
        name = "problem_id",
        nullable = false,
        foreignKey = @ForeignKey(name = "fk_test_cases_problem")
    )
    private Problem problem;
}

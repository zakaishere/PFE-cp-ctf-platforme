package com.university.platform.identity.model;
import com.university.platform.execution.model.Submission;
import com.university.platform.execution.model.Submission.ProgrammingLanguage;
import com.university.platform.execution.model.Submission.SubmissionStatus;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
    name = "students",
    indexes = {
        @Index(name = "idx_students_apogee",   columnList = "apogee_number"),
        @Index(name = "idx_students_cohort_id", columnList = "cohort_id")
    }
)
@DiscriminatorValue("STUDENT")
@PrimaryKeyJoinColumn(name = "user_id")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class Student extends User {

    @Column(name = "apogee_number", nullable = false, unique = true, length = 50)
    private String apogeeNumber;

    @Builder.Default
    @Column(name = "total_points", nullable = false)
    private Integer totalPoints = 0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cohort_id", foreignKey = @ForeignKey(name = "fk_students_cohort"))
    private Cohort cohort;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "division_id", foreignKey = @ForeignKey(name = "fk_students_division"))
    private com.university.platform.academic.model.Division division;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "semester_id", foreignKey = @ForeignKey(name = "fk_students_semester"))
    private com.university.platform.academic.model.Semester semester;

    @OneToMany(
        mappedBy = "student",
        cascade = CascadeType.ALL,
        orphanRemoval = true,
        fetch = FetchType.LAZY
    )
    @Builder.Default
    @com.fasterxml.jackson.annotation.JsonIgnore
    private List<Submission> submissions = new ArrayList<>();
}

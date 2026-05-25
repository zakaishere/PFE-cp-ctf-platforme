package com.university.platform.identity.model;
import com.university.platform.assessment.model.Assessment;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(
    name = "cohorts",
    uniqueConstraints = {
        @UniqueConstraint(
            name = "uq_cohort_dept_year_semester",
            columnNames = {"department_id", "year", "semester"}
        )
    },
    indexes = {
        @Index(name = "idx_cohorts_department_id", columnList = "department_id")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Cohort {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "cohort_id", updatable = false, nullable = false, columnDefinition = "uuid")
    private UUID cohortId;

    @Column(name = "year", nullable = false)
    private Integer year;

    @Column(name = "semester", nullable = false, length = 20)
    private String semester;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
        name = "department_id",
        nullable = false,
        foreignKey = @ForeignKey(name = "fk_cohorts_department")
    )
    private Department department;

    @Builder.Default
    @OneToMany(
        mappedBy = "cohort",
        fetch = FetchType.LAZY
    )
    private List<Student> students = new ArrayList<>();


}

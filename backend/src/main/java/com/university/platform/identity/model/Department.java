package com.university.platform.identity.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "departments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Department {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "dept_id", updatable = false, nullable = false, columnDefinition = "uuid")
    private UUID deptId;

    @Column(name = "name", nullable = false, unique = true, length = 150)
    private String name;

    @Builder.Default
    @OneToMany(
        mappedBy = "department",
        cascade = CascadeType.ALL,
        orphanRemoval = true,
        fetch = FetchType.LAZY
    )
    private List<com.university.platform.academic.model.Division> divisions = new ArrayList<>();

    @Builder.Default
    @OneToMany(
        mappedBy = "department",
        cascade = CascadeType.ALL,
        orphanRemoval = true,
        fetch = FetchType.LAZY
    )
    private List<Cohort> cohorts = new ArrayList<>();

    public void addCohort(Cohort cohort) {
        cohorts.add(cohort);
        cohort.setDepartment(this);
    }

    public void removeCohort(Cohort cohort) {
        cohorts.remove(cohort);
        cohort.setDepartment(null);
    }
}

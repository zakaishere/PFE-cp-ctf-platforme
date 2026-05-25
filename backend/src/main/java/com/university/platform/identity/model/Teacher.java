package com.university.platform.identity.model;
import com.university.platform.assessment.model.Assessment;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
    name = "teachers",
    indexes = {
        @Index(name = "idx_teachers_status", columnList = "status")
    }
)
@DiscriminatorValue("TEACHER")
@PrimaryKeyJoinColumn(name = "user_id")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class Teacher extends User {

    @Column(name = "specialty", length = 150)
    private String specialty;

    @Column(name = "department", length = 150)
    private String department;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private TeacherStatus status = TeacherStatus.PENDING;

    @OneToMany(
        mappedBy = "createdBy",
        fetch = FetchType.LAZY
    )
    @Builder.Default
    @com.fasterxml.jackson.annotation.JsonIgnore
    private List<Assessment> assessments = new ArrayList<>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "teacher_modules",
        joinColumns = @JoinColumn(name = "teacher_id"),
        inverseJoinColumns = @JoinColumn(name = "module_id")
    )
    @Builder.Default
    private List<com.university.platform.academic.model.Module> modules = new ArrayList<>();

    public enum TeacherStatus {
        PENDING,   
        ACTIVE     
    }
}

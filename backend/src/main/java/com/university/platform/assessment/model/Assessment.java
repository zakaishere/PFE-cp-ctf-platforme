package com.university.platform.assessment.model;

import com.university.platform.assessment.VisibilityMode;
import com.university.platform.identity.model.Cohort;
import com.university.platform.identity.model.Teacher;
import com.university.platform.identity.model.Teacher.TeacherStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.UuidGenerator;

import com.fasterxml.jackson.annotation.JsonIgnore;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "assessments")
@Inheritance(strategy = InheritanceType.JOINED)
@DiscriminatorColumn(name = "assessment_type", discriminatorType = DiscriminatorType.STRING, length = 20)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public abstract class Assessment {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "assessment_id", updatable = false, nullable = false, columnDefinition = "uuid")
    private UUID assessmentId;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Builder.Default
    @Column(name = "is_published", nullable = false)
    private Boolean isPublished = false;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "teacher_id", foreignKey = @ForeignKey(name = "fk_assessments_teacher"))
    private Teacher createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "module_id", foreignKey = @ForeignKey(name = "fk_assessments_module"))
    private com.university.platform.academic.model.Module module;

    @Enumerated(EnumType.STRING)
    @Column(name = "visibility_mode", nullable = false, length = 20)
    @Builder.Default
    private VisibilityMode visibilityMode = VisibilityMode.MODULE_ONLY;
}

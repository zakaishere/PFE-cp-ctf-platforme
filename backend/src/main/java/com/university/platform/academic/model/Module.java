package com.university.platform.academic.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.university.platform.identity.model.Teacher;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "modules")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Module {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "module_id", updatable = false, nullable = false, columnDefinition = "uuid")
    private UUID moduleId;

    @Column(name = "name", nullable = false, length = 150)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "division_id", nullable = false, foreignKey = @ForeignKey(name = "fk_module_division"))
    private Division division;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "semester_id", nullable = false, foreignKey = @ForeignKey(name = "fk_module_semester"))
    private Semester semester;

    @Builder.Default
    @ManyToMany(mappedBy = "modules", fetch = FetchType.LAZY)
    @JsonIgnore
    private List<Teacher> teachers = new ArrayList<>();
}

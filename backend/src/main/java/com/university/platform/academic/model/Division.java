package com.university.platform.academic.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.university.platform.identity.model.Department;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "divisions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Division {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "division_id", updatable = false, nullable = false, columnDefinition = "uuid")
    private UUID divisionId;

    @Column(name = "name", nullable = false, length = 150)
    private String name;

    @Column(name = "type", length = 20)
    private String type;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dept_id", nullable = false, foreignKey = @ForeignKey(name = "fk_division_department"))
    @JsonIgnore
    private Department department;

    @Builder.Default
    @OneToMany(mappedBy = "division", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<Module> modules = new ArrayList<>();
}

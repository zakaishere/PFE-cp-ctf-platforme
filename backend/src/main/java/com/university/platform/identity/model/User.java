package com.university.platform.identity.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.UuidGenerator;

import java.util.UUID;

@Entity
@Table(
    name = "users",
    indexes = {
        @Index(name = "idx_users_email", columnList = "email"),
        @Index(name = "idx_users_role",  columnList = "role")
    }
)
@Inheritance(strategy = InheritanceType.JOINED)
@DiscriminatorColumn(name = "user_type", discriminatorType = DiscriminatorType.STRING, length = 20)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public abstract class User {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false, columnDefinition = "uuid")
    private UUID id;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;

    @Column(name = "email", nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private Role role;

    @Builder.Default
    @Column(name = "is_email_verified", nullable = false)
    private Boolean isEmailVerified = false;

    // Profile fields (migration_v24). username is NOT NULL + unique at DB level
    // after backfill; kept nullable here so ddl-auto=update can add the column
    // on non-empty dev databases.
    @Column(name = "username", unique = true, length = 50)
    private String username;

    @Column(name = "bio", columnDefinition = "TEXT")
    private String bio;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    /** One of the 12 fixed samurai avatar ids, or null (initials fallback). */
    @Column(name = "avatar_id", length = 20)
    private String avatarId;

    @org.hibernate.annotations.CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private java.time.LocalDateTime createdAt;

    /** username is NOT NULL in the DB — auto-generate for new accounts so
     *  registration keeps working without touching the auth flow. */
    @PrePersist
    private void ensureUsername() {
        if (username == null && email != null) {
            String local = email.split("@")[0].toLowerCase().replaceAll("[^a-z0-9_.-]", "");
            if (local.isEmpty()) local = "user";
            username = local + "_" + UUID.randomUUID().toString().substring(0, 6);
        }
    }

    public enum Role {
        STUDENT, TEACHER, ADMIN
    }
}

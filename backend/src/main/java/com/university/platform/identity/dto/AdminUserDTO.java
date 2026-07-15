package com.university.platform.identity.dto;

import com.university.platform.identity.model.Teacher;
import com.university.platform.identity.model.User;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Read-only projection of a user for the admin Users list.
 * Deliberately excludes password hashes and any sensitive fields.
 * {@code status} is only meaningful for teachers (PENDING/ACTIVE); it is null
 * for students, who have no lifecycle status in the current model.
 */
public record AdminUserDTO(
        UUID id,
        String firstName,
        String lastName,
        String email,
        String username,
        User.Role role,
        Boolean emailVerified,
        String status,
        LocalDateTime createdAt
) {
    public static AdminUserDTO from(User u) {
        String status = (u instanceof Teacher t && t.getStatus() != null)
                ? t.getStatus().name()
                : null;
        return new AdminUserDTO(
                u.getId(),
                u.getFirstName(),
                u.getLastName(),
                u.getEmail(),
                u.getUsername(),
                u.getRole(),
                u.getIsEmailVerified(),
                status,
                u.getCreatedAt()
        );
    }
}

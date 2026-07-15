package com.university.platform.identity.repository;

import com.university.platform.identity.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    Optional<User> findByUsername(String username);

    /**
     * Admin Users list: optional role filter + case-insensitive search across
     * name/email/username. Null params disable their respective filter.
     *
     * {@code :search} is wrapped in CAST(... AS string) so PostgreSQL gets an
     * explicit varchar type even when the parameter is null. Without the cast,
     * Hibernate binds the null with no type and Postgres infers {@code bytea}
     * for the CONCAT, producing "function lower(bytea) does not exist" at plan
     * time (the whole endpoint 500s regardless of runtime value).
     */
    @Query("""
        SELECT u FROM User u
        WHERE (:role IS NULL OR u.role = :role)
          AND (:search IS NULL OR (
                LOWER(u.firstName) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
             OR LOWER(u.lastName)  LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
             OR LOWER(u.email)     LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
             OR LOWER(u.username)  LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
          ))
        ORDER BY u.createdAt DESC
    """)
    Page<User> searchForAdmin(@Param("role") User.Role role,
                              @Param("search") String search,
                              Pageable pageable);
}

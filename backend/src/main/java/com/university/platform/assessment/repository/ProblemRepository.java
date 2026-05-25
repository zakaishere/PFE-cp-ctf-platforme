package com.university.platform.assessment.repository;

import com.university.platform.assessment.model.Problem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ProblemRepository extends JpaRepository<Problem, UUID> {
    boolean existsByTitle(String title);

    @Query("""
        SELECT p FROM Problem p
        WHERE p.isPublic = true
        AND (:search IS NULL OR LOWER(p.title) LIKE :search)
        AND (:difficulty IS NULL OR p.difficultyLevel = :difficulty)
        ORDER BY p.title ASC
    """)
    Page<Problem> searchPublicProblems(
        @Param("search") String search,
        @Param("difficulty") Problem.DifficultyLevel difficulty,
        Pageable pageable
    );
}

package com.university.platform.identity.repository;

import com.university.platform.identity.model.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface StudentRepository extends JpaRepository<Student, UUID> {
    List<Student> findTop10ByOrderByTotalPointsDesc();
    java.util.Optional<Student> findByEmail(String email);

}

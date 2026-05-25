package com.university.platform.identity.repository;
import com.university.platform.identity.model.Admin;

import com.university.platform.identity.model.Teacher;
import com.university.platform.identity.model.Teacher.TeacherStatus;
import com.university.platform.identity.model.Teacher.TeacherStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TeacherRepository extends JpaRepository<Teacher, UUID> {

    List<Teacher> findByStatusAndIsEmailVerifiedTrue(TeacherStatus status);

    java.util.Optional<Teacher> findByEmail(String email);
}

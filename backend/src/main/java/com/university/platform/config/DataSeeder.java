package com.university.platform.config;

import com.university.platform.identity.model.Admin;
import com.university.platform.identity.model.Teacher;
import com.university.platform.identity.model.User.Role;
import com.university.platform.identity.repository.UserRepository;
import com.university.platform.identity.repository.TeacherRepository;
import com.university.platform.assessment.model.Problem;
import com.university.platform.assessment.model.Problem.DifficultyLevel;
import com.university.platform.assessment.model.TestCase;
import com.university.platform.assessment.repository.ProblemRepository;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.Optional;

@Slf4j
@Configuration
@Profile({"dev", "seed"})
public class DataSeeder {

    @Bean
    public CommandLineRunner seedAdmin(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            String adminEmail = "admin@university.ac.ma";
            
            if (!userRepository.existsByEmail(adminEmail)) {
                log.info("[SEEDER] Creating default admin account...");
                Admin admin = Admin.builder()
                        .firstName("Super")
                        .lastName("Admin")
                        .email(adminEmail)
                        .passwordHash(passwordEncoder.encode("AdminAdmin1"))
                        .role(Role.ADMIN)
                        .isEmailVerified(true)
                        .adminLevel(2)
                        .build();
                        
                userRepository.save(admin);
                log.info("[SEEDER] Default Admin created successfully.");
                log.info("[SEEDER] Email: {} | Password: {}", adminEmail, "AdminAdmin1");
            } else {
                log.info("[SEEDER] Default admin already exists. Skipping.");
            }
        };
    }

    @Bean
    public CommandLineRunner seedProblems(UserRepository userRepository, TeacherRepository teacherRepository, ProblemRepository problemRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            log.info("[SEEDER] Seeding mock practice problems...");

            String teacherEmail = "prof@university.ac.ma";
            Optional<Teacher> optTeacher = teacherRepository.findByEmail(teacherEmail);
            Teacher prof;
            if (optTeacher.isEmpty()) {
                prof = Teacher.builder()
                        .firstName("Ali")
                        .lastName("Benali")
                        .email(teacherEmail)
                        .passwordHash(passwordEncoder.encode("ProfPass123!"))
                        .role(Role.TEACHER)
                        .isEmailVerified(true)
                        .status(Teacher.TeacherStatus.ACTIVE)
                        .specialty("Algorithms")
                        .department("Computer Science")
                        .build();
                prof = teacherRepository.save(prof);
                log.info("[SEEDER] Default Teacher created. Email: prof@university.ac.ma");
            } else {
                prof = optTeacher.get();
            }

            Problem simpleTest = Problem.builder()
                    .title("Identity Test")
                    .description("Just for testing execution bounds. Print the number you are given.")
                    .timeLimitMs(1000)
                    .memoryLimitMb(128)
                    .difficultyLevel(DifficultyLevel.EASY)
                    .isPublic(true)
                    .createdBy(prof)
                    .build();

            TestCase tc1 = TestCase.builder()
                    .inputData("1")
                    .expectedOutput("1")
                    .isHidden(false)
                    .problem(simpleTest)
                    .build();

            TestCase tc2 = TestCase.builder()
                    .inputData("2")
                    .expectedOutput("2")
                    .isHidden(true)
                    .problem(simpleTest)
                    .build();

            simpleTest.setTestCases(List.of(tc1, tc2));
            problemRepository.save(simpleTest);

            log.info("[SEEDER] Mock test problems saved successfully!");
        };
    }
}

package com.university.platform.config;

import com.university.platform.assessment.model.Problem;
import com.university.platform.assessment.model.TestCase;
import com.university.platform.assessment.repository.ProblemRepository;
import com.university.platform.identity.model.Student;
import com.university.platform.identity.model.Teacher;
import com.university.platform.identity.model.User.Role;
import com.university.platform.identity.repository.StudentRepository;
import com.university.platform.identity.repository.TeacherRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Configuration
@Profile({"dev", "seed"})
@RequiredArgsConstructor
public class TestDataSeeder implements CommandLineRunner {

    private final ProblemRepository problemRepository;
    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        log.info("[SEEDER] Checking/Starting database seeding...");


        log.info("[SEEDER] Starting database seeding...");

        Teacher teacher = (Teacher) teacherRepository.findByEmail("teacher@test.com").orElse(null);
        if (teacher == null) {
            teacher = Teacher.builder()
                    .firstName("Test")
                    .lastName("Teacher")
                    .email("teacher@test.com")
                    .passwordHash(passwordEncoder.encode("password"))
                    .role(Role.TEACHER)
                    .isEmailVerified(true)
                    .status(Teacher.TeacherStatus.ACTIVE)
                    .specialty("Testing")
                    .department("Computer Science")
                    .build();
            teacher = teacherRepository.save(teacher);
            log.info("[SEEDER] Created test teacher.");
        }


        Student student = (Student) studentRepository.findByEmail("student@test.com").orElse(null);
        if (student == null) {
            student = Student.builder()
                    .firstName("Test")
                    .lastName("Student")
                    .email("student@test.com")
                    .apogeeNumber("9999999")
                    .passwordHash(passwordEncoder.encode("password"))

                    .role(Role.STUDENT)
                    .isEmailVerified(true)
                    .build();
            student = studentRepository.save(student);
            log.info("[SEEDER] Created test student.");
        }


        // 3. Create Problems if they don't exist
        if (!problemRepository.existsByTitle("Advanced Problem 1")) {
            createSumProblem(teacher);
            log.info("[SEEDER] Created Advanced Problem 1 (Array Sum).");
        }

        if (!problemRepository.existsByTitle("Advanced Problem 2")) {
            createFibProblem(teacher);
            log.info("[SEEDER] Created Advanced Problem 2 (Fibonacci).");
        }

        if (!problemRepository.existsByTitle("Advanced Problem 3")) {
            createReverseProblem(teacher);
            log.info("[SEEDER] Created Advanced Problem 3 (String Reverse).");
        }

        if (!problemRepository.existsByTitle("Advanced Problem 4")) {
            createPalindromeProblem(teacher);
            log.info("[SEEDER] Created Advanced Problem 4 (Palindrome).");
        }

        if (!problemRepository.existsByTitle("Advanced Problem 5")) {
            createFactorialProblem(teacher);
            log.info("[SEEDER] Created Advanced Problem 5 (Factorial).");
        }






        log.info("[SEEDER] Seeding complete.");
        printIds();
    }

    // ── Test Problem 1: Array Sum ────────────────────────────────────────────
    // Input:  first line = N, next line = N space-separated longs
    // Output: their sum
    private void createSumProblem(Teacher teacher) {
        long[][] cases = {
            {3,  1, 2, 3, /*=*/6},
            {5,  10, 20, 30, 40, 50, /*=*/150},
            {1,  42, /*=*/42},
            {4,  -1, -2, -3, -4, /*=*/-10},
            {6,  100, 200, 300, 400, 500, 600, /*=*/2100},
            {2,  999999999L, 1L, /*=*/1000000000L},
            {3,  0, 0, 0, /*=*/0},
            {4,  7, 14, 21, 28, /*=*/70},
            {5,  -5, 5, -5, 5, 0, /*=*/0},
            {3,  123, 456, 789, /*=*/1368},
            {2,  1000000000L, 2000000000L, /*=*/3000000000L},
            {4,  11, 22, 33, 44, /*=*/110},
            {6,  1, 1, 1, 1, 1, 1, /*=*/6},
            {3,  -100, 50, 60, /*=*/10},
            {5,  9, 8, 7, 6, 5, /*=*/35},
        };
        Problem problem = Problem.builder()
                .title("Advanced Problem 1")
                .description("Given N integers, output their sum.")
                .difficultyLevel(Problem.DifficultyLevel.EASY)
                .isPublic(true).createdBy(teacher)
                .timeLimitMs(5000).memoryLimitMb(256)
                .build();
        List<TestCase> testCases = new ArrayList<>();
        for (long[] c : cases) {
            int n = (int) c[0];
            StringBuilder sb = new StringBuilder().append(n).append("\n");
            long expected = c[c.length - 1];
            for (int i = 1; i <= n; i++) sb.append(c[i]).append(i < n ? " " : "");
            testCases.add(TestCase.builder()
                    .inputData(sb.toString()).expectedOutput(String.valueOf(expected))
                    .isHidden(false).problem(problem).build());
        }
        problem.setTestCases(testCases);
        problemRepository.save(problem);
    }

    // ── Test Problem 2: Fibonacci ────────────────────────────────────────────
    // Input:  single integer N (1 <= N <= 40)
    // Output: Nth Fibonacci number
    private void createFibProblem(Teacher teacher) {
        int[] ns  = {1,  2,  3,  4,  5,  6,  7,  8,  9,  10, 15, 20, 25, 30, 40};
        long[] fib = {1,  1,  2,  3,  5,  8, 13, 21, 34, 55, 610, 6765, 75025L, 832040L, 102334155L};
        Problem problem = Problem.builder()
                .title("Advanced Problem 2")
                .description("Given N, output the Nth Fibonacci number.")
                .difficultyLevel(Problem.DifficultyLevel.MEDIUM)
                .isPublic(true).createdBy(teacher)
                .timeLimitMs(5000).memoryLimitMb(256)
                .build();
        List<TestCase> testCases = new ArrayList<>();
        for (int i = 0; i < ns.length; i++) {
            testCases.add(TestCase.builder()
                    .inputData(String.valueOf(ns[i]))
                    .expectedOutput(String.valueOf(fib[i]))
                    .isHidden(false).problem(problem).build());
        }
        problem.setTestCases(testCases);
        problemRepository.save(problem);
    }

    // ── Test Problem 3: String Reverse ───────────────────────────────────────
    // Input:  a single word (no spaces)
    // Output: the word reversed
    private void createReverseProblem(Teacher teacher) {
        String[][] cases = {
            {"hello",       "olleh"},
            {"java",        "avaj"},
            {"abcde",       "edcba"},
            {"racecar",     "racecar"},
            {"university",  "ytisrevinu"},
            {"a",           "a"},
            {"ab",          "ba"},
            {"madam",       "madam"},
            {"algorithm",   "mhtirogla"},
            {"testing",     "gnitset"},
            {"concurrent",  "tnerrucnoc"},
            {"platform",    "mroftalp"},
            {"submission",  "noissimbus"},
            {"rabbitmq",    "qmtibbar"},
            {"fibonacci",   "iccanobif"},
        };
        Problem problem = Problem.builder()
                .title("Advanced Problem 3")
                .description("Given a word, output it reversed.")
                .difficultyLevel(Problem.DifficultyLevel.EASY)
                .isPublic(true).createdBy(teacher)
                .timeLimitMs(5000).memoryLimitMb(256)
                .build();
        List<TestCase> testCases = new ArrayList<>();
        for (String[] c : cases) {
            testCases.add(TestCase.builder()
                    .inputData(c[0]).expectedOutput(c[1])
                    .isHidden(false).problem(problem).build());
        }
        problem.setTestCases(testCases);
        problemRepository.save(problem);
    }

    // ── Test Problem 4: Palindrome ───────────────────────────────────────────
    // Input:  A single string
    // Output: 1 if palindrome, 0 if not
    private void createPalindromeProblem(Teacher teacher) {
        String[][] cases = {
            {"racecar", "1"}, {"hello", "0"}, {"madam", "1"}, {"a", "1"}, {"bb", "1"},
            {"abc", "0"}, {"level", "1"}, {"stats", "1"}, {"radar", "1"}, {"java", "0"},
            {"xyzyx", "1"}, {"xyzyxx", "0"}, {"palindrome", "0"}, {"wow", "1"}, {"noon", "1"}
        };
        Problem problem = Problem.builder()
                .title("Advanced Problem 4")
                .description("Given a string, output 1 if palindrome, 0 otherwise.")
                .difficultyLevel(Problem.DifficultyLevel.MEDIUM)
                .isPublic(true).createdBy(teacher)
                .timeLimitMs(5000).memoryLimitMb(256)
                .build();
        List<TestCase> testCases = new ArrayList<>();
        for (String[] c : cases) {
            testCases.add(TestCase.builder()
                    .inputData(c[0]).expectedOutput(c[1])
                    .isHidden(false).problem(problem).build());
        }
        problem.setTestCases(testCases);
        problemRepository.save(problem);
    }

    // ── Test Problem 5: Factorial ────────────────────────────────────────────
    // Input:  Integer N
    // Output: N!
    private void createFactorialProblem(Teacher teacher) {
        long[][] cases = {
            {0, 1}, {1, 1}, {2, 2}, {3, 6}, {4, 24}, {5, 120}, {6, 720},
            {7, 5040}, {8, 40320}, {9, 362880}, {10, 3628800},
            {11, 39916800}, {12, 479001600}, {13, 6227020800L}, {14, 87178291200L}
        };
        Problem problem = Problem.builder()
                .title("Advanced Problem 5")
                .description("Given N, output N!")
                .difficultyLevel(Problem.DifficultyLevel.EASY)
                .isPublic(true).createdBy(teacher)
                .timeLimitMs(5000).memoryLimitMb(256)
                .build();
        List<TestCase> testCases = new ArrayList<>();
        for (long[] c : cases) {
            testCases.add(TestCase.builder()
                    .inputData(String.valueOf(c[0])).expectedOutput(String.valueOf(c[1]))
                    .isHidden(false).problem(problem).build());
        }
        problem.setTestCases(testCases);
        problemRepository.save(problem);
    }

    // ── Kept for backward-compat (not used by new seed, but don't delete) ────
    private void createProblem(Teacher teacher, String title, String desc, int caseCount) {
        Problem problem = Problem.builder()
                .title(title)
                .description(desc)
                .difficultyLevel(Problem.DifficultyLevel.EASY)
                .isPublic(true)
                .createdBy(teacher)
                .timeLimitMs(5000)
                .memoryLimitMb(256)
                .build();

        List<TestCase> testCases = new ArrayList<>();
        for (int i = 0; i < caseCount; i++) {
            testCases.add(TestCase.builder()
                    .inputData("Hello " + i)
                    .expectedOutput("Hello " + i)
                    .isHidden(false)
                    .problem(problem)
                    .build());
        }
        problem.setTestCases(testCases);
        problemRepository.save(problem);
    }

    private void printIds() {
        UUID sId = studentRepository.findAll().stream().findFirst().map(Student::getId).orElse(null);
        // Use a projection query to avoid loading testCases (which are LAZY)
        List<Problem> problems = problemRepository.findAll();

        log.info("[SEEDER] STUDENT_ID: {}", sId);
        problems.forEach(p -> log.info("[SEEDER] PROBLEM: {} -> ID: {}", p.getTitle(), p.getProblemId()));

        // Write to a file for the Python script
        try {
            java.io.PrintWriter writer = new java.io.PrintWriter("/tmp/test_config.json");
            writer.println("{");
            writer.println("  \"studentId\": \"" + sId + "\",");
            writer.println("  \"problems\": [");
            for (int i = 0; i < problems.size(); i++) {
                Problem p = problems.get(i);
                writer.print("    {\"title\": \"" + p.getTitle() + "\", \"id\": \"" + p.getProblemId() + "\"}");
                if (i < problems.size() - 1) writer.println(",");
                else writer.println();
            }
            writer.println("  ]");
            writer.println("}");
            writer.close();
            log.info("[SEEDER] Exported IDs to /tmp/test_config.json");
        } catch (Exception e) {
            log.error("[SEEDER] Failed to write test_config.json", e);
        }
    }
}


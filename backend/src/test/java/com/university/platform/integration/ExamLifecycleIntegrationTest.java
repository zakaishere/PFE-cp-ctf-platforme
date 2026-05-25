package com.university.platform.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.university.platform.academic.model.Division;
import com.university.platform.academic.model.Module;
import com.university.platform.academic.model.Semester;
import com.university.platform.assessment.dto.CreateAssessmentDTO;
import com.university.platform.assessment.dto.CreateProblemDTO;
import com.university.platform.execution.dto.SubmissionRequestDTO;
import com.university.platform.execution.model.Submission.ProgrammingLanguage;
import com.university.platform.identity.model.Department;
import com.university.platform.identity.model.Student;
import com.university.platform.identity.model.Teacher;
import com.university.platform.identity.model.User.Role;
import com.university.platform.identity.service.JwtService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@Transactional
@ActiveProfiles("test")
public class ExamLifecycleIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JwtService jwtService;

    private Teacher teacher;
    private Student student;
    private Module module;

    private String teacherJwt;
    private String studentJwt;

    @BeforeEach
    public void setUp() {
        Department dept = entityManager.createQuery("SELECT d FROM Department d WHERE d.name = :name", Department.class)
                .setParameter("name", "Computer Science")
                .getResultList().stream().findFirst().orElse(null);
        
        if (dept == null) {
            dept = Department.builder().name("Computer Science").build();
            entityManager.persist(dept);
        }

        Division div = entityManager.createQuery("SELECT d FROM Division d WHERE d.name = :name", Division.class)
                .setParameter("name", "Software Engineering")
                .getResultList().stream().findFirst().orElse(null);
        
        if (div == null) {
            div = Division.builder().name("Software Engineering").department(dept).build();
            entityManager.persist(div);
        }

        Semester sem = entityManager.createQuery("SELECT s FROM Semester s WHERE s.name = :name", Semester.class)
                .setParameter("name", "Fall 2026")
                .getResultList().stream().findFirst().orElse(null);
        
        if (sem == null) {
            sem = Semester.builder().name("Fall 2026").build();
            entityManager.persist(sem);
        }

        module = Module.builder().name("Algorithms").division(div).semester(sem).build();
        entityManager.persist(module);

        teacher = Teacher.builder()
                .firstName("John")
                .lastName("Doe")
                .email("john.doe@university.edu")
                .passwordHash("hashed")
                .role(Role.TEACHER)
                .isEmailVerified(true)
                .status(Teacher.TeacherStatus.ACTIVE)
                .build();
        teacher.getModules().add(module);
        entityManager.persist(teacher);

        student = Student.builder()
                .firstName("Jane")
                .lastName("Smith")
                .email("jane.smith@student.edu")
                .passwordHash("hashed")
                .apogeeNumber("APG123456")
                .role(Role.STUDENT)
                .isEmailVerified(true)
                .division(div)
                .semester(sem)
                .build();
        entityManager.persist(student);
        entityManager.flush();

        teacherJwt = "Bearer " + jwtService.generateToken(teacher.getId(), teacher.getEmail(), "TEACHER");
        studentJwt = "Bearer " + jwtService.generateToken(student.getId(), student.getEmail(), "STUDENT");
    }

    @Test
    public void shouldExecuteFullExamLifecycle() throws Exception {
        // ==========================================
        // STEP 2: TEACHER SCENARIO (CREATION)
        // ==========================================

        // 1. Create Problem
        CreateProblemDTO problemReq = new CreateProblemDTO();
        problemReq.setTitle("Reverse Array");
        problemReq.setDescription("Reverse the given array.");
        problemReq.setDifficultyLevel("EASY");
        problemReq.setIsPublic(false);
        CreateProblemDTO.TestCaseDTO tc1 = new CreateProblemDTO.TestCaseDTO();
        tc1.setInputData("1 2 3");
        tc1.setExpectedOutput("3 2 1");
        tc1.setIsHidden(true);
        CreateProblemDTO.TestCaseDTO tc2 = new CreateProblemDTO.TestCaseDTO();
        tc2.setInputData("a b c");
        tc2.setExpectedOutput("c b a");
        tc2.setIsHidden(true);
        problemReq.setTestCases(List.of(tc1, tc2));

        MvcResult pResult = mockMvc.perform(post("/api/problems")
                .header("Authorization", teacherJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(problemReq)))
                .andExpect(status().isOk())
                .andReturn();
        String problemId = objectMapper.readTree(pResult.getResponse().getContentAsString()).get("problemId").asText();

        // 2. Create Exam
        CreateAssessmentDTO examReq = new CreateAssessmentDTO();
        examReq.setTitle("Final Exam");
        examReq.setModuleId(module.getModuleId());
        examReq.setScheduledStartTime(LocalDateTime.now().minusMinutes(5)); // already started
        examReq.setDurationMinutes(120);
        examReq.setStrictAccessCode("FINAL2026");

        MvcResult eResult = mockMvc.perform(post("/api/assessments/exams")
                .header("Authorization", teacherJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(examReq)))
                .andExpect(status().isCreated())
                .andReturn();
        String examId = objectMapper.readTree(eResult.getResponse().getContentAsString()).get("assessmentId").asText();

        // 3. Link Problem to Exam (Assuming basePoints is sent via body or query param; default 500 in backend)
        // Note: The /api/assessments/{assessmentId}/problems/{problemId} endpoint currently takes no body.
        mockMvc.perform(post("/api/assessments/" + examId + "/problems/" + problemId)
                .header("Authorization", teacherJwt))
                .andExpect(status().isOk());


        // ==========================================
        // STEP 3: STUDENT SCENARIO (EXECUTION)
        // ==========================================

        // 1. Join Exam
        // (TDD assumption: endpoint expects a POST to check access logic)
        mockMvc.perform(post("/api/assessments/" + examId + "/access")
                .header("Authorization", studentJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"accessCode\": \"FINAL2026\"}"))
                .andExpect(status().isOk());

        // 2. Fail Attempt (Synchronously check result)
        SubmissionRequestDTO failSub = new SubmissionRequestDTO();
        failSub.setStudentId(student.getId());
        failSub.setProblemId(UUID.fromString(problemId));
        failSub.setAssessmentId(UUID.fromString(examId));
        failSub.setAccessCode("FINAL2026");
        failSub.setLanguage(ProgrammingLanguage.PYTHON);
        failSub.setSourceCode("print('wrong')");

        MvcResult failRes = mockMvc.perform(post("/api/submissions")
                .header("Authorization", studentJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(failSub)))
                .andExpect(status().isAccepted())
                .andReturn();
        
        String failSubmissionId = objectMapper.readTree(failRes.getResponse().getContentAsString()).get("submissionId").asText();
        
        // Polling synchronous equivalent isn't ideal but we have an Async pipeline doing the work.
        // For a pure synchronous Mvc mock, in an actual deployment the RabbitMQ Worker handles it.
        // Assuming test configuration executes workers synchronously.
        
        // 3. Pass Attempt
        SubmissionRequestDTO passSub = new SubmissionRequestDTO();
        passSub.setStudentId(student.getId());
        passSub.setProblemId(UUID.fromString(problemId));
        passSub.setAssessmentId(UUID.fromString(examId));
        passSub.setAccessCode("FINAL2026");
        passSub.setLanguage(ProgrammingLanguage.PYTHON);
        passSub.setSourceCode("lst = input().split()\nlst.reverse()\nprint(' '.join(lst))");

        MvcResult passRes = mockMvc.perform(post("/api/submissions")
                .header("Authorization", studentJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(passSub)))
                .andExpect(status().isAccepted())
                .andReturn();

        // ==========================================
        // STEP 4: TIME SIMULATION & FINAL REVIEW
        // ==========================================

        // 1. Trigger End Exam
        mockMvc.perform(post("/api/teacher/exams/" + examId + "/close")
                .header("Authorization", teacherJwt))
                .andExpect(status().isOk());

        // 2. Teacher Review - GET submissions
        mockMvc.perform(get("/api/teacher/exams/" + examId + "/submissions")
                .header("Authorization", teacherJwt)
                .param("studentId", student.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].pointsAwarded").exists())
                .andExpect(jsonPath("$.content[0].status").exists());

        // 3. Student Feedback - GET final grade
        mockMvc.perform(get("/api/students/me/exams/" + examId + "/results")
                .header("Authorization", studentJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.finalGrade").exists());
    }
}

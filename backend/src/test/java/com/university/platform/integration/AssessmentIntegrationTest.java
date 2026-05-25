package com.university.platform.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.university.platform.identity.model.Department;
import com.university.platform.academic.model.Division;
import com.university.platform.academic.model.Module;
import com.university.platform.academic.model.Semester;
import com.university.platform.assessment.dto.CreateAssessmentDTO;
import com.university.platform.assessment.dto.CreateProblemDTO;
import com.university.platform.identity.model.Teacher;
import com.university.platform.identity.repository.TeacherRepository;
import com.university.platform.academic.repository.ModuleRepository;
import com.university.platform.identity.service.JwtService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManager;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class AssessmentIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TeacherRepository teacherRepository;

    @Autowired
    private ModuleRepository moduleRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private EntityManager entityManager;

    private static String jwt;
    private static String moduleId;
    private static String liveExamId;
    private static String openTpId;

    @Autowired
    private org.springframework.transaction.PlatformTransactionManager txManager;

    @BeforeEach
    public void setupData() {
        if (jwt != null) return; // Only run once

        new org.springframework.transaction.support.TransactionTemplate(txManager).execute(status -> {
            Teacher teacher = Teacher.builder()
                    .firstName("Test")
                    .lastName("Teacher")
                    .email("teacher@unv.edu")
                    .passwordHash("hash")
                    .role(com.university.platform.identity.model.User.Role.TEACHER)
                    .isEmailVerified(true)
                    .status(Teacher.TeacherStatus.ACTIVE)
                    .build();
            entityManager.persist(teacher);

            Department dept = Department.builder().name("Dept").build();
            entityManager.persist(dept);

            Division div = Division.builder().name("Div").department(dept).build();
            entityManager.persist(div);

            Semester sem = Semester.builder().name("Sem").build();
            entityManager.persist(sem);

            Module mod = Module.builder().name("Module 1").division(div).semester(sem).build();
            entityManager.persist(mod);

            teacher.getModules().add(mod);
            entityManager.flush();

            jwt = "Bearer " + jwtService.generateToken(teacher.getId(), teacher.getEmail(), "TEACHER");
            moduleId = mod.getModuleId().toString();
            return null;
        });
    }

    @Test
    @Order(1)
    public void testCreateLiveExam() throws Exception {
        CreateAssessmentDTO req = new CreateAssessmentDTO();
        req.setTitle("Midterm Programming");
        req.setDescription("Strict programming test");
        req.setModuleId(UUID.fromString(moduleId));
        req.setScheduledStartTime(LocalDateTime.now().plusDays(1));
        req.setDurationMinutes(120);
        req.setStrictAccessCode("PROG123");

        MvcResult result = mockMvc.perform(post("/api/assessments/exams")
                .header("Authorization", jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode res = objectMapper.readTree(result.getResponse().getContentAsString());
        liveExamId = res.get("assessmentId").asText();
        assertThat(liveExamId).isNotBlank();
    }

    @Test
    @Order(2)
    public void testCreateOpenTP() throws Exception {
        CreateAssessmentDTO req = new CreateAssessmentDTO();
        req.setTitle("Weekend TP");
        req.setDescription("Open submission practice");
        req.setModuleId(UUID.fromString(moduleId));
        req.setDeadline(LocalDateTime.now().plusDays(5));
        req.setMaxAttempts(10);

        MvcResult result = mockMvc.perform(post("/api/assessments/tps")
                .header("Authorization", jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode res = objectMapper.readTree(result.getResponse().getContentAsString());
        openTpId = res.get("assessmentId").asText();
        assertThat(openTpId).isNotBlank();
    }

    @Test
    @Order(3)
    public void testAddProblemsToLiveExam() throws Exception {
        // Create Problem
        CreateProblemDTO problemReq = new CreateProblemDTO();
        problemReq.setTitle("Binary Search Tree Insertion");
        problemReq.setDescription("Implement insertion in a BST.");
        problemReq.setDifficultyLevel("HARD");
        problemReq.setIsPublic(true);
        problemReq.setTimeLimitMs(1500);
        problemReq.setMemoryLimitMb(512);

        CreateProblemDTO.TestCaseDTO tc1 = new CreateProblemDTO.TestCaseDTO();
        tc1.setInputData("5 3 7");
        tc1.setExpectedOutput("Preorder: 5 3 7");
        tc1.setIsHidden(false);

        CreateProblemDTO.TestCaseDTO tc2 = new CreateProblemDTO.TestCaseDTO();
        tc2.setInputData("10 5");
        tc2.setExpectedOutput("Preorder: 10 5");
        tc2.setIsHidden(true);

        problemReq.setTestCases(List.of(tc1, tc2));

        MvcResult pResult = mockMvc.perform(post("/api/problems")
                .header("Authorization", jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(problemReq)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode pRes = objectMapper.readTree(pResult.getResponse().getContentAsString());
        String problemId = pRes.get("problemId").asText();

        // Assign to LiveExam
        mockMvc.perform(post("/api/assessments/" + liveExamId + "/problems/" + problemId)
                .header("Authorization", jwt))
                .andExpect(status().isOk());
    }
}

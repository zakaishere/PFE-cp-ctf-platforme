package com.university.platform.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.university.platform.identity.model.Department;
import com.university.platform.academic.model.Division;
import com.university.platform.academic.model.Module;
import com.university.platform.academic.model.Semester;
import com.university.platform.identity.dto.LoginRequest;
import com.university.platform.identity.dto.RegisterTeacherRequest;
import com.university.platform.identity.model.Teacher;
import com.university.platform.identity.repository.TeacherRepository;
import com.university.platform.identity.service.EmailService;
import com.university.platform.identity.service.JwtService;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManager;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class AuthIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TeacherRepository teacherRepository;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JwtService jwtService;

    @MockBean
    private EmailService emailService;

    private static String teacherId;
    private static String jwtToken;

    @Test
    @Order(1)
    public void testTeacherRegistration() throws Exception {
        // Mock email sending
        doNothing().when(emailService).sendVerificationEmail(anyString(), anyString());

        RegisterTeacherRequest req = new RegisterTeacherRequest();
        req.setFirstName("Dr. Alan");
        req.setLastName("Turing");
        req.setEmail("turing@university.edu");
        req.setPassword("SecurePass123!");
        req.setSpecialty("Computer Science");
        req.setDepartment("Mathematics");

        mockMvc.perform(post("/api/auth/register/teacher")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());

        // Verify status is PENDING and grab the UUID
        Teacher t = teacherRepository.findByEmail("turing@university.edu").orElseThrow();
        assertThat(t.getStatus()).isEqualTo(Teacher.TeacherStatus.PENDING);
        assertThat(t.getIsEmailVerified()).isFalse();
        
        teacherId = t.getId().toString();
        
        // Let's manually verify email to bypass OTP for the next step 
        t.setIsEmailVerified(true);
        teacherRepository.save(t);
    }

    @Test
    @Order(2)
    public void testAdminApproval() throws Exception {
        doNothing().when(emailService).sendTeacherApprovedEmail(anyString(), anyString());

        // Note: Currently /api/admin is unauthenticated or mock requires an admin JWT. 
        // We assume /api/admin endpoints work here based on user context.
        String adminJwt = "Bearer " + jwtService.generateToken(UUID.randomUUID(), "admin@university.edu", "ADMIN");

        mockMvc.perform(put("/api/admin/teachers/" + teacherId + "/activate")
                .header("Authorization", adminJwt)
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        Teacher t = teacherRepository.findById(UUID.fromString(teacherId)).orElseThrow();
        assertThat(t.getStatus()).isEqualTo(Teacher.TeacherStatus.ACTIVE);
    }

    @Test
    @Order(3)
    public void testTeacherLogin() throws Exception {
        LoginRequest req = new LoginRequest();
        req.setEmail("turing@university.edu");
        req.setPassword("SecurePass123!");

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();

        String responseStr = result.getResponse().getContentAsString();
        JsonNode responseNode = objectMapper.readTree(responseStr);
        jwtToken = responseNode.get("token").asText();
        
        assertThat(jwtToken).isNotBlank();
    }

    @Test
    @Order(4)
    @Transactional
    public void testAcademicSetupViaRepositories() {
        // Since Academic CRUD HTTP endpoints are not built yet, we assert the JPA Relational Model 
        // works perfectly using the teacher context we just authenticated.
        
        com.university.platform.identity.model.Department dept = com.university.platform.identity.model.Department.builder()
                .name("Computer Science Department")
                .build();
        entityManager.persist(dept);
        
        Division division = Division.builder()
                .name("SMI")
                .department(dept)
                .build();
        entityManager.persist(division);

        Semester semester = Semester.builder()
                .name("Semester 5")
                .build();
        entityManager.persist(semester);

        Module module = Module.builder()
                .name("Data Structures")
                .division(division)
                .semester(semester)
                .build();
        entityManager.persist(module);

        Teacher teacher = teacherRepository.findById(UUID.fromString(teacherId)).orElseThrow();
        teacher.getModules().add(module);
        entityManager.flush(); // Flush validates foreign key constraints

        Teacher fetchedTeacher = entityManager.find(Teacher.class, teacher.getId());
        assertThat(fetchedTeacher.getModules()).hasSize(1);
        assertThat(fetchedTeacher.getModules().get(0).getName()).isEqualTo("Data Structures");
    }
}

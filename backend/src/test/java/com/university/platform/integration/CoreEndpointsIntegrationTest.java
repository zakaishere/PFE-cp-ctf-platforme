package com.university.platform.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class CoreEndpointsIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    public void testLoginEndpoint_Success() throws Exception {
        Map<String, String> creds = new HashMap<>();
        creds.put("email", "student@test.com");
        creds.put("password", "password123");

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(creds)))
                .andExpect(status().isOk());
    }

    @Test
    public void testSubmissionEndpoint_UnauthorizedWithoutToken() throws Exception {
        Map<String, Object> submission = new HashMap<>();
        submission.put("studentId", UUID.randomUUID().toString());
        submission.put("problemId", UUID.randomUUID().toString());
        submission.put("sourceCode", "print(input())");
        submission.put("language", "PYTHON");
        submission.put("runOnly", false);

        // Should return 401 Unauthorized or 403 Forbidden because no Bearer token is provided
        mockMvc.perform(post("/api/submissions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(submission)))
                .andExpect(status().isForbidden()); // Spring Security defaults to 403 if it rejects before filtering token
    }
}

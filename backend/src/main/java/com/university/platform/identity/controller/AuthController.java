package com.university.platform.identity.controller;
import com.university.platform.identity.dto.AuthResponseDTO;
import com.university.platform.identity.dto.LoginRequest;
import com.university.platform.identity.service.AuthService;
import com.university.platform.identity.dto.RegisterTeacherRequest;
import com.university.platform.identity.dto.VerifyEmailRequest;
import com.university.platform.identity.dto.ForgotPasswordRequest;
import com.university.platform.identity.dto.ResendVerificationRequest;
import com.university.platform.identity.dto.ResetPasswordRequest;
import com.university.platform.identity.dto.RegisterStudentRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")   
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req) {
        try {
            return ResponseEntity.ok(authService.login(req));
        } catch (BadCredentialsException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid email or password"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/register/student")
    public ResponseEntity<?> registerStudent(@Valid @RequestBody RegisterStudentRequest req) {
        try {
            return ResponseEntity.ok(authService.registerStudent(req));
        } catch (DataIntegrityViolationException e) {
            String msg = e.getMessage() != null && e.getMessage().contains("uq_students_apogee")
                    ? "This apogee number is already registered"
                    : "Email already registered";
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", msg));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/register/teacher")
    public ResponseEntity<?> registerTeacher(@Valid @RequestBody RegisterTeacherRequest req) {
        try {
            return ResponseEntity.ok(authService.registerTeacher(req));
        } catch (DataIntegrityViolationException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Email already registered"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/verify-email")
    public ResponseEntity<Map<String, String>> verifyEmail(
            @Valid @RequestBody VerifyEmailRequest req) {
        return ResponseEntity.ok(authService.verifyEmail(req));
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<Map<String, String>> resendVerification(
            @Valid @RequestBody ResendVerificationRequest req) {
        return ResponseEntity.ok(authService.resendVerification(req));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest req) {
        return ResponseEntity.ok(authService.forgotPassword(req));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest req) {
        return ResponseEntity.ok(authService.resetPassword(req));
    }
}

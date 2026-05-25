package com.university.platform.identity.service;

import com.university.platform.identity.dto.*;
import com.university.platform.identity.model.Student;
import com.university.platform.identity.model.Teacher;
import com.university.platform.identity.model.User;
import com.university.platform.identity.model.User.Role;
import com.university.platform.identity.model.VerificationToken;
import com.university.platform.identity.model.VerificationToken.TokenType;
import com.university.platform.identity.repository.StudentRepository;
import com.university.platform.identity.repository.TeacherRepository;
import com.university.platform.identity.repository.UserRepository;
import com.university.platform.identity.repository.VerificationTokenRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository              userRepository;
    private final StudentRepository           studentRepository;
    private final TeacherRepository           teacherRepository;
    private final VerificationTokenRepository tokenRepository;
    private final EmailService                emailService;
    private final AuthenticationManager        authenticationManager;
    private final BCryptPasswordEncoder        passwordEncoder;
    private final JwtService                   jwtService;
 
    @org.springframework.beans.factory.annotation.Value("${app.security.disable-verification:false}")
    private boolean disableVerification;
 
    private static final SecureRandom RANDOM = new SecureRandom();

    private VerificationToken generateOTP(User user, TokenType type) {
        tokenRepository.deleteByUserIdAndTokenType(user.getId(), type);
        String code = String.valueOf(100000 + RANDOM.nextInt(900000));
        VerificationToken token = VerificationToken.builder()
                .user(user)
                .otpCode(code)
                .tokenType(type)
                .expiryDate(LocalDateTime.now().plusMinutes(15))
                .build();
        return tokenRepository.save(token);
    }

    public AuthResponseDTO login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!disableVerification) {
            if (!user.getIsEmailVerified()) {
                throw new RuntimeException("Email not verified. Please check your inbox.");
            }

            if (user.getRole() == Role.TEACHER) {
                Teacher teacher = teacherRepository.findById(user.getId()).get();
                if (teacher.getStatus() != Teacher.TeacherStatus.ACTIVE) {
                    throw new RuntimeException("Account pending administrator activation.");
                }
            }
        }

        String jwt = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole().name());
        return AuthResponseDTO.builder()
                .token(jwt)
                .email(user.getEmail())
                .role(user.getRole().name())
                .firstName(user.getFirstName())
                .userId(user.getId().toString())
                .build();
    }

    @Transactional
    public Map<String, String> registerStudent(RegisterStudentRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already registered");
        }

        Student student = Student.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(Role.STUDENT)
                .isEmailVerified(disableVerification)
                .apogeeNumber(request.getApogeeNumber())
                .build();

        studentRepository.save(student);

        if (!disableVerification) {
            VerificationToken token = generateOTP(student, TokenType.EMAIL_VERIFICATION);
            emailService.sendVerificationEmail(student.getEmail(), token.getOtpCode());
            return Map.of("message", "Registration successful. Please check your email for the 6-digit verification code.");
        }

        return Map.of("message", "Registration successful. Verification bypassed (Testing Mode).");
    }

    @Transactional
    public Map<String, String> registerTeacher(RegisterTeacherRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already registered");
        }

        Teacher teacher = Teacher.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(Role.TEACHER)
                .isEmailVerified(disableVerification) // Verified by default if disabled
                .specialty(request.getSpecialty())
                .department(request.getDepartment())
                .status(disableVerification ? Teacher.TeacherStatus.ACTIVE : Teacher.TeacherStatus.PENDING) 
                .build();

        teacherRepository.save(teacher);

        if (!disableVerification) {
            VerificationToken token = generateOTP(teacher, TokenType.EMAIL_VERIFICATION);
            emailService.sendVerificationEmail(teacher.getEmail(), token.getOtpCode());
            return Map.of("message", "Registration successful. Please check your email for the 6-digit verification code.");
        }

        return Map.of("message", "Registration successful. Verification bypassed (Testing Mode).");


    }

    @Transactional
    public Map<String, String> verifyEmail(VerifyEmailRequest request) {
        VerificationToken token = tokenRepository.findByOtpCodeAndUser_EmailAndTokenType(
                request.getOtpCode(), request.getEmail(), TokenType.EMAIL_VERIFICATION)
                .orElseThrow(() -> new RuntimeException("Invalid or expired code"));

        if (token.isExpired()) {
            throw new RuntimeException("Code expired");
        }

        User user = token.getUser();
        user.setIsEmailVerified(true);
        userRepository.save(user);
        tokenRepository.delete(token);

        if (user.getRole() == Role.TEACHER) {
            emailService.sendTeacherPendingEmail(user.getEmail(), user.getFirstName());
        }

        return Map.of("message", "Email verified successfully! You can now log in.");
    }

    @Transactional
    public Map<String, String> resendVerification(ResendVerificationRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getIsEmailVerified()) {
            throw new RuntimeException("Email already verified");
        }

        VerificationToken token = generateOTP(user, TokenType.EMAIL_VERIFICATION);
        emailService.sendVerificationEmail(user.getEmail(), token.getOtpCode());

        return Map.of("message", "A new verification code has been sent to your email.");
    }

    @Transactional
    public Map<String, String> forgotPassword(ForgotPasswordRequest request) {
        userRepository.findByEmail(request.getEmail()).ifPresent(user -> {
            VerificationToken token = generateOTP(user, TokenType.PASSWORD_RESET);
            emailService.sendPasswordResetEmail(user.getEmail(), token.getOtpCode());
        });
        return Map.of("message", "If this email is registered, a reset code has been sent.");
    }

    @Transactional
    public Map<String, String> resetPassword(ResetPasswordRequest request) {
        VerificationToken token = tokenRepository.findByOtpCodeAndUser_EmailAndTokenType(
                request.getOtpCode(), request.getEmail(), TokenType.PASSWORD_RESET)
                .orElseThrow(() -> new RuntimeException("Invalid or expired code"));

        if (token.isExpired()) {
            throw new RuntimeException("Code expired");
        }

        User user = token.getUser();
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setIsEmailVerified(true);
        userRepository.save(user);
        tokenRepository.delete(token);

        return Map.of("message", "Password reset successfully. You can now log in.");
    }
}

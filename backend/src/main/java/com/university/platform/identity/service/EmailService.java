package com.university.platform.identity.service;

import com.university.platform.identity.model.Student;
import com.university.platform.identity.repository.StudentRepository;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;
    private final StudentRepository studentRepository;

    private static final String PLATFORM_URL = "https://university-platform.ma/dashboard";
    private static final DateTimeFormatter DT_FMT =
            DateTimeFormatter.ofPattern("EEEE, MMMM d yyyy 'at' HH:mm");

    private static final String PLATFORM_NAME   = "PSP Academic Platform";
    private static final String BRAND_COLOR      = "#6366f1";
    private static final String TEXT_COLOR       = "#e2e8f0";
    private static final String BACKGROUND_COLOR = "#020617";
    private static final String CARD_BG          = "#0f172a";
    private static final String AMBER_COLOR       = "#f59e0b";
    private static final String SUCCESS_COLOR     = "#22c55e";
    private static final String MUTED_COLOR       = "#64748b";

    @Async
    public void sendVerificationEmail(String toEmail, String code) {
        String subject = code + " is your " + PLATFORM_NAME + " verification code";
        String html = String.format("""
            <div style="font-family: 'Inter', sans-serif; background: %s; color: %s; padding: 40px; text-align: center;">
                <div style="background: %s; padding: 30px; border-radius: 12px; display: inline-block; min-width: 300px; border: 1px solid #1e293b;">
                    <h2 style="color: %s; margin-top: 0;">Verify your email</h2>
                    <p style="font-size: 16px;">Welcome to %s! Use the code below to complete your registration:</p>
                    <div style="background: #1e293b; padding: 20px; border-radius: 8px; margin: 25px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: %s;">%s</span>
                    </div>
                    <p style="font-size: 14px; opacity: 0.7;">This code will expire in 15 minutes.</p>
                </div>
            </div>
            """, BACKGROUND_COLOR, TEXT_COLOR, CARD_BG, BRAND_COLOR, PLATFORM_NAME, AMBER_COLOR, code);

        send(toEmail, subject, html);
    }

    @Async
    public void sendPasswordResetEmail(String toEmail, String code) {
        String subject = "Reset your password on " + PLATFORM_NAME;
        String html = String.format("""
            <div style="font-family: 'Inter', sans-serif; background: %s; color: %s; padding: 40px; text-align: center;">
                <div style="background: %s; padding: 30px; border-radius: 12px; display: inline-block; min-width: 300px; border: 1px solid #1e293b;">
                    <h2 style="color: %s; margin-top: 0;">Reset Password</h2>
                    <p style="font-size: 16px;">We received a request to reset your password. Use this code to continue:</p>
                    <div style="background: #1e293b; padding: 20px; border-radius: 8px; margin: 25px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: %s;">%s</span>
                    </div>
                    <p style="font-size: 14px; opacity: 0.7;">If you didn't request this, you can safely ignore this email.</p>
                </div>
            </div>
            """, BACKGROUND_COLOR, TEXT_COLOR, CARD_BG, BRAND_COLOR, AMBER_COLOR, code);

        send(toEmail, subject, html);
    }

    @Async
    public void sendTeacherPendingEmail(String toEmail, String teacherName) {
        String subject = "Account verification complete - Next steps";
        String html = String.format("""
            <div style="font-family: 'Inter', sans-serif; background: %s; color: %s; padding: 40px; text-align: center;">
                <div style="background: %s; padding: 30px; border-radius: 12px; display: inline-block; min-width: 300px; border: 1px solid #1e293b;">
                    <h2 style="color: %s; margin-top: 0;">Verification Success!</h2>
                    <p style="font-size: 16px;">Hello %s,</p>
                    <p style="font-size: 16px; line-height: 1.6;">Your email is now verified. Since you're registering as a Teacher, your account requires one final manual activation by our administrators.</p>
                    <p style="font-size: 16px; line-height: 1.6;">You'll receive another email once your account is ready to use.</p>
                </div>
            </div>
            """, BACKGROUND_COLOR, TEXT_COLOR, CARD_BG, SUCCESS_COLOR, teacherName);

        send(toEmail, subject, html);
    }

    @Async
    public void sendTeacherApprovedEmail(String toEmail, String teacherName) {
        String subject = "Your teacher account is ACTIVE";
        String html = String.format("""
            <div style="font-family: 'Inter', sans-serif; background: %s; color: %s; padding: 40px; text-align: center;">
                <div style="background: %s; padding: 30px; border-radius: 12px; display: inline-block; min-width: 300px; border: 1px solid #1e293b;">
                    <h2 style="color: %s; margin-top: 0;">Welcome Aboard!</h2>
                    <p style="font-size: 16px;">Hello %s,</p>
                    <p style="font-size: 16px; line-height: 1.6;">An administrator has approved your teacher account. You can now log in and start creating assessments.</p>
                    <a href="https://university-platform.ma/login" style="display: inline-block; background: %s; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: bold;">Login now</a>
                </div>
            </div>
            """, BACKGROUND_COLOR, TEXT_COLOR, CARD_BG, SUCCESS_COLOR, teacherName, BRAND_COLOR);

        send(toEmail, subject, html);
    }

    @Async
    public void sendJoinRequestApproved(UUID studentId, String targetTitle,
                                         String targetType, LocalDateTime startTime,
                                         boolean wasRejectedBefore) {
        Student student = studentRepository.findById(studentId).orElse(null);
        if (student == null) return;

        String subject = "Your request to join " + targetTitle + " has been approved";

        StringBuilder body = new StringBuilder(String.format("""
            <div style="font-family:'Inter',sans-serif;background:%s;color:%s;padding:40px;text-align:center;">
              <div style="background:%s;padding:30px;border-radius:12px;display:inline-block;min-width:320px;border:1px solid #1e293b;">
                <h2 style="color:%s;margin-top:0;">&#x2705; Request Approved</h2>
                <p style="font-size:16px;">Hi %s,</p>
                <p style="font-size:16px;line-height:1.6;">
                  Your request to participate in <strong>%s</strong> has been approved.
                </p>
            """,
                BACKGROUND_COLOR, TEXT_COLOR, CARD_BG, SUCCESS_COLOR,
                student.getFirstName(), targetTitle));

        if (wasRejectedBefore) {
            body.append(String.format(
                "<p style=\"font-size:14px;color:%s;\">" +
                "Note: A previous rejection for this assessment has been reversed.</p>", AMBER_COLOR));
        }

        if (startTime != null) {
            body.append(String.format(
                "<p style=\"font-size:15px;\">Starts: <strong>%s</strong></p>",
                startTime.format(DT_FMT)));
        }

        body.append(String.format("""
                <a href="%s" style="display:inline-block;background:%s;color:white;padding:12px 25px;
                   text-decoration:none;border-radius:6px;margin-top:20px;font-weight:bold;">
                  Go to Platform
                </a>
              </div>
            </div>
            """, PLATFORM_URL, BRAND_COLOR));

        send(student.getEmail(), subject, body.toString());
    }

    @Async
    public void sendJoinRequestRejected(UUID studentId, String targetTitle, String reason) {
        Student student = studentRepository.findById(studentId).orElse(null);
        if (student == null) return;

        String subject = "Update on your request to join " + targetTitle;

        StringBuilder body = new StringBuilder(String.format("""
            <div style="font-family:'Inter',sans-serif;background:%s;color:%s;padding:40px;text-align:center;">
              <div style="background:%s;padding:30px;border-radius:12px;display:inline-block;min-width:320px;border:1px solid #1e293b;">
                <h2 style="color:#ef4444;margin-top:0;">Request Not Approved</h2>
                <p style="font-size:16px;">Hi %s,</p>
                <p style="font-size:16px;line-height:1.6;">
                  Your request to participate in <strong>%s</strong> was not approved.
                </p>
            """,
                BACKGROUND_COLOR, TEXT_COLOR, CARD_BG,
                student.getFirstName(), targetTitle));

        if (reason != null && !reason.isBlank()) {
            body.append(String.format(
                "<p style=\"font-size:15px;\">Reason: <em>%s</em></p>", reason));
        }

        body.append(String.format("""
                <p style="font-size:13px;color:%s;">
                  If you believe this is an error, please contact the organizer directly.
                </p>
              </div>
            </div>
            """, MUTED_COLOR));

        send(student.getEmail(), subject, body.toString());
    }

    private void send(String to, String subject, String body) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(body, true);
            mailSender.send(message);
        } catch (MessagingException e) {
            log.error("[EMAIL] Failed to send email to {}: {}", to, e.getMessage());
        }
    }
}

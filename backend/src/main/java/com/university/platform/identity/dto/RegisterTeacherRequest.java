package com.university.platform.identity.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterTeacherRequest {

    @NotBlank @Size(max = 100)
    public String firstName;

    @NotBlank @Size(max = 100)
    public String lastName;

    @NotBlank @Email @Size(max = 255)
    public String email;

    @NotBlank @Size(min = 8, max = 128)
    public String password;

    @Size(max = 150)
    public String specialty;

    @Size(max = 150)
    public String department;
}

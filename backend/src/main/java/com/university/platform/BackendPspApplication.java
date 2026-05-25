package com.university.platform;
import com.university.platform.identity.model.Admin;
import com.university.platform.identity.model.Cohort;
import com.university.platform.execution.model.Submission;
import com.university.platform.execution.model.Submission.ProgrammingLanguage;
import com.university.platform.execution.model.Submission.SubmissionStatus;
import com.university.platform.identity.model.Student;
import com.university.platform.identity.model.Department;
import com.university.platform.identity.model.User;
import com.university.platform.assessment.model.Assessment;
import com.university.platform.execution.model.Result;
import com.university.platform.execution.model.Result.ResultStatus;
import com.university.platform.assessment.model.Problem;
import com.university.platform.identity.model.Teacher;
import com.university.platform.identity.model.Teacher.TeacherStatus;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class BackendPspApplication {

    public static void main(String[] args) {
        SpringApplication.run(BackendPspApplication.class, args);
    }
}

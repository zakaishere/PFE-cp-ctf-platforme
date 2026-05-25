package com.university.platform.assessment.dto;

import lombok.Data;
import java.util.List;

@Data
public class CreateProblemDTO {
    private String title;
    private String description;
    private String difficultyLevel; 
    private Boolean isPublic;
    private Integer timeLimitMs;
    private Integer memoryLimitMb;
    private List<TestCaseDTO> testCases;
    private List<String> tags;
    private String category;
    private List<String> hints;

    @Data
    public static class TestCaseDTO {
        private String inputData;
        private String expectedOutput;
        private Boolean isHidden;
    }
}

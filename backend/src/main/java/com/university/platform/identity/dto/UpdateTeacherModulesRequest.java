package com.university.platform.identity.dto;

import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class UpdateTeacherModulesRequest {

    private List<UUID> moduleIds;
}

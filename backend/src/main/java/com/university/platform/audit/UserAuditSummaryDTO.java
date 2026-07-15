package com.university.platform.audit;

import java.util.List;
import java.util.UUID;

/** One row of the per-event audit dashboard: rollup of one user's activity. */
public record UserAuditSummaryDTO(
        UUID userId,
        String userName,
        int distinctIpCount,
        List<String> ips,
        boolean multiIp,
        int tabSwitches,
        int focusLosses,
        int copyPastes,
        int totalEvents,
        boolean flagged,       // multi-IP OR any CHEAT-severity event
        String status          // "MULTI-IP FLAG" | "REVIEW" | "CLEAN"
) {}

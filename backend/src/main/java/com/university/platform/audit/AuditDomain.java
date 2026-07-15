package com.university.platform.audit;

public enum AuditDomain {
    CTF, EXAM, TP, CP,
    // Privileged admin actions (teacher approvals, CTF resource config,
    // instance force-stop, image prewarm, …). Written by AdminController /
    // CTFAdminController; visible only in the admin-only global feed.
    ADMIN
}

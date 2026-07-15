package com.university.platform.audit;

import com.university.platform.assessment.repository.AssessmentRepository;
import com.university.platform.competition.repository.CompetitionRepository;
import com.university.platform.ctf.repository.CTFCompetitionRepository;
import com.university.platform.identity.model.User;
import com.university.platform.identity.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Read side of the anti-cheat dashboard: per-user rollups for one event,
 * a per-user drill-down, an admin-wide feed, plus the prof-owns-event check.
 * Reads the existing audit_events + the multi-IP tracker; writes nothing.
 */
@Service
@RequiredArgsConstructor
public class AuditDashboardService {

    private final AuditEventRepository auditRepo;
    private final UserEventIpRepository ipRepo;
    private final UserRepository userRepo;
    private final AssessmentRepository assessmentRepo;
    private final CompetitionRepository competitionRepo;
    private final CTFCompetitionRepository ctfCompetitionRepo;

    private static final Set<String> COPY_TYPES =
            Set.of("COPY_ATTEMPT", "PASTE_ATTEMPT", "CUT_ATTEMPT", "COPY_PASTE");

    /** True if the caller may view this event's audit log (admin, or the event's owner). */
    @Transactional(readOnly = true)
    public boolean canView(AuditDomain domain, UUID contextId, UUID callerId, boolean isAdmin) {
        if (isAdmin) return true;
        return switch (domain) {
            case EXAM, TP -> assessmentRepo.findById(contextId)
                    .map(a -> a.getCreatedBy() != null && callerId.equals(a.getCreatedBy().getId()))
                    .orElse(false);
            case CP -> competitionRepo.findById(contextId)
                    .map(c -> callerId.equals(c.getCreatedBy())).orElse(false);
            case CTF -> ctfCompetitionRepo.findById(contextId)
                    .map(c -> callerId.equals(c.getCreatedBy())).orElse(false);
            // Admin-domain events are only ever viewable by admins, who already
            // returned true above; a non-admin can never view them.
            case ADMIN -> false;
        };
    }

    @Transactional(readOnly = true)
    public List<UserAuditSummaryDTO> getEventSummary(AuditDomain domain, UUID contextId) {
        List<AuditEvent> events = auditRepo.findByDomainAndContextIdOrderByCreatedAtDesc(domain, contextId);

        Map<UUID, UserEventIp> ipByUser = ipRepo.findByDomainAndContextId(domain, contextId).stream()
                .collect(Collectors.toMap(UserEventIp::getUserId, i -> i, (a, b) -> a));

        // All users that appear in either source.
        Set<UUID> userIds = new HashSet<>(ipByUser.keySet());
        events.forEach(e -> userIds.add(e.getActorUserId()));

        Map<UUID, String> names = resolveNames(userIds);

        List<UserAuditSummaryDTO> rows = new ArrayList<>();
        for (UUID uid : userIds) {
            List<AuditEvent> userEvents = events.stream()
                    .filter(e -> uid.equals(e.getActorUserId())).toList();

            int tabSwitches = (int) userEvents.stream().filter(e -> "TAB_SWITCH".equals(e.getEventType())).count();
            int focusLosses = (int) userEvents.stream().filter(e -> "WINDOW_BLUR".equals(e.getEventType()) || "FOCUS_LOSS".equals(e.getEventType())).count();
            int copyPastes  = (int) userEvents.stream().filter(e -> COPY_TYPES.contains(e.getEventType())).count();
            boolean anyCheat = userEvents.stream().anyMatch(e -> e.getSeverity() == Severity.CHEAT);

            UserEventIp ipRow = ipByUser.get(uid);
            List<String> ips = ipRow == null ? List.of() : Arrays.asList(ipRow.getDistinctIps());
            boolean multiIp = ipRow != null && ipRow.isMultiIp();

            boolean flagged = multiIp || anyCheat;
            String status = multiIp ? "MULTI-IP FLAG"
                    : (tabSwitches >= 3 || copyPastes >= 3 || anyCheat) ? "REVIEW"
                    : "CLEAN";

            rows.add(new UserAuditSummaryDTO(
                    uid, names.getOrDefault(uid, "Unknown"),
                    ips.size(), ips, multiIp,
                    tabSwitches, focusLosses, copyPastes,
                    userEvents.size(), flagged, status));
        }

        // Flagged first, then busiest.
        rows.sort(Comparator
                .comparing(UserAuditSummaryDTO::flagged).reversed()
                .thenComparing(Comparator.comparingInt(UserAuditSummaryDTO::totalEvents).reversed()));
        return rows;
    }

    @Transactional(readOnly = true)
    public List<AuditEventDTO> getUserLog(AuditDomain domain, UUID contextId, UUID userId) {
        return auditRepo.findByDomainAndContextIdAndActorUserIdOrderByCreatedAtDesc(domain, contextId, userId)
                .stream().map(AuditEventDTO::from).toList();
    }

    @Transactional(readOnly = true)
    public Page<AuditEventDTO> getGlobal(Pageable pageable, boolean flaggedOnly) {
        return auditRepo.findGlobal(flaggedOnly, pageable).map(AuditEventDTO::from);
    }

    private Map<UUID, String> resolveNames(Set<UUID> ids) {
        if (ids.isEmpty()) return Map.of();
        return userRepo.findAllById(ids).stream()
                .collect(Collectors.toMap(User::getId,
                        u -> (u.getFirstName() + " " + u.getLastName()).trim()));
    }
}

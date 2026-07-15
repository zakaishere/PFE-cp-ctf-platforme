package com.university.platform.ctf;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.university.platform.ctf.dto.CTFAdminChallengeDTO;
import com.university.platform.ctf.dto.CTFAdminInstanceDTO;
import com.university.platform.ctf.entity.CTFChallenge;
import com.university.platform.ctf.entity.CTFInstance;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the flag leak fix: the JSON actually serialized for
 * /api/ctf/admin/instances and /api/ctf/admin/challenges (i.e. the DTO lists the
 * controllers return) must never contain the plaintext flag or its hash — even
 * when the underlying entity has them populated.
 */
class CTFAdminFlagLeakTest {

    // findAndRegisterModules() picks up jackson-datatype-jsr310 from the
    // classpath, matching how Spring Boot's auto-configured ObjectMapper
    // serializes LocalDateTime in real responses.
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();

    @Test
    void instancesResponseNeverContainsFlagValue() throws Exception {
        CTFInstance inst = new CTFInstance();
        inst.setId(UUID.randomUUID());
        inst.setChallengeId(UUID.randomUUID());
        inst.setStatus("RUNNING");
        inst.setConnectionString("http://10.0.0.5:32771");
        inst.setFlagValue("FLAG{super_secret_live_flag_value}");

        // Serialize exactly what the controller returns: List<CTFAdminInstanceDTO>.
        String json = mapper.writeValueAsString(List.of(CTFAdminInstanceDTO.from(inst)));

        assertThat(json).doesNotContain("flagValue");
        assertThat(json).doesNotContain("super_secret_live_flag_value");
        // Sanity: the DTO did serialize real, non-sensitive fields.
        assertThat(json).contains("RUNNING");
    }

    @Test
    void challengesResponseNeverContainsFlagValueOrHash() throws Exception {
        CTFChallenge ch = new CTFChallenge();
        ch.setId(UUID.randomUUID());
        ch.setTitle("Baby RSA");
        ch.setBasePoints(500);
        ch.setFlagValue("FLAG{plaintext_flag}");
        ch.setFlagHash("deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef");

        String json = mapper.writeValueAsString(List.of(CTFAdminChallengeDTO.from(ch)));

        assertThat(json).doesNotContain("flagValue");
        assertThat(json).doesNotContain("flagHash");
        assertThat(json).doesNotContain("plaintext_flag");
        assertThat(json).doesNotContain("deadbeef");
        // Sanity: the DTO did serialize real, non-sensitive fields.
        assertThat(json).contains("Baby RSA");
    }
}

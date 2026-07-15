package com.university.platform.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.http.HttpMethod;

import java.util.Arrays;
import java.util.Collections;

import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.security.config.Customizer;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(Customizer.withDefaults())
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(AntPathRequestMatcher.antMatcher("/api/auth/**")).permitAll()
                // Worker-agent callbacks (ZIP download for image builds) — the agent has no
                // platform JWT; access is gated by network placement. TODO: shared-secret header.
                .requestMatchers(AntPathRequestMatcher.antMatcher("/api/internal/**")).permitAll()
                // Container healthchecks need an unauthenticated health probe;
                // everything else on actuator stays admin-only.
                .requestMatchers(AntPathRequestMatcher.antMatcher("/api/actuator/health")).permitAll()
                // Prometheus scrape target — metrics only, no business data. In prod
                // the backend port is not published to the host (see docker-compose.prod.yml),
                // so this is reachable only from the compose network. IP-restrict at the
                // proxy if 8080 is ever exposed publicly.
                .requestMatchers(AntPathRequestMatcher.antMatcher("/api/actuator/prometheus")).permitAll()
                .requestMatchers(AntPathRequestMatcher.antMatcher("/api/actuator/**")).hasRole("ADMIN")
                .requestMatchers(AntPathRequestMatcher.antMatcher("/api/academic/**")).permitAll()
                .requestMatchers(AntPathRequestMatcher.antMatcher("/api/submissions/**")).permitAll()
                .requestMatchers(AntPathRequestMatcher.antMatcher("/error")).permitAll()
                // SockJS handshake (GET /ws-endpoint/info) must be unauthenticated; JWT auth happens at STOMP level
                .requestMatchers(AntPathRequestMatcher.antMatcher("/ws-endpoint/**")).permitAll()
                .requestMatchers(AntPathRequestMatcher.antMatcher("/ws/**")).permitAll()
                // Students can browse, view, and run problems; only teachers/admins can create/modify
                .requestMatchers(AntPathRequestMatcher.antMatcher(HttpMethod.GET, "/api/problems")).authenticated()
                .requestMatchers(AntPathRequestMatcher.antMatcher(HttpMethod.GET, "/api/problems/*")).authenticated()
                .requestMatchers(AntPathRequestMatcher.antMatcher(HttpMethod.GET, "/api/problems/*/my-submissions")).authenticated()
                .requestMatchers(AntPathRequestMatcher.antMatcher(HttpMethod.POST, "/api/problems/*/run")).authenticated()
                .requestMatchers(AntPathRequestMatcher.antMatcher("/api/problems/**")).hasAnyRole("TEACHER", "ADMIN")
                // Audit dashboards — reads restricted to staff; the global feed is admin-only.
                // Session heartbeat + cheat-log ingest stay authenticated (students post their own).
                .requestMatchers(AntPathRequestMatcher.antMatcher("/api/audit/session/**")).authenticated()
                .requestMatchers(AntPathRequestMatcher.antMatcher("/api/admin/audit/**")).hasRole("ADMIN")
                // All admin endpoints (stats, health, teacher approvals, users list,
                // dashboard) are privileged. Previously only /api/admin/audit/** was
                // gated and the rest fell through to authenticated() — reachable by any
                // logged-in user. Lock the whole namespace to ADMIN.
                .requestMatchers(AntPathRequestMatcher.antMatcher("/api/admin/**")).hasRole("ADMIN")
                .requestMatchers(AntPathRequestMatcher.antMatcher("/api/teacher/*/*/audit/**")).hasAnyRole("TEACHER", "ADMIN")
                .requestMatchers(AntPathRequestMatcher.antMatcher("/api/teacher/*/*/audit")).hasAnyRole("TEACHER", "ADMIN")
                // CTF teacher management
                .requestMatchers(AntPathRequestMatcher.antMatcher("/api/teacher/ctf/**")).hasAnyRole("TEACHER", "ADMIN")
                // CTF endpoints — challenge browsing & submissions open to all authenticated users;
                // writes on the legacy CTFChallengeController (create/update/toggle/delete an individual
                // challenge) are restricted to TEACHER/ADMIN. Sub-resources (submit, hints/unlock,
                // instance/start, instance/renew) remain open to authenticated users.
                .requestMatchers(AntPathRequestMatcher.antMatcher(HttpMethod.GET, "/api/ctf/challenges")).authenticated()
                .requestMatchers(AntPathRequestMatcher.antMatcher(HttpMethod.GET, "/api/ctf/challenges/*")).authenticated()
                .requestMatchers(AntPathRequestMatcher.antMatcher(HttpMethod.POST,   "/api/ctf/challenges")).hasAnyRole("TEACHER", "ADMIN")
                .requestMatchers(AntPathRequestMatcher.antMatcher(HttpMethod.PUT,    "/api/ctf/challenges/*")).hasAnyRole("TEACHER", "ADMIN")
                .requestMatchers(AntPathRequestMatcher.antMatcher(HttpMethod.PATCH,  "/api/ctf/challenges/*/toggle-active")).hasAnyRole("TEACHER", "ADMIN")
                .requestMatchers(AntPathRequestMatcher.antMatcher(HttpMethod.DELETE, "/api/ctf/challenges/*")).hasAnyRole("TEACHER", "ADMIN")
                .requestMatchers(AntPathRequestMatcher.antMatcher("/api/ctf/admin/**")).hasAnyRole("TEACHER", "ADMIN")
                // Lightweight public status endpoint — used by the lobby entry page
                // so unauthenticated users can see whether a competition is upcoming/live.
                .requestMatchers(AntPathRequestMatcher.antMatcher(HttpMethod.GET, "/api/ctf/competitions/*/status")).permitAll()
                // Cover images served publicly (no auth required to display card images)
                .requestMatchers(AntPathRequestMatcher.antMatcher(HttpMethod.GET, "/api/ctf/competitions/covers/**")).permitAll()
                // CTF competition & team endpoints — all authenticated
                .requestMatchers(AntPathRequestMatcher.antMatcher("/api/ctf/competitions/**")).authenticated()
                .requestMatchers(AntPathRequestMatcher.antMatcher("/api/ctf/**")).authenticated()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public org.springframework.security.authentication.dao.DaoAuthenticationProvider authenticationProvider(
            org.springframework.security.core.userdetails.UserDetailsService userDetailsService,
            org.springframework.security.crypto.password.PasswordEncoder passwordEncoder) {
        org.springframework.security.authentication.dao.DaoAuthenticationProvider authProvider = new org.springframework.security.authentication.dao.DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder);
        return authProvider;
    }

    @Bean
    public org.springframework.security.authentication.AuthenticationManager authenticationManager(org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        
        configuration.setAllowedOriginPatterns(Arrays.asList("http://localhost:*"));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "Accept", "Origin"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}

package com.university.platform.config;

import com.university.platform.academic.model.Division;
import com.university.platform.academic.model.Module;
import com.university.platform.academic.model.Semester;
import com.university.platform.academic.repository.DivisionRepository;
import com.university.platform.academic.repository.ModuleRepository;
import com.university.platform.academic.repository.SemesterRepository;
import com.university.platform.identity.model.Department;
import com.university.platform.identity.repository.DepartmentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.util.List;
import java.util.Map;

@Slf4j
@Configuration
@Profile({"dev", "seed", "academic-seed"})
@RequiredArgsConstructor
public class AcademicSeeder {

    private final SemesterRepository  semesterRepository;
    private final DepartmentRepository departmentRepository;
    private final DivisionRepository   divisionRepository;
    private final ModuleRepository     moduleRepository;

    @Bean
    public CommandLineRunner seedAcademicData() {
        return args -> {
            if (semesterRepository.count() > 0) {
                log.info("[ACADEMIC SEEDER] Data already seeded, skipping.");
                return;
            }

            log.info("[ACADEMIC SEEDER] Seeding FS Tetouan academic structure...");

            // ── 1. Semesters ──────────────────────────────────────────────────────────
            Semester s1 = save(Semester.builder().name("S1").build());
            Semester s2 = save(Semester.builder().name("S2").build());
            Semester s3 = save(Semester.builder().name("S3").build());
            Semester s4 = save(Semester.builder().name("S4").build());
            Semester s5 = save(Semester.builder().name("S5").build());
            Semester s6 = save(Semester.builder().name("S6").build());
            Semester m1 = save(Semester.builder().name("M1").build());
            Semester m2 = save(Semester.builder().name("M2").build());
            Semester m3 = save(Semester.builder().name("M3").build());
            Semester m4 = save(Semester.builder().name("M4").build());

            log.info("[ACADEMIC SEEDER] Seeded 10 semesters.");

            // ── 2. Departments ────────────────────────────────────────────────────────
            Department biology        = saveDept("Biology");
            Department chemistry      = saveDept("Chemistry");
            Department physics        = saveDept("Physics");
            Department mathematics    = saveDept("Mathematics");
            Department computerScience = saveDept("Computer Science");
            Department geology        = saveDept("Geology");

            log.info("[ACADEMIC SEEDER] Seeded 6 departments.");

            // ── 3. Filieres (Divisions) ───────────────────────────────────────────────

            // Biology
            Division svi  = saveDiv("Sciences de la Vie (SVI)",                "Licence", biology);
            Division bio1 = saveDiv("Biotechnology, Food and Health",           "Master",  biology);
            Division bio2 = saveDiv("Ecology and Biodiversity Management",      "Master",  biology);

            // Chemistry
            Division smc  = saveDiv("Sciences de la Matière Chimique (SMC)",   "Licence", chemistry);
            Division chem1 = saveDiv("Applied Chemistry",                       "Master",  chemistry);

            // Physics
            Division smp  = saveDiv("Sciences de la Matière Physique (SMP)",   "Licence", physics);
            Division phy1 = saveDiv("Mechatronics",                             "Master",  physics);
            Division phy2 = saveDiv("Electronics and Telecommunications",       "Master",  physics);

            // Mathematics
            Division sma  = saveDiv("Sciences Mathématiques et Applications (SMA)", "Licence", mathematics);
            Division math1 = saveDiv("Applied Mathematics to Finance",               "Master",  mathematics);

            // Computer Science
            Division smi  = saveDiv("Sciences Mathématiques et Informatique (SMI)", "Licence", computerScience);
            Division cs1  = saveDiv("Software Quality",                              "Master",  computerScience);
            Division cs2  = saveDiv("Computer Engineering",                          "Master",  computerScience);

            // Geology
            Division stu  = saveDiv("Sciences de la Terre et de l'Univers (STU)",   "Licence", geology);
            Division geo1 = saveDiv("Environmental Geosciences",                      "Master",  geology);

            log.info("[ACADEMIC SEEDER] Seeded 14 filieres (divisions).");

            // ── 4. SMI Modules (S1–S4) ────────────────────────────────────────────────

            List<String> smiS1 = List.of(
                "Analyse 1",
                "Algèbre 1",
                "Algorithmique et Programmation 1",
                "Mécanique du point",
                "Thermodynamique",
                "Langues et Terminologie 1",
                "Soft Skills: Power Skills 1"
            );

            List<String> smiS2 = List.of(
                "Analyse 2",
                "Algèbre 2",
                "Algorithmique et Programmation 2",
                "Électricité",
                "Structure machine",
                "Langues et Terminologie 2"
            );

            List<String> smiS3 = List.of(
                "Programmation C",
                "Architecture des ordinateurs",
                "Systèmes d'exploitation",
                "Probabilités et Statistiques",
                "Algorithmique 3 et Structures de Données",
                "Technologie du Web"
            );

            List<String> smiS4 = List.of(
                "Programmation Orientée Objet (C++/Java)",
                "Bases de données relationnelles",
                "Réseaux informatiques",
                "Recherche Opérationnelle",
                "Analyse Numérique",
                "Développement Web Avancé"
            );

            Map<Semester, List<String>> smiModules = Map.of(
                s1, smiS1,
                s2, smiS2,
                s3, smiS3,
                s4, smiS4
            );

            int moduleCount = 0;
            for (Map.Entry<Semester, List<String>> entry : smiModules.entrySet()) {
                for (String moduleName : entry.getValue()) {
                    moduleRepository.save(Module.builder()
                            .name(moduleName)
                            .division(smi)
                            .semester(entry.getKey())
                            .build());
                    moduleCount++;
                }
            }

            log.info("[ACADEMIC SEEDER] Seeded {} SMI modules across S1-S4.", moduleCount);
            log.info("[ACADEMIC SEEDER] Academic seeding complete.");
        };
    }

    private Semester save(Semester s) {
        return semesterRepository.save(s);
    }

    private Department saveDept(String name) {
        return departmentRepository.save(Department.builder().name(name).build());
    }

    private Division saveDiv(String name, String type, Department dept) {
        return divisionRepository.save(Division.builder()
                .name(name)
                .type(type)
                .department(dept)
                .build());
    }
}

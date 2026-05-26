package com.university.platform.ctf.service;

import com.university.platform.ctf.entity.CTFChallenge;
import com.university.platform.ctf.entity.CTFCompetition;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Single source of truth for all CTF score computations.
 *
 * challengeValue(comp, challenge, totalSolveCount) is the canonical way to ask
 * "what is this challenge worth right now?"  All call sites — scoreboard, challenge
 * list, team profile, navbar — must call this and nothing else.
 *
 * Key invariant: the FIRST solve never lowers the displayed value.  Decay begins
 * when a SECOND team solves the challenge (effectiveSolves = max(0, n - 1)).
 * This is achieved by normalising the count to Math.max(1, n) before calling
 * CTFScoringService, which internally subtracts 1 to get n-1.
 */
@Service
public class CTFScoringEngine {

    private final CTFScoringService scoringService;

    public CTFScoringEngine(CTFScoringService scoringService) {
        this.scoringService = scoringService;
    }

    /**
     * Current point value of a challenge after {@code totalSolveCount} teams have
     * solved it.  Safe to call with 0 (returns initial value).
     */
    public int challengeValue(CTFCompetition comp, CTFChallenge challenge, int totalSolveCount) {
        CTFCompetition.ScoringFunction fn = comp.getScoringFunction();
        if (fn == null) fn = CTFCompetition.ScoringFunction.LOGARITHMIC;

        int initial = challenge.getInitialValue() != null
                ? challenge.getInitialValue() : challenge.getBasePoints();
        int minimum = challenge.getMinimumValue() != null
                ? challenge.getMinimumValue()
                : (comp.getDynamicMinPoints() != null ? comp.getDynamicMinPoints() : 50);
        int decay   = challenge.getDecayValue()   != null ? challenge.getDecayValue() : 10;

        // n=1 → CTFScoringService uses (n-1)=0 → returns initial.
        // n=2 → (n-1)=1 → decay starts.  This is the "2nd solve triggers decay" rule.
        int n = Math.max(1, totalSolveCount);

        return switch (fn) {
            case STATIC      -> initial;
            case LINEAR      -> scoringService.calculateLinear(initial, minimum, decay, n);
            case LOGARITHMIC -> scoringService.calculateLogarithmic(initial, minimum, decay, n);
        };
    }

    /**
     * Bulk: returns a challengeId → currentValue map.
     * {@code solveCounts} maps challengeId → number of teams that solved it.
     * Missing entries are treated as 0 solves (returns initial value for each).
     */
    public Map<UUID, Integer> challengeValues(CTFCompetition comp,
                                               List<CTFChallenge> challenges,
                                               Map<UUID, Integer> solveCounts) {
        Map<UUID, Integer> values = new HashMap<>(challenges.size());
        for (CTFChallenge ch : challenges) {
            values.put(ch.getId(), challengeValue(comp, ch, solveCounts.getOrDefault(ch.getId(), 0)));
        }
        return values;
    }
}

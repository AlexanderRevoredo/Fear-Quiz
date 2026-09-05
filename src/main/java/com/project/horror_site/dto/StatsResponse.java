package com.project.horror_site.dto;

import java.util.Map;

public record StatsResponse(
        long totalPlayers,
        double averageScore,
        int averageDurationSeconds,
        Map<String, Long> tierCounts,
        Map<String, Double> tierPercentages,
        Map<String, Long> fearCounts
) {
}

package com.project.horror_site.dto;

public record RankingEntry(
        int position,
        String playerName,
        int score,
        String tier,
        int durationSeconds
) {
}

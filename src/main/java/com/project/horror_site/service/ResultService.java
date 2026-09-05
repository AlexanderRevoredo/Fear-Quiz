package com.project.horror_site.service;

import com.project.horror_site.dto.RankingEntry;
import com.project.horror_site.dto.RankingResponse;
import com.project.horror_site.dto.ResultRequest;
import com.project.horror_site.dto.ResultResponse;
import com.project.horror_site.dto.StatsResponse;
import com.project.horror_site.model.Result;
import com.project.horror_site.repository.ResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ResultService {

    private static final int MAX_ANSWERS = 40;

    private final ResultRepository repository;

    @Transactional
    public ResultResponse save(ResultRequest request) {
        Result result = new Result();
        result.setPlayerName(blankToNull(request.playerName()));
        result.setScore(request.score());
        result.setTier(request.tier());
        result.setFear(blankToNull(request.fear()));
        result.setDurationSeconds(request.durationSeconds());
        result.setEventsFired(request.eventsFired());
        result.setReachedEnd(request.reachedEnd());
        result.setAnswers(sanitizeAnswers(request.answers()));

        Result saved = repository.save(result);

        long total = repository.count();
        long worse = repository.countByScoreLessThan(saved.getScore());
        int percent = total <= 1 ? 0 : (int) Math.round(worse * 100.0 / total);
        long position = repository.countRankedAbove(saved.getScore(), saved.getDurationSeconds()) + 1;

        return new ResultResponse(
                saved.getId(), saved.getScore(), saved.getTier(), total, position, percent);
    }

    @Transactional(readOnly = true)
    public StatsResponse stats() {
        long total = repository.count();

        Map<String, Long> tierCounts = toMap(repository.countByTier());
        Map<String, Double> tierPercentages = new LinkedHashMap<>();
        tierCounts.forEach((tier, count) ->
                tierPercentages.put(tier, total == 0 ? 0 : round1(count * 100.0 / total)));

        int averageDuration = (int) Math.round(
                repository.findAll().stream().mapToInt(Result::getDurationSeconds).average().orElse(0));

        return new StatsResponse(
                total,
                round1(repository.averageScore()),
                averageDuration,
                tierCounts,
                tierPercentages,
                toMap(repository.countByFear())
        );
    }

    @Transactional(readOnly = true)
    public RankingResponse ranking() {
        return new RankingResponse(
                toEntries(repository.findTop10ByOrderByScoreDescDurationSecondsAsc()),
                toEntries(repository.findTop10ByOrderByScoreAscDurationSecondsAsc())
        );
    }

    private static List<RankingEntry> toEntries(List<Result> results) {
        List<RankingEntry> entries = new ArrayList<>(results.size());
        for (int i = 0; i < results.size(); i++) {
            Result r = results.get(i);
            String name = r.getPlayerName() == null ? "anônimo" : r.getPlayerName();
            entries.add(new RankingEntry(i + 1, name, r.getScore(), r.getTier(), r.getDurationSeconds()));
        }
        return entries;
    }

    /** O mapa vem do cliente, então limita quantidade e tamanho antes de persistir. */
    private Map<String, String> sanitizeAnswers(Map<String, String> answers) {
        Map<String, String> clean = new HashMap<>();
        if (answers == null) {
            return clean;
        }
        answers.entrySet().stream()
                .filter(e -> e.getKey() != null && e.getValue() != null)
                .limit(MAX_ANSWERS)
                .forEach(e -> clean.put(truncate(e.getKey(), 40), truncate(e.getValue(), 60)));
        return clean;
    }

    private static Map<String, Long> toMap(List<ResultRepository.CountByKey> rows) {
        Map<String, Long> map = new LinkedHashMap<>();
        rows.forEach(row -> map.put(row.getKey(), row.getTotal()));
        return map;
    }

    private static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}

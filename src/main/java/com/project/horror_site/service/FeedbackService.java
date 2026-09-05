package com.project.horror_site.service;

import com.project.horror_site.dto.FeedbackRequest;
import com.project.horror_site.dto.FeedbackSummary;
import com.project.horror_site.model.Feedback;
import com.project.horror_site.repository.FeedbackRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FeedbackService {

    private final FeedbackRepository repository;

    @Transactional
    public FeedbackSummary save(FeedbackRequest request) {
        Feedback feedback = new Feedback();
        feedback.setPlayerName(blankToNull(request.playerName()));
        feedback.setRating(request.rating());
        feedback.setMessage(blankToNull(request.message()));
        feedback.setResultId(request.resultId());
        repository.save(feedback);

        return summary();
    }

    @Transactional(readOnly = true)
    public FeedbackSummary summary() {
        return new FeedbackSummary(
                repository.count(),
                Math.round(repository.averageRating() * 10.0) / 10.0
        );
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}

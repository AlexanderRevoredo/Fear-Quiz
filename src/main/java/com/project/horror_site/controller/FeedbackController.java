package com.project.horror_site.controller;

import com.project.horror_site.dto.FeedbackRequest;
import com.project.horror_site.dto.FeedbackSummary;
import com.project.horror_site.service.FeedbackService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/feedback")
@RequiredArgsConstructor
public class FeedbackController {

    private final FeedbackService service;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FeedbackSummary create(@Valid @RequestBody FeedbackRequest request) {
        return service.save(request);
    }

    @GetMapping("/summary")
    public FeedbackSummary summary() {
        return service.summary();
    }
}

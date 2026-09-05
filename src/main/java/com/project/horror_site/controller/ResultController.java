package com.project.horror_site.controller;

import com.project.horror_site.dto.RankingResponse;
import com.project.horror_site.dto.ResultRequest;
import com.project.horror_site.dto.ResultResponse;
import com.project.horror_site.dto.StatsResponse;
import com.project.horror_site.service.ResultService;
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
@RequestMapping("/api/results")
@RequiredArgsConstructor
public class ResultController {

    private final ResultService service;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ResultResponse create(@Valid @RequestBody ResultRequest request) {
        return service.save(request);
    }

    @GetMapping("/stats")
    public StatsResponse stats() {
        return service.stats();
    }

    @GetMapping("/ranking")
    public RankingResponse ranking() {
        return service.ranking();
    }
}

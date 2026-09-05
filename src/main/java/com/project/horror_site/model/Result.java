package com.project.horror_site.model;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapKeyColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Uma partida concluída do Fear Quiz.
 */
@Entity
@Table(name = "results")
@Getter
@Setter
@NoArgsConstructor
public class Result {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Pode ser nulo: a pessoa não é obrigada a dizer o nome. */
    @Column(name = "player_name", length = 24)
    private String playerName;

    @Column(nullable = false)
    private int score;

    @Column(nullable = false, length = 20)
    private String tier;

    /** Resposta da primeira pergunta, guardada à parte por ser a mais consultada. */
    @Column(length = 32)
    private String fear;

    @Column(name = "duration_seconds", nullable = false)
    private int durationSeconds;

    @Column(name = "events_fired", nullable = false)
    private int eventsFired;

    @Column(name = "reached_end", nullable = false)
    private boolean reachedEnd;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "result_answers", joinColumns = @JoinColumn(name = "result_id"))
    @MapKeyColumn(name = "question_id", length = 40)
    @Column(name = "answer_value", length = 60)
    private Map<String, String> answers = new HashMap<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}

package com.project.horror_site.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Avaliação deixada ao fim de uma partida.
 */
@Entity
@Table(name = "feedback")
@Getter
@Setter
@NoArgsConstructor
public class Feedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Vem do nome dado no quiz; nulo se a pessoa preferiu não dizer. */
    @Column(name = "player_name", length = 24)
    private String playerName;

    /** 1 a 5 estrelas. */
    @Column(nullable = false)
    private int rating;

    /** "message" e nao "comment": COMMENT e palavra reservada no H2. */
    @Column(name = "message", length = 500)
    private String message;

    /** Liga a avaliação à partida, para dar contexto ao comentário. */
    @Column(name = "result_id")
    private Long resultId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}

package com.project.horror_site.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

/**
 * Avaliação enviada ao fim da partida. O endpoint é público, então os limites
 * abaixo existem para impedir envio de texto gigante ou nota fora da escala.
 */
public record FeedbackRequest(

        @Size(max = 24, message = "nome muito longo")
        String playerName,

        @Min(value = 1, message = "a nota vai de 1 a 5")
        @Max(value = 5, message = "a nota vai de 1 a 5")
        int rating,

        @Size(max = 500, message = "comentário muito longo")
        String message,

        Long resultId
) {
}

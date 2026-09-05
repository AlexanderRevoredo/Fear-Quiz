package com.project.horror_site.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Map;

/**
 * Partida enviada pelo navegador.
 *
 * <p>O endpoint é público e a pontuação é calculada no cliente, então os
 * limites abaixo não impedem trapaça — apenas evitam que alguém envie valores
 * absurdos e destrua o ranking e as médias.
 */
public record ResultRequest(

        @Size(max = 24, message = "nome muito longo")
        String playerName,

        @Min(value = 0, message = "pontuação inválida")
        @Max(value = 200, message = "pontuação inválida")
        int score,

        @NotBlank(message = "faixa obrigatória")
        @Size(max = 20)
        String tier,

        @Size(max = 32)
        String fear,

        @Min(0)
        @Max(value = 86_400, message = "duração inválida")
        int durationSeconds,

        @Min(0)
        @Max(50)
        int eventsFired,

        boolean reachedEnd,

        Map<String, String> answers
) {
}

package com.project.horror_site.dto;

/**
 * Só o agregado. Os comentários não são expostos publicamente: qualquer um
 * pode enviar texto para a API, e exibir isso na tela viraria alvo de abuso.
 */
public record FeedbackSummary(
        long total,
        double averageRating
) {
}

package com.project.horror_site.dto;

/**
 * Devolvido logo após salvar. O `betterThanPercent` existe para a tela final
 * poder dizer algo como "você pontuou mais que 72% das pessoas".
 */
public record ResultResponse(
        Long id,
        int score,
        String tier,
        long totalPlayers,
        /** Posição no ranking de medo: 1 é a partida mais assustada de todas. */
        long position,
        /** Percentual de partidas que se assustaram menos que esta. */
        int betterThanPercent
) {
}

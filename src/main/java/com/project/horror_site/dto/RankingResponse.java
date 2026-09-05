package com.project.horror_site.dto;

import java.util.List;

/**
 * A pontuação mede medo numa direção só, então o ranking tem duas pontas: os
 * mais assustados no topo da escala e os mais corajosos na base dela.
 */
public record RankingResponse(
        List<RankingEntry> maisMedrosos,
        List<RankingEntry> maisCorajosos
) {
}

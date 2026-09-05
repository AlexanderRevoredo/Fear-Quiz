package com.project.horror_site.repository;

import com.project.horror_site.model.Result;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ResultRepository extends JpaRepository<Result, Long> {

    /** Linha de contagem agrupada — o alias casa com o getter da projeção. */
    interface CountByKey {
        String getKey();

        long getTotal();
    }

    @Query("select r.tier as key, count(r) as total from Result r group by r.tier")
    List<CountByKey> countByTier();

    @Query("select r.fear as key, count(r) as total from Result r where r.fear is not null group by r.fear")
    List<CountByKey> countByFear();

    @Query("select coalesce(avg(r.score), 0) from Result r")
    double averageScore();

    long countByScoreLessThan(int score);

    /**
     * Quantas partidas ficam à frente desta no ranking de medo. Somando 1 dá a
     * posição, sem precisar carregar a tabela inteira.
     */
    @Query("""
            select count(r) from Result r
            where r.score > :score
               or (r.score = :score and r.durationSeconds < :durationSeconds)
            """)
    long countRankedAbove(@Param("score") int score, @Param("durationSeconds") int durationSeconds);

    /** Mais medrosos: maior pontuação primeiro; empate vai para quem terminou antes. */
    List<Result> findTop10ByOrderByScoreDescDurationSecondsAsc();

    /** Mais corajosos: a outra ponta da mesma escala. */
    List<Result> findTop10ByOrderByScoreAscDurationSecondsAsc();
}

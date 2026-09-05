package com.project.horror_site.repository;

import com.project.horror_site.model.Result;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Exercita as consultas customizadas. Compilar nao garante JPQL valido, e essas
 * consultas so quebrariam quando alguem abrisse a tela de estatisticas.
 */
@DataJpaTest
class ResultRepositoryTest {

    @Autowired
    private ResultRepository repository;

    private Result result(String name, int score, String tier, String fear, int duration) {
        Result r = new Result();
        r.setPlayerName(name);
        r.setScore(score);
        r.setTier(tier);
        r.setFear(fear);
        r.setDurationSeconds(duration);
        r.setEventsFired(2);
        r.setReachedEnd(true);
        r.setAnswers(Map.of("fear", fear, "alone", "sim"));
        return r;
    }

    @Test
    void agrupaPorFaixaEPorMedo() {
        repository.saveAll(List.of(
                result("Ana", 55, "intenso", "observado", 300),
                result("Bia", 30, "intermediario", "observado", 280),
                result("Caio", 12, "leve", "aranhas", 200)
        ));

        Map<String, Long> porFaixa = repository.countByTier().stream()
                .collect(java.util.stream.Collectors.toMap(
                        ResultRepository.CountByKey::getKey, ResultRepository.CountByKey::getTotal));
        assertThat(porFaixa)
                .containsEntry("intenso", 1L)
                .containsEntry("intermediario", 1L)
                .containsEntry("leve", 1L);

        Map<String, Long> porMedo = repository.countByFear().stream()
                .collect(java.util.stream.Collectors.toMap(
                        ResultRepository.CountByKey::getKey, ResultRepository.CountByKey::getTotal));
        assertThat(porMedo).containsEntry("observado", 2L).containsEntry("aranhas", 1L);
    }

    @Test
    void calculaMediaEContagemAbaixoDaPontuacao() {
        repository.saveAll(List.of(
                result("Ana", 60, "intenso", "morte", 300),
                result("Bia", 20, "leve", "altura", 240)
        ));

        assertThat(repository.averageScore()).isEqualTo(40.0);
        assertThat(repository.countByScoreLessThan(60)).isEqualTo(1);
        assertThat(repository.countByScoreLessThan(10)).isZero();
    }

    @Test
    void mediaEhZeroSemPartidas() {
        assertThat(repository.averageScore()).isZero();
    }

    @Test
    void rankingOrdenaPorPontuacaoEDesempataPeloTempo() {
        repository.saveAll(List.of(
                result("Lento", 50, "intenso", "escuro", 900),
                result("Rapido", 50, "intenso", "escuro", 120),
                result("Baixo", 10, "leve", "cobras", 100)
        ));

        List<Result> ranking = repository.findTop10ByOrderByScoreDescDurationSecondsAsc();

        assertThat(ranking).extracting(Result::getPlayerName)
                .containsExactly("Rapido", "Lento", "Baixo");
    }

    @Test
    void guardaAsRespostasDaPartida() {
        Result salvo = repository.saveAndFlush(result("Ana", 40, "intermediario", "palhacos", 250));
        assertThat(repository.findById(salvo.getId()))
                .get()
                .satisfies(r -> {
                    assertThat(r.getAnswers()).containsEntry("alone", "sim");
                    assertThat(r.getCreatedAt()).isNotNull();
                });
    }
}

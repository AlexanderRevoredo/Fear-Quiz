package com.project.horror_site.controller;

import com.project.horror_site.repository.ResultRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ResultControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ResultRepository repository;

    @BeforeEach
    void limpa() {
        repository.deleteAll();
    }

    private String partida(String nome, int score, String tier, String medo) {
        return """
                {
                  "playerName": "%s",
                  "score": %d,
                  "tier": "%s",
                  "fear": "%s",
                  "durationSeconds": 240,
                  "eventsFired": 3,
                  "reachedEnd": true,
                  "answers": { "fear": "%s", "alone": "sim" }
                }
                """.formatted(nome, score, tier, medo, medo);
    }

    @Test
    void salvaPartidaEDevolveFaixa() throws Exception {
        mockMvc.perform(post("/api/results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(partida("Ana", 55, "intenso", "observado")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.score").value(55))
                .andExpect(jsonPath("$.tier").value("intenso"))
                .andExpect(jsonPath("$.totalPlayers").value(1));
    }

    @Test
    void rejeitaPontuacaoForaDosLimites() throws Exception {
        mockMvc.perform(post("/api/results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(partida("Trapaceiro", 99999, "intenso", "morte")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.score").exists());
    }

    @Test
    void rejeitaFaixaVazia() throws Exception {
        mockMvc.perform(post("/api/results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(partida("Ana", 20, "", "escuro")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void estatisticasAgregamAsPartidas() throws Exception {
        mockMvc.perform(post("/api/results").contentType(MediaType.APPLICATION_JSON)
                .content(partida("Ana", 60, "intenso", "observado")));
        mockMvc.perform(post("/api/results").contentType(MediaType.APPLICATION_JSON)
                .content(partida("Bia", 20, "leve", "observado")));

        mockMvc.perform(get("/api/results/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalPlayers").value(2))
                .andExpect(jsonPath("$.averageScore").value(40.0))
                .andExpect(jsonPath("$.tierCounts.intenso").value(1))
                .andExpect(jsonPath("$.fearCounts.observado").value(2));
    }

    @Test
    void rankingVemOrdenado() throws Exception {
        mockMvc.perform(post("/api/results").contentType(MediaType.APPLICATION_JSON)
                .content(partida("Baixo", 10, "leve", "cobras")));
        mockMvc.perform(post("/api/results").contentType(MediaType.APPLICATION_JSON)
                .content(partida("Alto", 70, "intenso", "morte")));

        mockMvc.perform(get("/api/results/ranking"))
                .andExpect(status().isOk())
                // maior pontuacao = mais assustado
                .andExpect(jsonPath("$.maisMedrosos[0].playerName").value("Alto"))
                .andExpect(jsonPath("$.maisMedrosos[1].playerName").value("Baixo"))
                // e a outra ponta da mesma escala
                .andExpect(jsonPath("$.maisCorajosos[0].playerName").value("Baixo"))
                .andExpect(jsonPath("$.maisCorajosos[1].playerName").value("Alto"));
    }

    @Test
    void posicaoNoRankingDeMedo() throws Exception {
        mockMvc.perform(post("/api/results").contentType(MediaType.APPLICATION_JSON)
                .content(partida("Medroso", 70, "intenso", "morte")));

        // pontuacao menor entra atras no ranking de medo
        mockMvc.perform(post("/api/results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(partida("Corajoso", 15, "leve", "aranhas")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.position").value(2))
                .andExpect(jsonPath("$.betterThanPercent").value(0));
    }
}

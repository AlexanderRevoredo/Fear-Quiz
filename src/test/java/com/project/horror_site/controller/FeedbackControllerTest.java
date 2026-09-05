package com.project.horror_site.controller;

import com.project.horror_site.repository.FeedbackRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class FeedbackControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FeedbackRepository repository;

    @BeforeEach
    void limpa() {
        repository.deleteAll();
    }

    private String avaliacao(String nome, int nota, String texto) {
        return """
                { "playerName": %s, "rating": %d, "message": %s, "resultId": null }
                """.formatted(
                nome == null ? "null" : "\"" + nome + "\"",
                nota,
                texto == null ? "null" : "\"" + texto + "\"");
    }

    @Test
    void salvaAvaliacaoComNomeEComentario() throws Exception {
        mockMvc.perform(post("/api/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(avaliacao("Ana", 5, "assustou de verdade")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.averageRating").value(5.0));

        assertThat(repository.findTop50ByOrderByCreatedAtDesc())
                .singleElement()
                .satisfies(f -> {
                    assertThat(f.getPlayerName()).isEqualTo("Ana");
                    assertThat(f.getMessage()).isEqualTo("assustou de verdade");
                    assertThat(f.getCreatedAt()).isNotNull();
                });
    }

    @Test
    void comentarioEhOpcional() throws Exception {
        mockMvc.perform(post("/api/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(avaliacao(null, 3, null)))
                .andExpect(status().isCreated());

        assertThat(repository.findTop50ByOrderByCreatedAtDesc())
                .singleElement()
                .satisfies(f -> {
                    assertThat(f.getMessage()).isNull();
                    assertThat(f.getPlayerName()).isNull();
                });
    }

    @Test
    void rejeitaNotaForaDaEscala() throws Exception {
        mockMvc.perform(post("/api/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(avaliacao("Ana", 9, null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.rating").exists());

        mockMvc.perform(post("/api/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(avaliacao("Ana", 0, null)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejeitaComentarioGigante() throws Exception {
        mockMvc.perform(post("/api/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(avaliacao("Ana", 4, "x".repeat(501))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.message").exists());
    }

    @Test
    void resumoTrazMediaEContagem() throws Exception {
        mockMvc.perform(post("/api/feedback").contentType(MediaType.APPLICATION_JSON)
                .content(avaliacao("Ana", 5, null)));
        mockMvc.perform(post("/api/feedback").contentType(MediaType.APPLICATION_JSON)
                .content(avaliacao("Bia", 2, null)));

        mockMvc.perform(get("/api/feedback/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.averageRating").value(3.5));
    }

    @Test
    void resumoVazioNaoQuebra() throws Exception {
        mockMvc.perform(get("/api/feedback/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0))
                .andExpect(jsonPath("$.averageRating").value(0.0));
    }
}

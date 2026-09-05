package com.project.horror_site;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifica o que os testes de unidade não cobrem: que a mesma aplicação serve o
 * front-end de resources/static e a API. É isso que garante que o quiz e o
 * POST /api/results ficam na mesma origem, sem precisar de CORS.
 */
@SpringBootTest
@AutoConfigureMockMvc
class FearQuizIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void aRaizLevaAoQuiz() throws Exception {
        /* O Boot trata a raiz encaminhando para a welcome page, então aqui se
           verifica o encaminhamento; o conteúdo é conferido no teste abaixo. */
        mockMvc.perform(get("/"))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("index.html"));
    }

    @Test
    void aPaginaDoQuizTemOFrontEndCompleto() throws Exception {
        mockMvc.perform(get("/index.html"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("FEAR QUIZ")))
                .andExpect(content().string(containsString("js/quiz.js")))
                .andExpect(content().string(containsString("css/style.css")));
    }

    @Test
    void serveOsArquivosDoFrontEnd() throws Exception {
        for (String arquivo : new String[]{
                "/js/quiz.js", "/js/audio.js", "/js/questions.js", "/js/effects.js",
                "/js/prologue.js", "/js/secrets.js", "/js/stats.js",
                "/css/style.css", "/estatisticas.html"}) {
            mockMvc.perform(get(arquivo))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void oQuizGravaAPartidaNaMesmaOrigem() throws Exception {
        mockMvc.perform(post("/api/results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "playerName": "Ana",
                                  "score": 47,
                                  "tier": "intermediario",
                                  "fear": "observado",
                                  "durationSeconds": 260,
                                  "eventsFired": 4,
                                  "reachedEnd": true,
                                  "answers": { "fear": "observado", "alone": "sim" }
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.position").exists())
                .andExpect(jsonPath("$.totalPlayers").exists());

        mockMvc.perform(get("/api/results/ranking"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maisMedrosos").exists())
                .andExpect(jsonPath("$.maisCorajosos").exists());
    }
}

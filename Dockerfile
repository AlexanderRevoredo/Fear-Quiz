# syntax=docker/dockerfile:1

# ---------- build ----------
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# Dependencias em camada propria: so refaz o download quando o pom muda, o que
# deixa os deploys seguintes bem mais rapidos.
# O "|| true" e proposital: isto e so aquecimento de cache, nao um passo de
# correcao. O go-offline as vezes falha ao resolver alguma dependencia de
# plugin, e nesse caso o "package" abaixo baixa o que faltou. Sem a guarda,
# uma falha aqui derrubaria o deploy inteiro por um passo que e opcional.
COPY pom.xml .
RUN mvn -B dependency:go-offline || true

COPY src ./src
# Os testes rodam no desenvolvimento (./mvnw test); aqui so empacota.
RUN mvn -B clean package -DskipTests

# ---------- runtime ----------
# JRE em vez de JDK: imagem final bem menor.
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Rodar como usuario comum, nao root.
RUN addgroup -S app && adduser -S app -G app

COPY --from=build --chown=app:app /build/target/*.jar app.jar

USER app
EXPOSE 8080

# MaxRAMPercentage faz a JVM enxergar o limite do container (512MB no plano
# gratuito do Render); sem isso ela dimensiona o heap pela RAM da maquina toda.
# Forma exec para a JVM ser o PID 1 e receber o SIGTERM no shutdown.
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]

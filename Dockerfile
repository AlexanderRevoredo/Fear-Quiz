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
# JRE em vez de JDK: imagem final menor.
#
# Imagem baseada em glibc (jammy), NAO alpine. O resolvedor DNS do musl, usado
# pelo Alpine, falha em alguns hosts que respondem com varios enderecos -- e o
# pooler do Supabase responde com tres. E uma causa classica de "conecta na
# minha maquina e nao conecta no container".
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Rodar como usuario comum, nao root.
RUN groupadd --system app && useradd --system --gid app app

COPY --from=build --chown=app:app /build/target/*.jar app.jar

USER app
EXPOSE 8080

# MaxRAMPercentage faz a JVM enxergar o limite do container (512MB no plano
# gratuito do Render); sem isso ela dimensiona o heap pela RAM da maquina toda.
# Forma exec para a JVM ser o PID 1 e receber o SIGTERM no shutdown.
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]

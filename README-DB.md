# Banco de dados — Fear Quiz

A aplicação **não guarda credenciais no repositório**. As três informações de
conexão vêm de variáveis de ambiente, lidas em `application.properties`:

| Variável | Valor |
| --- | --- |
| `FEARQUIZ_DB_URL` | `jdbc:postgresql://<host>:<porta>/postgres?sslmode=require` |
| `FEARQUIZ_DB_USER` | `postgres` (ou o usuário do pooler) |
| `FEARQUIZ_DB_PASSWORD` | a senha do projeto no Supabase |

Sem elas a aplicação não sobe — é intencional, para ninguém subir sem querer
com uma senha escrita no código.

> **A senha nunca vai no `application.properties`.** Esse arquivo é versionado e
> vai para o GitHub junto com o resto. Como o projeto é para o portfólio, o
> repositório tende a ser público — e senha de banco em repositório público é
> varrida por bots. Use uma das duas formas abaixo.

## Opção 1 — arquivo local (mais confortável na IDE)

Copie `application-local.properties.example` para
`application-local.properties` (mesma pasta), preencha a senha e rode com o
perfil `local` ativo.

**No PowerShell, o `-D...` precisa estar entre aspas:**

```powershell
./mvnw spring-boot:run "-Dspring-boot.run.profiles=local"
```

Sem as aspas o PowerShell 5.1 parte o argumento em dois e o Maven reclama de
`Unknown lifecycle phase ".run.profiles=local"`. No Git Bash as aspas são
opcionais:

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

Para não depender disso, dá para fixar o perfil na *Run Configuration* do
IntelliJ (`HorrorSiteApplication` → *Active profiles* → `local`) e rodar pelo
botão de play.

O arquivo sem `.example` está no `.gitignore`, então fica só na sua máquina.
Propriedades de perfil têm prioridade sobre o `application.properties`, então
com esse arquivo você não precisa definir variável de ambiente nenhuma.

No IntelliJ, dá para fixar isso na *Run Configuration* do
`HorrorSiteApplication`, em *Active profiles* → `local`.

## Opção 2 — variáveis de ambiente

PowerShell (a sessão atual apenas):

```powershell
$env:FEARQUIZ_DB_URL="jdbc:postgresql://db.ssglyxzqphnjlgmmrtdv.supabase.co:5432/postgres?sslmode=require"
$env:FEARQUIZ_DB_USER="postgres"
$env:FEARQUIZ_DB_PASSWORD="a-senha-real"
./mvnw spring-boot:run
```

Git Bash:

```bash
export FEARQUIZ_DB_URL="jdbc:postgresql://db.ssglyxzqphnjlgmmrtdv.supabase.co:5432/postgres?sslmode=require"
export FEARQUIZ_DB_USER="postgres"
export FEARQUIZ_DB_PASSWORD="a-senha-real"
./mvnw spring-boot:run
```

Depois de subir, o site fica em <http://localhost:8080> — o Spring Boot serve o
front-end de `src/main/resources/static`, então a API é a mesma origem e não
precisa de CORS.

## Se a conexão falhar

A conexão direta do Supabase (`db.<ref>.supabase.co:5432`) responde **só em
IPv6** para projetos no plano gratuito. Em rede sem IPv6 o sintoma é um timeout
ou `UnknownHostException`, e não um erro de senha.

Nesse caso, use o **pooler** no painel do Supabase
(*Project Settings → Database → Connection string → Session pooler*). O host tem
a forma `aws-0-<região>.pooler.supabase.com` e o usuário vira
`postgres.<ref-do-projeto>`. Só trocar `FEARQUIZ_DB_URL` e `FEARQUIZ_DB_USER`.

## Schema

`spring.jpa.hibernate.ddl-auto=update` cria e atualiza as tabelas sozinho
(`results` e `result_answers`). Serve enquanto o schema ainda muda; quando
estabilizar, vale migrar para Flyway e trocar para `validate`, para o banco
parar de mudar sozinho a partir do código.

## Endpoints

| Método | Rota | O que faz |
| --- | --- | --- |
| `POST` | `/api/results` | Salva a partida. Devolve id, faixa e o percentual de quem pontuou menos. |
| `GET` | `/api/results/stats` | Total de partidas, média, distribuição por faixa e por medo. |
| `GET` | `/api/results/ranking` | Top 10 por pontuação, desempatado por menor tempo. |

## Aviso sobre o ranking

O `POST` é público e a pontuação é calculada no navegador, então **é possível
forjar um resultado** enviando um JSON direto para a API. Há validação de
limites (nome ≤ 24 caracteres, pontuação 0–200, duração ≤ 24h) para impedir
valores absurdos, mas não impede alguém determinado de enviar 200 pontos.

Para um quiz entre amigos isso é aceitável. Se o ranking virar algo sério, a
correção é calcular a pontuação no servidor: o cliente manda só as respostas e
os tempos, e o back-end aplica a tabela de pontos.

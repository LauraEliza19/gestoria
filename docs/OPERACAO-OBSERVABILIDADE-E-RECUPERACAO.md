# Operação, observabilidade e recuperação do Gestoria

## 1. Objetivo

Este documento descreve os recursos operacionais do Gestoria para:

- verificação de disponibilidade;
- diagnóstico de prontidão;
- centralização de logs;
- coleta de métricas;
- alertas por e-mail;
- backup automático do PostgreSQL;
- teste controlado de restauração;
- resposta inicial a incidentes.

## 2. Endpoints de saúde

### Compatibilidade

`GET /api/health`

Mantém compatibilidade com integrações anteriores.

### Liveness

`GET /api/health/live`

Confirma que o processo da API está ativo. Não consulta banco nem migrations.

Resposta esperada:

```json
{
  "status": "ok"
}
```

### Readiness

`GET /api/health/ready`

Confirma:

- conexão com o PostgreSQL;
- migration aplicada;
- compatibilidade entre a revisão atual e a revisão esperada.

O endpoint retorna `200` quando a API está pronta e `503` quando alguma dependência obrigatória falha.

## 3. Logs centralizados

A API produz logs estruturados em JSON contendo:

- data e hora;
- nível;
- logger;
- evento;
- identificador da requisição;
- método HTTP;
- caminho;
- código de resposta;
- duração.

Fluxo:

```text
API/Docker → Grafana Alloy → Loki → Grafana
```

Consulta básica no Grafana:

```logql
{service="api"} |= "request_completed"
```

Atributos de alta cardinalidade, como `request_id`, permanecem como metadados e não como labels permanentes.

## 4. Métricas e disponibilidade

Fluxo:

```text
Prometheus → Blackbox Exporter → /api/health/ready
```

Consultas principais:

```promql
probe_success{job="gestoria-readiness"}
```

- `1`: endpoint disponível;
- `0`: endpoint indisponível.

```promql
probe_duration_seconds{job="gestoria-readiness"}
```

Representa o tempo total da verificação de prontidão.

## 5. Alertas

O Prometheus envia alertas ao Alertmanager, que entrega notificações por Gmail.

### Alertas configurados

#### GestoriaApiUnavailable

Dispara quando:

```promql
probe_success{job="gestoria-readiness"} == 0
```

A condição deve permanecer ativa por dois minutos.

**Gravidade:** crítica.

#### GestoriaApiSlow

Dispara quando a média de duração da prontidão permanece acima de um segundo durante cinco minutos.

**Gravidade:** aviso.

O Alertmanager:

- agrupa notificações equivalentes;
- envia alertas ativos por e-mail;
- repete alertas persistentes;
- envia uma notificação quando o incidente é resolvido.

A senha de app do Gmail fica somente em:

```text
deploy/observability/secrets/gmail_app_password
```

Esse diretório é ignorado pelo Git. A senha nunca deve ser adicionada ao YAML, ao `.env` versionado ou ao histórico do terminal.

## 6. Inicialização da observabilidade

Defina a senha administrativa do Grafana na sessão atual:

```powershell
$gestoriaGrafanaPassword = Read-Host `
  "Digite a senha administrativa do Grafana" `
  -AsSecureString

$env:GRAFANA_ADMIN_PASSWORD = `
  [Net.NetworkCredential]::new(
    "",
    $gestoriaGrafanaPassword
  ).Password

Remove-Variable gestoriaGrafanaPassword
```

Inicie os serviços:

```powershell
docker compose `
  -f docker-compose.yml `
  -f docker-compose.observability.yml `
  up -d
```

Interfaces locais:

- Grafana: `http://127.0.0.1:3000`;
- Prometheus: `http://127.0.0.1:9090`;
- Alertmanager: `http://127.0.0.1:9093`;
- Loki: `http://127.0.0.1:3100`;
- Alloy: `http://127.0.0.1:12345`.

## 7. Backup automático

O serviço `backup` utiliza a imagem oficial `postgres:17-alpine`.

Política inicial:

- backup imediato ao iniciar o serviço;
- intervalo padrão de 24 horas;
- nova tentativa após cinco minutos em caso de falha;
- retenção local de 14 dias;
- formato customizado do `pg_dump`;
- checksum SHA-256;
- arquivos incompletos não são promovidos a backup válido.

Diretório local:

```text
.backups/
```

Esse diretório é ignorado pelo Git.

Variáveis configuráveis:

- `BACKUP_INTERVAL_SECONDS`;
- `BACKUP_RETRY_SECONDS`;
- `BACKUP_RETENTION_DAYS`.

Consultar o serviço:

```powershell
docker compose ps backup
docker compose logs --tail 50 backup
```

## 8. Validação de integridade

O backup produz:

```text
gestoria-AAAAMMDDTHHMMSSZ.dump
gestoria-AAAAMMDDTHHMMSSZ.dump.sha256
```

O checksum deve apresentar `OK`, e o `pg_restore --list` deve conseguir ler o catálogo interno.

## 9. Teste de restauração

O teste restaura o backup mais recente em um banco temporário isolado.

Ele:

1. valida o checksum;
2. cria um banco temporário;
3. restaura o backup;
4. consulta a revisão Alembic;
5. conta as tabelas restauradas;
6. remove o banco temporário mesmo em caso de falha.

Execução:

```powershell
docker compose exec -T backup `
  /bin/sh `
  /usr/local/bin/gestoria-restore-drill.sh
```

Resultado esperado:

```text
Teste de restauração aprovado.
Migration restaurada: ...
Tabelas restauradas: ...
Banco temporário removido: ...
```

## 10. Evidência inicial de restauração

**Data:** 11 de novembro de 2026.

Resultado:

- checksum aprovado;
- catálogo do backup legível;
- migration restaurada: `0017_finance_accounts`;
- tabelas restauradas: `33`;
- banco temporário removido;
- banco principal não alterado.

## 11. Resposta inicial a incidentes

Quando um alerta for recebido:

1. verificar o assunto, a gravidade e o serviço;
2. abrir o Prometheus e consultar `probe_success`;
3. consultar os logs no Grafana pelo horário do incidente;
4. localizar o `request_id`, quando aplicável;
5. conferir `/api/health/live`;
6. conferir `/api/health/ready`;
7. verificar os containers com `docker compose ps`;
8. registrar causa, impacto, duração e ação corretiva;
9. confirmar o recebimento do alerta de resolução.

## 12. Limitações antes da produção comercial

A configuração atual atende ao desenvolvimento e à demonstração, mas a produção ainda exige:

- armazenamento externo e criptografado dos backups;
- cópia em região ou provedor diferente;
- política formal de retenção;
- rotação periódica das credenciais SMTP;
- monitoramento da idade do último backup;
- alerta específico para falhas de backup;
- restaurações periódicas agendadas;
- definição formal de RPO e RTO;
- acesso protegido às interfaces operacionais;
- infraestrutura redundante.

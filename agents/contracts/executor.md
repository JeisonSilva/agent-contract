# Contrato: Executor

Define **como o agente executa** uma etapa de um plano. O executor recebe
uma etapa (gerada pelo planner), seleciona a ferramenta adequada no toolbox
e produz um resultado verificável.

## Como o runner deve usar este arquivo

1. Receber uma etapa do plano (ver [planner](./planner.md)).
2. Selecionar, no [toolbox](./toolbox.md), a ferramenta compatível com a `acao` da etapa.
3. Executar a ferramenta seguindo as `regras` abaixo.
4. Validar o resultado contra o `criterio_de_sucesso` da etapa antes de marcá-la como concluída.
5. Em caso de falha, seguir a política definida em `em_falha`.

## Estrutura esperada

```yaml

executor:
  entrada:
    - etapa: Descrição da etapa a ser executada, vinda do planner
    - contexto: Informações relevantes acumuladas durante a execução (memória de curto prazo)

  regras:
    - Executar uma única etapa por vez, nunca pular etapas do plano
    - Sempre escolher a ferramenta mais específica disponível no toolbox
    - Nunca inventar dados que deveriam vir do usuário ou de uma ferramenta

  em_falha:
    tentativas_maximas: 2
    acao: Registrar o motivo da falha e devolver o controle ao planner para replanejar

  saida:
    - status: sucesso | falha
    - resultado: Dado produzido pela execução da etapa
    - observacoes: Informações relevantes para as próximas etapas

```

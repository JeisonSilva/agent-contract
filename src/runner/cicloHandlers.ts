import type { EtapaHandlers, EntradaCiclo } from "./loop.js";
import type { ImplementacaoDeFerramenta } from "../agente/ferramentas.js";
import type { ImplementacaoDeHook, ResultadoDeHook, EstadoParaRelatorio } from "../agente/hooks.js";

type HookDeclarado = { nome: string; acao: string };

// Contexto repassado a todo hook. `dados` acumula o que os hooks anteriores
// do mesmo disparo já produziram.
type ContextoDeHook = {
    caminhoDoProjeto: string;
    entrada: EntradaCiclo;
    estado: EstadoParaRelatorio;
    dados: Record<string, any>;
};

// Mecanismo genérico de disparo: lê os hooks declarados em agents/hooks.md e,
// para cada um, busca sua implementação real no mapa injetado pelo agente
// (ver `criarImplementacoesDeHooks` em src/agente/hooks.ts). Hooks sem
// implementação concreta apenas anunciam a `acao` declarada — placeholder
// consciente para contratos ainda em elaboração.
async function dispararHooks(
    hooks: HookDeclarado[] | undefined,
    contextoBase: { caminhoDoProjeto: string; entrada: EntradaCiclo; estado: EstadoParaRelatorio },
    implementacoesDeHooks: Record<string, ImplementacaoDeHook>
): Promise<{ mensagens: string[]; interromper: boolean; dados: Record<string, any> }> {
    const mensagens: string[] = [];
    let interromper = false;
    let dados: Record<string, any> = {};

    for (const hook of hooks ?? []) {
        const implementacao = implementacoesDeHooks[hook.nome];
        if (implementacao) {
            const resultado: ResultadoDeHook = await implementacao({ ...contextoBase, dados });
            mensagens.push(`[hook:${hook.nome}] ${resultado.mensagem}`);
            if (resultado.interromper) interromper = true;
            if (resultado.dados) dados = { ...dados, ...resultado.dados };
        } else {
            mensagens.push(`[hook:${hook.nome}] (anunciado, sem implementação concreta) ${hook.acao}`);
        }
    }

    return { mensagens, interromper, dados };
}

// Liga cada nome de etapa de loop.ciclo (agents/contracts/loop.md) à função
// que a executa. Esta tabela é o único lugar que precisa acompanhar o
// markdown: se uma etapa for renomeada, adicionada ou removida no contrato,
// ajuste as chaves aqui — o Loop em si permanece genérico.
//
// `ferramentas`, `implementacoesDeHooks` e `montarRelatorioFinal` são
// implementações do AGENTE (ver src/agente/) injetadas aqui — este arquivo
// não conhece o propósito do agente, só o formato do ciclo.
export function criarHandlersDoCiclo(
    ferramentas: Record<string, ImplementacaoDeFerramenta>,
    hooksRoot: any,
    implementacoesDeHooks: Record<string, ImplementacaoDeHook>,
    montarRelatorioFinal: (estado: EstadoParaRelatorio, entrada: EntradaCiclo) => string
): EtapaHandlers {
    return {
        inicio: async (estado, { entrada }) => {
            const { mensagens, interromper } = await dispararHooks(
                hooksRoot?.hooks?.inicio,
                { caminhoDoProjeto: entrada.caminhoDoProjeto, entrada, estado },
                implementacoesDeHooks
            );
            // O reducer de `mensagens` (ver loop.ts) é `(acc, val) => acc.concat(val)`:
            // ele espera receber só as mensagens NOVAS (delta), não o histórico
            // inteiro — devolver `[...estado.mensagens, ...]` duplicaria tudo a
            // cada etapa.
            return {
                mensagens: [`Início da catalogação de "${entrada.caminhoDoProjeto}"`, ...mensagens],
                interrompido: interromper,
            };
        },

        planejar: async (estado, { planner, entrada, executor }) => {
            if (estado.interrompido) {
                return { mensagens: ["Planejamento ignorado: execução interrompida na validação inicial."] };
            }

            const plano = await planner.gerarPlano(entrada.objetivo, executor.listarFerramentasDisponiveis());
            return {
                plano,
                mensagens: [`Plano gerado com ${plano.length} etapa(s): ${plano.map((e) => e.acao).join(", ")}`],
            };
        },

        executar_proxima_etapa: async (estado, { executor, entrada }) => {
            if (estado.interrompido) {
                return { mensagens: ["Execução ignorada: execução interrompida na validação inicial."] };
            }

            const resultados: Array<{ etapa: import("./planner.js").EtapaPlano; resultado: import("./executor.js").ResultadoEtapa }> = [];
            // Mapa `nomeDaFerramenta -> retorno`, construído incrementalmente:
            // é assim que dados fluem de uma etapa para a seguinte (ex:
            // `listar_arquivos_alterados_por_autor` lê os `desenvolvedores`
            // devolvidos por `identificar_desenvolvedores_ativos`). Só entram
            // aqui etapas que tiveram sucesso.
            const resultadosPorFerramenta: Record<string, any> = {};
            for (const etapa of estado.plano) {
                const resultado = await executor.executarEtapa(etapa, {
                    caminhoDoProjeto: entrada.caminhoDoProjeto,
                    resultadosAnteriores: resultadosPorFerramenta,
                });
                resultados.push({ etapa, resultado });
                if (resultado.status === "sucesso") {
                    resultadosPorFerramenta[etapa.acao] = resultado.resultado;
                }
            }

            return {
                resultados,
                mensagens: [`${resultados.length} etapa(s) executada(s).`],
            };
        },

        validar_resultado: async (estado) => {
            if (estado.interrompido) {
                return { mensagens: ["Validação ignorada: execução interrompida na validação inicial."] };
            }

            const falhas = estado.resultados.filter(({ resultado }) => resultado.status === "falha");
            const concluido = estado.resultados.length > 0 && falhas.length === 0;

            return {
                concluido,
                mensagens: [
                    falhas.length === 0
                        ? "Todas as etapas foram concluídas conforme seus critérios de sucesso."
                        : `${falhas.length} de ${estado.resultados.length} etapa(s) falharam.`,
                ],
            };
        },

        repetir_ou_finalizar: async (estado, { entrada }) => {
            // O relatório é produzido pelo próprio hook `consolidar-relatorio-de-catalogacao`
            // (ver `dados.relatorio` em `dispararHooks`); se ele não estiver
            // declarado em hooks.md, caímos no fallback `montarRelatorioFinal`
            // (implementação do agente, injetada acima) para não deixar o
            // ciclo sem relatório.
            const { mensagens, dados } = await dispararHooks(
                hooksRoot?.hooks?.fim,
                { caminhoDoProjeto: entrada.caminhoDoProjeto, entrada, estado },
                implementacoesDeHooks
            );
            const relatorio: string = dados.relatorio ?? montarRelatorioFinal(estado, entrada);
            console.log(relatorio);

            return {
                concluido: true,
                mensagens: [...mensagens, "Catalogação finalizada.", relatorio],
            };
        },
    };
}

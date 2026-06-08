import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { EtapaHandlers, EntradaCiclo } from "./loop.js";
import type { ImplementacaoDeFerramenta } from "./ferramentas.js";
import { localizarManifesto } from "./ferramentas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIRETORIO_DE_RESULTADOS = path.join(__dirname, "../../resultados");

type HookDeclarado = { nome: string; acao: string };

type ResultadoDeHook = {
    mensagem: string;
    interromper?: boolean;
    // Dados produzidos pelo hook que devem ficar disponíveis para os hooks
    // seguintes do mesmo disparo (ex: `consolidar-relatorio-de-catalogacao`
    // produz `relatorio`, que `registrar-log-de-execucao` consome em
    // seguida) — mesma convenção de "fluxo entre etapas" usada para
    // `resultadosAnteriores` no Executor.
    dados?: Record<string, any>;
};

// Estado mínimo necessário para montar o relatório final — mesmo formato
// usado por `montarRelatorioFinal`/`montarSinteseDoCatalogo`.
type EstadoParaRelatorio = {
    plano: import("./planner.js").EtapaPlano[];
    resultados: Array<{ etapa: import("./planner.js").EtapaPlano; resultado: import("./executor.js").ResultadoEtapa }>;
    interrompido: boolean;
    concluido: boolean;
};

// Contexto repassado a todo hook. `dados` acumula o que os hooks anteriores
// do mesmo disparo já produziram (ver `dispararHooks`).
type ContextoDeHook = {
    caminhoDoProjeto: string;
    entrada: EntradaCiclo;
    estado: EstadoParaRelatorio;
    dados: Record<string, any>;
};

type ImplementacaoDeHook = (contexto: ContextoDeHook) => Promise<ResultadoDeHook> | ResultadoDeHook;

// Hooks são instruções em linguagem natural (`acao`) que o runner deve
// traduzir em comportamento. Damos comportamento real a um representante de
// cada grupo — os demais apenas anunciam a ação declarada (placeholder
// consciente; ver agents/hooks.md para o texto completo de cada um).
const IMPLEMENTACOES_DE_HOOKS: Record<string, ImplementacaoDeHook> = {
    "validar-presenca-de-manifesto": ({ caminhoDoProjeto }) => {
        const manifesto = localizarManifesto(caminhoDoProjeto);
        if (!manifesto) {
            return {
                mensagem: `Nenhum manifesto de dependências reconhecido em "${caminhoDoProjeto}"; identificação de domínio não pode ser feita.`,
                interromper: true,
            };
        }
        return { mensagem: `Manifesto "${manifesto.arquivo}" localizado em "${caminhoDoProjeto}".` };
    },

    "consolidar-relatorio-de-catalogacao": ({ estado, entrada }) => {
        const relatorio = montarRelatorioFinal(estado, entrada);
        return {
            mensagem: "Domínio do projeto, subdomínios do produto, desenvolvedores identificados e o mapeamento entre eles reunidos em um relatório único.",
            dados: { relatorio },
        };
    },

    "registrar-log-de-execucao": ({ caminhoDoProjeto, estado, dados }) => {
        const relatorio: string | undefined = dados.relatorio;
        const status = estado.interrompido ? "interrompido" : estado.concluido ? "sucesso" : "falha";
        const carimboDeTempo = new Date().toISOString().replace(/[:.]/g, "-");
        const nomeDoArquivo = `log_${carimboDeTempo}_${status}.md`;
        const caminhoDoArquivo = path.join(DIRETORIO_DE_RESULTADOS, nomeDoArquivo);

        const conteudo = [
            `# Log de execução — ${status}`,
            ``,
            `Projeto analisado: ${caminhoDoProjeto}`,
            `Data: ${new Date().toISOString()}`,
            ``,
            relatorio ?? "(catalogação interrompida antes de gerar relatório consolidado)",
            ``,
        ].join("\n");

        fs.mkdirSync(DIRETORIO_DE_RESULTADOS, { recursive: true });
        fs.writeFileSync(caminhoDoArquivo, conteudo, "utf8");

        return { mensagem: `Resultado da catalogação ("${status}") gravado em "${caminhoDoArquivo}".` };
    },
};

async function dispararHooks(
    hooks: HookDeclarado[] | undefined,
    contextoBase: { caminhoDoProjeto: string; entrada: EntradaCiclo; estado: EstadoParaRelatorio }
): Promise<{ mensagens: string[]; interromper: boolean; dados: Record<string, any> }> {
    const mensagens: string[] = [];
    let interromper = false;
    let dados: Record<string, any> = {};

    for (const hook of hooks ?? []) {
        const implementacao = IMPLEMENTACOES_DE_HOOKS[hook.nome];
        if (implementacao) {
            const resultado = await implementacao({ ...contextoBase, dados });
            mensagens.push(`[hook:${hook.nome}] ${resultado.mensagem}`);
            if (resultado.interromper) interromper = true;
            if (resultado.dados) dados = { ...dados, ...resultado.dados };
        } else {
            mensagens.push(`[hook:${hook.nome}] (anunciado, sem implementação concreta) ${hook.acao}`);
        }
    }

    return { mensagens, interromper, dados };
}

// Busca o retorno de uma etapa concluída com sucesso pelo nome da ação
// (mesma convenção usada para acumular `resultadosPorFerramenta` durante a
// execução — ver `executar_proxima_etapa`).
function buscarResultadoDeEtapa(
    resultados: Array<{ etapa: import("./planner.js").EtapaPlano; resultado: import("./executor.js").ResultadoEtapa }>,
    acao: string
): any | undefined {
    return resultados.find((r) => r.etapa.acao === acao && r.resultado.status === "sucesso")?.resultado?.resultado;
}

// Para um desenvolvedor, cruza os arquivos que ele alterou com as
// `pastas_relacionadas` de cada subdomínio (prefixo de caminho — ex. arquivo
// "src/pagamentos/boleto.ts" casa com a pasta "src/pagamentos"). Retorna os
// nomes dos subdomínios evidenciados e a contagem de arquivos que serviram de
// prova; lista vazia significa "nenhuma correspondência por pasta".
function associarPorPastas(
    arquivosAlterados: string[],
    subdominios: Array<{ nome: string; pastas_relacionadas?: string[] }>
): Array<{ nome: string; quantidadeDeArquivos: number }> {
    const evidencias: Array<{ nome: string; quantidadeDeArquivos: number }> = [];

    for (const subdominio of subdominios) {
        const pastas = subdominio.pastas_relacionadas ?? [];
        if (pastas.length === 0) continue;

        const quantidadeDeArquivos = arquivosAlterados.filter((arquivo) =>
            pastas.some((pasta) => arquivo === pasta || arquivo.startsWith(`${pasta}/`))
        ).length;

        if (quantidadeDeArquivos > 0) {
            evidencias.push({ nome: subdominio.nome, quantidadeDeArquivos });
        }
    }

    return evidencias;
}

// Monta a síntese final prometida pelo agente: domínio de negócio do projeto,
// subdomínios do produto, desenvolvedores ativos e a associação entre eles.
// Quando o subdomínio traz `pastas_relacionadas` (a própria LLM identificou a
// relação — não inventamos um classificador arquivo→subdomínio), cruzamos com
// os arquivos alterados por cada desenvolvedor via prefixo de caminho; sem
// essa evidência, caímos no comportamento conservador de associar o
// desenvolvedor a todos os subdomínios identificados, deixando clara a falta
// de granularidade — exatamente como pede `agents/roles.md`.
function montarSinteseDoCatalogo(
    resultados: Array<{ etapa: import("./planner.js").EtapaPlano; resultado: import("./executor.js").ResultadoEtapa }>
): string | null {
    const dominio: import("./ferramentas.js").Dominio | undefined = buscarResultadoDeEtapa(resultados, "identificar_dominio_do_projeto");
    const desenvolvedores: Array<{ autor: string; email: string; quantidade_commits: number }> | undefined =
        buscarResultadoDeEtapa(resultados, "identificar_desenvolvedores_ativos")?.desenvolvedores;
    const arquivosPorDesenvolvedor: Record<string, string[]> | undefined =
        buscarResultadoDeEtapa(resultados, "listar_arquivos_alterados_por_autor")?.arquivos_por_desenvolvedor;

    if (!dominio && !desenvolvedores) return null;

    const linhas: string[] = [];
    linhas.push("--- Síntese do catálogo ---");

    if (dominio) {
        linhas.push(`Domínio do projeto: ${dominio.dominio}`);
        linhas.push(`Justificativa: ${dominio.justificativa_dominio}`);
        linhas.push("Subdomínios do produto:");
        for (const subdominio of dominio.subdominios) {
            const pastas = subdominio.pastas_relacionadas?.length ? ` (pastas relacionadas: ${subdominio.pastas_relacionadas.join(", ")})` : "";
            linhas.push(`  - ${subdominio.nome}: ${subdominio.justificativa}${pastas}`);
        }
    }

    if (desenvolvedores && desenvolvedores.length > 0) {
        linhas.push("Desenvolvedores ativos e sua associação a(os) subdomínio(s) do produto:");
        for (const desenvolvedor of desenvolvedores) {
            const arquivosAlterados = arquivosPorDesenvolvedor?.[desenvolvedor.autor] ?? [];
            const evidenciaPorPasta = dominio ? associarPorPastas(arquivosAlterados, dominio.subdominios) : [];

            let descricaoDaAssociacao: string;
            if (evidenciaPorPasta.length > 0) {
                const detalhes = evidenciaPorPasta.map((e) => `${e.nome} (${e.quantidadeDeArquivos} arquivo(s) em pastas relacionadas)`).join(", ");
                descricaoDaAssociacao = `associado a(os) subdomínio(s) [${detalhes}], com base nos arquivos alterados`;
            } else if (dominio) {
                const nomes = dominio.subdominios.map((s) => s.nome).join(", ");
                descricaoDaAssociacao = `sem evidência de correspondência entre arquivos alterados e pastas dos subdomínios — associado, de forma conservadora, a todos os subdomínios identificados [${nomes}]`;
            } else {
                descricaoDaAssociacao = "domínio do projeto não identificado — associação não pôde ser feita";
            }

            linhas.push(
                `  - ${desenvolvedor.autor} (${desenvolvedor.email}): ${descricaoDaAssociacao}`
                + ` — evidência geral de atuação: ${desenvolvedor.quantidade_commits} commit(s) e ${arquivosAlterados.length} arquivo(s) alterado(s) no período analisado.`
            );
        }
    } else if (desenvolvedores) {
        linhas.push("Nenhum desenvolvedor ativo identificado no período analisado.");
    }

    return linhas.join("\n");
}

function montarRelatorioFinal(estado: EstadoParaRelatorio, entrada: EntradaCiclo): string {
    const linhas: string[] = [];
    linhas.push("=== Relatório de catalogação ===");
    linhas.push(`Objetivo: ${entrada.objetivo}`);
    linhas.push(`Projeto analisado: ${entrada.caminhoDoProjeto}`);

    if (estado.interrompido) {
        linhas.push("Status: interrompido durante a validação inicial (ver hooks de início).");
    } else {
        linhas.push(`Plano gerado com ${estado.plano.length} etapa(s).`);
        for (const { etapa, resultado } of estado.resultados) {
            linhas.push(`- [${resultado.status.toUpperCase()}] ${etapa.descricao} (ação: ${etapa.acao})`);
            linhas.push(`  ${resultado.observacoes}`);
        }

        const sintese = montarSinteseDoCatalogo(estado.resultados);
        if (sintese) {
            linhas.push(sintese);
        }

        linhas.push(`Status final: ${estado.concluido ? "concluído com sucesso" : "concluído com falhas"}`);
    }

    return linhas.join("\n");
}

// Liga cada nome de etapa de loop.ciclo (agents/contracts/loop.md) à função
// que a executa. Esta tabela é o único lugar que precisa acompanhar o
// markdown: se uma etapa for renomeada, adicionada ou removida no contrato,
// ajuste as chaves aqui — o Loop em si permanece genérico.
export function criarHandlersDoCiclo(
    ferramentas: Record<string, ImplementacaoDeFerramenta>,
    hooksRoot: any
): EtapaHandlers {
    return {
        inicio: async (estado, { entrada }) => {
            const { mensagens, interromper } = await dispararHooks(
                hooksRoot?.hooks?.inicio,
                { caminhoDoProjeto: entrada.caminhoDoProjeto, entrada, estado }
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
            // declarado em hooks.md, caímos no fallback para não deixar o
            // ciclo sem relatório.
            const { mensagens, dados } = await dispararHooks(hooksRoot?.hooks?.fim, {
                caminhoDoProjeto: entrada.caminhoDoProjeto,
                entrada,
                estado,
            });
            const relatorio: string = dados.relatorio ?? montarRelatorioFinal(estado, entrada);
            console.log(relatorio);

            return {
                concluido: true,
                mensagens: [...mensagens, "Catalogação finalizada.", relatorio],
            };
        },
    };
}

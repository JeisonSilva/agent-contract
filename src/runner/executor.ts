import type { EtapaPlano } from "./planner.js";
import type { ImplementacaoDeFerramenta } from "../agente/ferramentas.js";

export type ResultadoEtapa = {
    status: "sucesso" | "falha";
    resultado?: any;
    observacoes: string;
};

// `resultadosAnteriores` acumula, por nome de ferramenta, o retorno das etapas
// já executadas com sucesso — é assim que dados fluem entre etapas do plano
// (ex: `classificar_area_por_pacotes` lê `resultadosAnteriores["ler_manifesto_de_dependencias"].pacotes`).
export type ContextoDeExecucao = { caminhoDoProjeto: string; resultadosAnteriores: Record<string, any> };

export default class Executor {
    private _executorRoot: any;
    private _toolboxRoot: any;
    private _ferramentas: Record<string, ImplementacaoDeFerramenta>;

    constructor(executorRoot: any, toolboxRoot: any, ferramentas: Record<string, ImplementacaoDeFerramenta>) {
        this._executorRoot = executorRoot;
        this._toolboxRoot = toolboxRoot;
        this._ferramentas = ferramentas;
    }

    listarFerramentasDisponiveis(): Array<{ nome: string; descricao: string }> {
        return (this._toolboxRoot?.toolbox?.ferramentas ?? [])
            .filter((f: any) => f?.nome && this._ferramentas[f.nome] !== undefined)
            .map((f: any) => ({ nome: f.nome, descricao: f.descricao }));
    }

    async executarEtapa(etapa: EtapaPlano, contexto: ContextoDeExecucao): Promise<ResultadoEtapa> {
        const ferramentaDeclarada = (this._toolboxRoot?.toolbox?.ferramentas ?? [])
            .find((f: any) => f?.nome === etapa.acao);

        if (!ferramentaDeclarada) {
            return {
                status: "falha",
                observacoes: `Ferramenta "${etapa.acao}" não encontrada no toolbox; etapa não executada.`,
            };
        }

        const implementacao = this._ferramentas[ferramentaDeclarada.nome];
        if (!implementacao) {
            return {
                status: "falha",
                observacoes: `Ferramenta "${ferramentaDeclarada.nome}" não encontrada na arquitetura do agente; implemente-a em src/agente/ferramentas.ts para disponibilizá-la.`,
            };
        }

        try {
            const resultado = await implementacao(contexto);
            return {
                status: "sucesso",
                resultado,
                observacoes: `Critério de sucesso esperado: "${etapa.criterio_de_sucesso}". Ferramenta "${ferramentaDeclarada.nome}" executada com retorno: ${JSON.stringify(resultado)}`,
            };
        } catch (erro) {
            return {
                status: "falha",
                observacoes: `Falha ao executar "${ferramentaDeclarada.nome}": ${(erro as Error).message}`,
            };
        }
    }
}

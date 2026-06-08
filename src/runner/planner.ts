import type ModeloIA from "../agents-config/modeloIA.js";

export type EtapaPlano = {
    descricao: string;
    acao: string;
    criterio_de_sucesso: string;
    depende_de: string[];
};

export type FerramentaDisponivel = { nome: string; descricao: string };

export default class Planner {
    private _plannerRoot: any;
    private _modeloIA: ModeloIA;

    constructor(plannerRoot: any, modeloIA: ModeloIA) {
        this._plannerRoot = plannerRoot;
        this._modeloIA = modeloIA;
    }

    async gerarPlano(objetivo: string, ferramentasDisponiveis: FerramentaDisponivel[]): Promise<EtapaPlano[]> {
        const prompt = this._montarPrompt(objetivo, ferramentasDisponiveis);
        const resposta = await this._modeloIA.perguntar(prompt);
        return this._parsearPlano(resposta);
    }

    private _montarPrompt(objetivo: string, ferramentasDisponiveis: FerramentaDisponivel[]): string {
        const planner = this._plannerRoot?.planner ?? {};
        const estruturaDaEtapa: string[] = planner.estrutura_da_etapa ?? [];
        const regras: string[] = planner.regras ?? [];

        const listaDeFerramentas = ferramentasDisponiveis
            .map((f) => `- ${f.nome}: ${f.descricao}`)
            .join("\n");

        return [
            `Objetivo a planejar: ${objetivo}`,
            "",
            "Gere um plano como uma lista ORDENADA de etapas. Cada etapa deve conter exatamente estes campos:",
            ...estruturaDaEtapa.map((campo) => `- ${campo}`),
            "",
            "Regras de planejamento:",
            ...regras.map((regra) => `- ${regra}`),
            "",
            "Ferramentas disponíveis (o campo \"acao\" de cada etapa DEVE ser exatamente o nome de uma destas ferramentas, sem inventar nomes novos):",
            listaDeFerramentas,
            "",
            "Responda APENAS com um array JSON válido de etapas, sem texto adicional, sem explicações e sem blocos de código markdown.",
            "Cada item do array deve ter os campos: descricao (string), acao (string, nome exato de uma ferramenta), criterio_de_sucesso (string), depende_de (array de strings, pode ser vazio).",
        ].join("\n");
    }

    private _parsearPlano(resposta: string): EtapaPlano[] {
        const textoJson = resposta.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();

        let bruto: unknown;
        try {
            bruto = JSON.parse(textoJson);
        } catch (erro) {
            throw new Error(`Não foi possível interpretar o plano retornado pelo modelo como JSON: ${(erro as Error).message}\nResposta recebida: ${resposta}`);
        }

        if (!Array.isArray(bruto)) {
            throw new Error(`O plano retornado pelo modelo não é uma lista de etapas: ${textoJson}`);
        }

        return bruto.map((item, indice) => {
            if (typeof item !== "object" || item === null) {
                throw new Error(`Etapa ${indice} do plano não é um objeto válido: ${JSON.stringify(item)}`);
            }
            const etapa = item as Record<string, unknown>;
            if (typeof etapa.descricao !== "string" || typeof etapa.acao !== "string" || typeof etapa.criterio_de_sucesso !== "string") {
                throw new Error(`Etapa ${indice} do plano está incompleta: ${JSON.stringify(etapa)}`);
            }
            return {
                descricao: etapa.descricao,
                acao: etapa.acao,
                criterio_de_sucesso: etapa.criterio_de_sucesso,
                depende_de: Array.isArray(etapa.depende_de) ? etapa.depende_de.map(String) : [],
            };
        });
    }
}

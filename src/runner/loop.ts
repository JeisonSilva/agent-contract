import type Agent from "../agents-config/agent.js";
import type Executor from "./executor.js";
import type { ResultadoEtapa } from "./executor.js";
import type Planner from "./planner.js";
import type { EtapaPlano } from "./planner.js";
import { Annotation, START, END, StateGraph } from "@langchain/langgraph";

const state = Annotation.Root({
    mensagens: Annotation<string[]>({
        reducer: (acc, val) => acc.concat(val),
        default: () => []
    }),
    concluido: Annotation<boolean>({
        default: () => false,
        reducer: (_, val) => val === true
    }),
    // Marcado por um hook de início (ex: ausência de manifesto) para que os
    // demais nós façam early-exit num grafo linear, sem precisar de ciclos
    // ou arestas condicionais.
    interrompido: Annotation<boolean>({
        default: () => false,
        reducer: (_, val) => val === true
    }),
    interacoes: Annotation<number>({
        default: () => 0,
        reducer: (acc) => acc + 1
    }),
    plano: Annotation<EtapaPlano[]>({
        default: () => [],
        reducer: (_, val) => val
    }),
    resultados: Annotation<Array<{ etapa: EtapaPlano; resultado: ResultadoEtapa }>>({
        default: () => [],
        reducer: (_, val) => val
    }),
});

type EstadoCiclo = typeof state.State;

export type EntradaCiclo = {
    objetivo: string;
    caminhoDoProjeto: string;
};

export type ContextoCiclo = {
    planner: Planner;
    executor: Executor;
    agent: Agent;
    entrada: EntradaCiclo;
};

export type EtapaHandler = (
    estado: EstadoCiclo,
    contexto: ContextoCiclo
) => Promise<Partial<EstadoCiclo>> | Partial<EstadoCiclo>;

export type EtapaHandlers = Record<string, EtapaHandler>;

// As etapas do grafo vêm de loop.ciclo (agents/contracts/loop.md) em tempo de
// execução. Renomear/adicionar/remover etapas no markdown não exige mudanças
// aqui — só a tabela de handlers injetada precisa acompanhar os novos nomes.
export default class Loop {
    private _loopRoot: any;
    private _handlers: EtapaHandlers;

    constructor(loopRoot: any, handlers: EtapaHandlers = {}) {
        this._loopRoot = loopRoot;
        this._handlers = handlers;
    }

    injetarHandlers(handlers: EtapaHandlers): Loop {
        this._handlers = { ...this._handlers, ...handlers };
        return this;
    }

    async execute(planner: Planner, executor: Executor, agent: Agent, entrada: EntradaCiclo) {
        const contexto: ContextoCiclo = { planner, executor, agent, entrada };
        const etapas: string[] = this._loopRoot?.loop?.ciclo ?? [];

        if (etapas.length === 0) {
            console.warn("Nenhuma etapa encontrada em loop.ciclo; nada será executado.");
            return;
        }

        const grafo = new StateGraph(state);

        for (const etapa of etapas) {
            const handler = this._handlers[etapa] ?? this._handlerPadrao(etapa);
            grafo.addNode(etapa, async (estadoAtual: EstadoCiclo) => handler(estadoAtual, contexto));
        }

        let etapaAnterior: string = START;
        for (const etapa of etapas) {
            grafo.addEdge(etapaAnterior as any, etapa as any);
            etapaAnterior = etapa;
        }
        grafo.addEdge(etapaAnterior as any, END);

        const app = grafo.compile();
        const resultado = await app.invoke({ mensagens: [] });
        console.log("Resultado final do Loop:", resultado);
        return resultado;
    }

    private _handlerPadrao(etapa: string): EtapaHandler {
        return async () => {
            console.warn(`Nenhum handler injetado para a etapa "${etapa}"; ela será ignorada.`);
            return {};
        };
    }
}

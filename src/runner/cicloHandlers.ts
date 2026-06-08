import type { EtapaHandlers } from "./loop.js";

// Liga cada nome de etapa de loop.ciclo (agents/contracts/loop.md) à função
// que a executa. Esta tabela é o único lugar que precisa acompanhar o
// markdown: se uma etapa for renomeada, adicionada ou removida no contrato,
// ajuste as chaves aqui — o Loop em si permanece genérico.
export function criarHandlersDoCiclo(): EtapaHandlers {
    return {
        inicio: async (estado, { agent }) => {
            return { mensagens: [...estado.mensagens, "inicio"] };
        },

        planejar: async (estado, { planner }) => {
            return { mensagens: [...estado.mensagens, "planejar"] };
        },

        executar_proxima_etapa: async (estado, { executor }) => {
            return { mensagens: [...estado.mensagens, "executar_proxima_etapa"] };
        },

        validar_resultado: async (estado, { executor }) => {
            return { mensagens: [...estado.mensagens, "validar_resultado"] };
        },

        repetir_ou_finalizar: async (estado, { agent }) => {
            return { mensagens: [...estado.mensagens, "repetir_ou_finalizar"] };
        },
    };
}

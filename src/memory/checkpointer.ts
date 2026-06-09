import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

export async function criarCheckpointer(): Promise<PostgresSaver> {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL não configurada — memória de sessão desabilitada.");
    }
    const checkpointer = PostgresSaver.fromConnString(connectionString);
    await checkpointer.setup();
    return checkpointer;
}

// Transforma o caminho do projeto em um thread_id estável para o checkpointer.
// Mantém apenas caracteres alfanuméricos, hífens e underscores para garantir
// compatibilidade com o esquema interno do LangGraph.
export function gerarThreadId(caminhoDoProjeto: string): string {
    return caminhoDoProjeto.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
}

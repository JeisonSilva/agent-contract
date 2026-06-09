import pg from "pg";
import { OpenAIEmbeddings } from "@langchain/openai";

const { Pool } = pg;

// Dimensão do modelo text-embedding-3-small (padrão OpenAI para embeddings leves)
const DIMENSAO_EMBEDDING = 1536;

export type AnaliseArmazenada = {
    id: string;
    caminhoProjeto: string;
    conteudo: string;
    metadata: Record<string, unknown>;
    score: number;
};

export class VectorStoreDeAnalises {
    private _pool: pg.Pool;
    private _embeddings: OpenAIEmbeddings;

    constructor(pool: pg.Pool, embeddings: OpenAIEmbeddings) {
        this._pool = pool;
        this._embeddings = embeddings;
    }

    static async criar(): Promise<VectorStoreDeAnalises> {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error("DATABASE_URL não configurada — memória semântica desabilitada.");
        }
        const pool = new Pool({ connectionString });
        const embeddings = new OpenAIEmbeddings({
            apiKey: process.env.APIKEY ?? "",
            configuration: { baseURL: process.env.URL_BASE },
            model: "text-embedding-3-small",
        });
        const store = new VectorStoreDeAnalises(pool, embeddings);
        await store._inicializarEsquema();
        return store;
    }

    private async _inicializarEsquema(): Promise<void> {
        const client = await this._pool.connect();
        try {
            await client.query("CREATE EXTENSION IF NOT EXISTS vector");
            await client.query(`
                CREATE TABLE IF NOT EXISTS project_analyses (
                    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
                    caminho     TEXT        NOT NULL,
                    conteudo    TEXT        NOT NULL,
                    metadata    JSONB       NOT NULL DEFAULT '{}',
                    embedding   vector(${DIMENSAO_EMBEDDING}),
                    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            `);
            // Índice HNSW é mais adequado para buscas rápidas em tabelas menores
            await client.query(`
                CREATE INDEX IF NOT EXISTS project_analyses_embedding_hnsw
                ON project_analyses USING hnsw (embedding vector_cosine_ops)
            `);
        } finally {
            client.release();
        }
    }

    async salvar(
        caminhoProjeto: string,
        conteudo: string,
        metadata: Record<string, unknown> = {}
    ): Promise<string> {
        const vetores = await this._embeddings.embedDocuments([conteudo]);
        const vetor = vetores[0];
        if (!vetor) throw new Error("Falha ao gerar embedding para a análise.");

        const vetorStr = `[${vetor.join(",")}]`;
        const client = await this._pool.connect();
        try {
            const resultado = await client.query<{ id: string }>(
                `INSERT INTO project_analyses (caminho, conteudo, metadata, embedding)
                 VALUES ($1, $2, $3, $4::vector)
                 RETURNING id`,
                [caminhoProjeto, conteudo, JSON.stringify(metadata), vetorStr]
            );
            const linha = resultado.rows[0];
            if (!linha) throw new Error("Inserção na memória semântica não retornou ID.");
            return linha.id;
        } finally {
            client.release();
        }
    }

    async buscarSimilares(consulta: string, limite = 5): Promise<AnaliseArmazenada[]> {
        const vetores = await this._embeddings.embedDocuments([consulta]);
        const vetor = vetores[0];
        if (!vetor) throw new Error("Falha ao gerar embedding para a consulta.");

        const vetorStr = `[${vetor.join(",")}]`;
        const client = await this._pool.connect();
        try {
            const resultado = await client.query<{
                id: string;
                caminho: string;
                conteudo: string;
                metadata: Record<string, unknown>;
                score: number;
            }>(
                `SELECT id, caminho, conteudo, metadata,
                        1 - (embedding <=> $1::vector) AS score
                 FROM project_analyses
                 ORDER BY embedding <=> $1::vector
                 LIMIT $2`,
                [vetorStr, limite]
            );
            return resultado.rows.map((row) => ({
                id: row.id,
                caminhoProjeto: row.caminho,
                conteudo: row.conteudo,
                metadata: row.metadata,
                score: row.score,
            }));
        } finally {
            client.release();
        }
    }

    async fechar(): Promise<void> {
        await this._pool.end();
    }
}

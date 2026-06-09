import type Agent from "../agents-config/agent.js";
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import Loop, { type EntradaCiclo } from "./loop.js";
import Planner from "./planner.js";
import Executor from "./executor.js";
import ModeloIA from "../agents-config/modeloIA.js";
import { criarHandlersDoCiclo } from "./cicloHandlers.js";
import { criarFerramentas, criarChamadorDeApi, criarChamadorDeMcp, type ImplementacaoDeFerramenta } from "../agente/ferramentas.js";
import { criarImplementacoesDeHooks, montarRelatorioFinal } from "../agente/hooks.js";
import { criarCheckpointer } from "../memory/checkpointer.js";
import { VectorStoreDeAnalises } from "../memory/vectorStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default class ProcessoCognitivo {
    private _executorRoot: any;
    private _plannerRoot: any;
    private _loopRoot: any;
    private _toolboxRoot: any;
    private _hooksRoot: any;
    private _agent: Agent;


    constructor(agent: Agent) {
        this._agent = agent;
    }


    static CarregarProcessadorCognitivo(agent: Agent): ProcessoCognitivo {
        const processadorCognitivo = new ProcessoCognitivo(agent);
        processadorCognitivo
          .addExecutor()
          .addLoop()
          .addPlanner()
          .addToolBox()
          .addHooks()


        return processadorCognitivo;
    }
    private addToolBox(): ProcessoCognitivo {
        const caminhoToolBox = path.join(__dirname, '../../agents/contracts/toolbox.md');
        const arquivoYaml = fs.readFileSync(caminhoToolBox, 'utf8')
        const match = arquivoYaml.match(/```yaml([\s\S]*?)```/);
        const textoYaml = match?.[1];

        if(textoYaml){
            this._toolboxRoot = yaml.load(textoYaml) as any;
        } else {
            console.log("Nenhum bloco YAML encontrado.");
        }
        return this;
    }
    private addPlanner(): ProcessoCognitivo {
        const caminhoPlanner = path.join(__dirname, '../../agents/contracts/planner.md');
        const arquivoYaml = fs.readFileSync(caminhoPlanner, 'utf8')
        const match = arquivoYaml.match(/```yaml([\s\S]*?)```/);
        const textoYaml = match?.[1];

        if(textoYaml){
            this._plannerRoot = yaml.load(textoYaml) as any;
        } else {
            console.log("Nenhum bloco YAML encontrado.");
        }

        return this;
    }



    private addLoop(): ProcessoCognitivo {
        const caminhoLoop = path.join(__dirname, '../../agents/contracts/loop.md');
        const arquivoYaml = fs.readFileSync(caminhoLoop, 'utf8')
        const match = arquivoYaml.match(/```yaml([\s\S]*?)```/);
        const textoYaml = match?.[1];

        if(textoYaml){
            this._loopRoot = yaml.load(textoYaml) as any;
        } else {
            console.log("Nenhum bloco YAML encontrado.");
        }

        return this;
    }

    private addHooks(): ProcessoCognitivo {
        const caminhoHooks = path.join(__dirname, '../../agents/hooks.md');
        const arquivoYaml = fs.readFileSync(caminhoHooks, 'utf8')
        const match = arquivoYaml.match(/```yaml([\s\S]*?)```/);
        const textoYaml = match?.[1];

        if(textoYaml){
            this._hooksRoot = yaml.load(textoYaml) as any;
        } else {
            console.log("Nenhum bloco YAML encontrado.");
        }

        return this;
    }

    private addExecutor(): ProcessoCognitivo {
        const caminhoExecutor = path.join(__dirname, '../../agents/contracts/executor.md');
        const arquivoYaml = fs.readFileSync(caminhoExecutor, 'utf8')
        const match = arquivoYaml.match(/```yaml([\s\S]*?)```/);
        const textoYaml = match?.[1];

        if(textoYaml){
            this._executorRoot = yaml.load(textoYaml) as any;
        } else {
            console.log("Nenhum bloco YAML encontrado.");
        }

        return this;
    }

    // Varre o toolbox e cria implementações automáticas para qualquer ferramenta
    // que declare `api_config` (chamada HTTP genérica) ou `mcp_config` (servidor MCP).
    // Implementações manuais em criarFerramentas() sempre têm precedência.
    private _criarFeramentasExternas(): Record<string, ImplementacaoDeFerramenta> {
        const resultado: Record<string, ImplementacaoDeFerramenta> = {};
        for (const ferramenta of this._toolboxRoot?.toolbox?.ferramentas ?? []) {
            const nome = ferramenta?.nome as string | undefined;
            if (!nome) continue;

            const apiConfig = ferramenta?.api_config;
            if (typeof apiConfig?.url === "string") {
                resultado[nome] = criarChamadorDeApi(apiConfig);
                continue;
            }

            const mcpConfig = ferramenta?.mcp_config;
            if (mcpConfig?.transport && mcpConfig?.tool) {
                resultado[nome] = criarChamadorDeMcp(mcpConfig);
            }
        }
        return resultado;
    }

    async execute(entrada: EntradaCiclo) {
        const modeloIA = ModeloIA.configurarModeloIA();

        let checkpointer: Awaited<ReturnType<typeof criarCheckpointer>> | undefined;
        let vectorStore: VectorStoreDeAnalises | undefined;

        if (process.env.DATABASE_URL) {
            try {
                [checkpointer, vectorStore] = await Promise.all([
                    criarCheckpointer(),
                    VectorStoreDeAnalises.criar(),
                ]);
                console.log("Memória de sessão (PostgreSQL) e memória semântica (pgvector) inicializadas.");
            } catch (erro) {
                console.warn("Memória indisponível:", (erro as Error).message);
            }
        }

        const ferramentasExternas = this._criarFeramentasExternas();
        // Implementações manuais têm precedência sobre as geradas por api_config/mcp_config.
        const ferramentas = { ...ferramentasExternas, ...criarFerramentas(modeloIA, vectorStore) };
        const implementacoesDeHooks = criarImplementacoesDeHooks();

        const loop = new Loop(this._loopRoot, criarHandlersDoCiclo(ferramentas, this._hooksRoot, implementacoesDeHooks, montarRelatorioFinal));
        const planner = new Planner(this._plannerRoot, modeloIA);
        const executor = new Executor(this._executorRoot, this._toolboxRoot, ferramentas);

        await loop.execute(planner, executor, this._agent, entrada, checkpointer);
    }

}
import type Agent from "../agents-config/agent.js";
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import Loop from "./loop.js";
import Planner from "./planner.js";
import Executor from "./executor.js";
import { criarHandlersDoCiclo } from "./cicloHandlers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default class ProcessoCognitivo {    
    private _executorRoot: any;
    private _plannerRoot: any;
    private _loopRoot: any;
    private _toolboxRoot: any;
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

    async execute() {
        const loop = new Loop(this._loopRoot, criarHandlersDoCiclo());
        const planner = new Planner(this._plannerRoot);
        const executor = new Executor(this._executorRoot, this._toolboxRoot);
        
        await loop.execute(planner, executor, this._agent);
    }

}
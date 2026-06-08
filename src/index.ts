import Agent from "./agents-config/agent.js";
import ModeloIA from "./agents-config/modeloIA.js";
import ProcessoCognitivo from "./runner/processoCognitivo.js";

class Program{
    async execute(){
        const agent = Agent.CarregarAgent();
        const processadorCognitivo = ProcessoCognitivo.CarregarProcessadorCognitivo(agent);

        const entrada = {
            objetivo: agent.objetivo,
            caminhoDoProjeto: process.argv[2] ?? process.cwd(),
        };

        await processadorCognitivo.execute(entrada);

    }
}

const program = new Program();
program.execute();
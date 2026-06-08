import Agent from "./agents-config/agent.js";
import ModeloIA from "./agents-config/modeloIA.js";
import ProcessoCognitivo from "./runner/processoCognitivo.js";

class Program{
    async execute(){
        const agent = Agent.CarregarAgent();
        const processadorCognitivo = ProcessoCognitivo.CarregarProcessadorCognitivo(agent);

        await processadorCognitivo.execute();

    }
}

const program = new Program();
program.execute();
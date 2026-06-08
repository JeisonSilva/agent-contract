import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import type ModeloIA from './modeloIA.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default class Agent{
    private _agentRoot: any;
    private _skillsRoot: any;
    private _rolesRoot: any;
    
    static CarregarAgent(): Agent{
        const agent = new Agent();
        agent
          .addAgent()
          .addSkills()
          .addRoles()
        return agent;
    }
    

    private addAgent():Agent{
        const caminhoAgent = path.join(__dirname, '../../agents/AGENTS.md');
        const arquivoYaml = fs.readFileSync(caminhoAgent, 'utf8')
        const match = arquivoYaml.match(/```yaml([\s\S]*?)```/);
        const textoYaml = match?.[1];

        if(textoYaml){
            this._agentRoot = yaml.load(textoYaml) as any;
        } else {
            console.log("Nenhum bloco YAML encontrado.");
        }

        return this;
    }

    private addSkills(): Agent {
        const caminhoSkills = path.join(__dirname, '../../agents/skills.md');
        const arquivoYaml = fs.readFileSync(caminhoSkills, 'utf8')
        const match = arquivoYaml.match(/```yaml([\s\S]*?)```/);
        const textoYaml = match?.[1];

        if(textoYaml){
            this._skillsRoot = yaml.load(textoYaml) as any;
        } else {
            console.log("Nenhum bloco YAML encontrado.");
        }

        return this;
    }

    private addRoles(): Agent {
        const caminhoRoles = path.join(__dirname, '../../agents/roles.md');
        const arquivoYaml = fs.readFileSync(caminhoRoles, 'utf8')
        const match = arquivoYaml.match(/```yaml([\s\S]*?)```/);
        const textoYaml = match?.[1];

        if(textoYaml){
            this._rolesRoot = yaml.load(textoYaml) as any;
        } else {
            console.log("Nenhum bloco YAML encontrado.");
        }

        return this;
    }
}
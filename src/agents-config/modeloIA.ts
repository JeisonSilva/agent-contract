import dotenv from "dotenv";
dotenv.config();

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export default class ModeloIA {
    
    private model: ChatOpenAI;
    private _systemPrompt: 
    SystemMessage<import("@langchain/core/messages").MessageStructure<import("@langchain/core/messages").MessageToolSet>> | undefined;

    constructor(model: ChatOpenAI) {
        this.model = model;
    }

    static configurarModeloIA(): ModeloIA{
        const model = new ChatOpenAI({
            model: process.env.MODELO_IA || "",
            temperature: 0.9,
            configuration: {
                apiKey: process.env.APIKEY || "",
                baseURL: process.env.URL_BASE || "",
            }
        });
        return new ModeloIA(model);
    }

    addSystemMessage(descricao: string) {
        this._systemPrompt = new SystemMessage(descricao);
    }

    async perguntar(prompt: string): Promise<string> {
        const mensagens = this._systemPrompt
            ? [this._systemPrompt, new HumanMessage(prompt)]
            : [new HumanMessage(prompt)];

        const resposta = await this.model.invoke(mensagens);
        return typeof resposta.content === "string"
            ? resposta.content
            : JSON.stringify(resposta.content);
    }
}
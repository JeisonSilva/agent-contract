import dotenv from "dotenv";
dotenv.config();

import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";

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
}
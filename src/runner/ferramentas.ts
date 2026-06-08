import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { ContextoDeExecucao } from "./executor.js";
import type ModeloIA from "../agents-config/modeloIA.js";

export type Pacote = { nome: string; versao: string };
export type Manifesto = { arquivo: string; tipo: "npm" | "maven" | "pip"; caminhoCompleto: string };
export type Commit = { hash: string; autor: string; email: string; data: string; mensagem: string; arquivos: string[] };
export type Desenvolvedor = { autor: string; email: string; quantidade_commits: number };
export type Subdominio = { nome: string; justificativa: string; pastas_relacionadas?: string[] };
export type Dominio = { dominio: string; justificativa_dominio: string; subdominios: Subdominio[] };

const MANIFESTOS_CONHECIDOS: Array<{ arquivo: string; tipo: Manifesto["tipo"] }> = [
    { arquivo: "package.json", tipo: "npm" },
    { arquivo: "pom.xml", tipo: "maven" },
    { arquivo: "requirements.txt", tipo: "pip" },
];

// Reaproveitado pelo hook `validar-presenca-de-manifesto` — a mesma checagem
// usada para localizar o manifesto serve para confirmar sua existência.
export function localizarManifesto(caminhoDoProjeto: string): Manifesto | null {
    for (const manifesto of MANIFESTOS_CONHECIDOS) {
        const caminhoCompleto = path.join(caminhoDoProjeto, manifesto.arquivo);
        if (fs.existsSync(caminhoCompleto)) {
            return { ...manifesto, caminhoCompleto };
        }
    }
    return null;
}

async function lerManifestoDeDependencias(contexto: ContextoDeExecucao) {
    const manifesto = localizarManifesto(contexto.caminhoDoProjeto);
    if (!manifesto) {
        throw new Error(`Nenhum manifesto de dependências reconhecido em "${contexto.caminhoDoProjeto}"`);
    }

    if (manifesto.tipo === "npm") {
        const conteudo = JSON.parse(fs.readFileSync(manifesto.caminhoCompleto, "utf8"));
        const pacotes: Pacote[] = [
            ...Object.entries(conteudo.dependencies ?? {}),
            ...Object.entries(conteudo.devDependencies ?? {}),
        ].map(([nome, versao]) => ({ nome, versao: String(versao) }));

        return { manifesto: manifesto.arquivo, pacotes };
    }

    throw new Error(`Leitura do manifesto "${manifesto.arquivo}" (${manifesto.tipo}) ainda não implementada`);
}

const TAMANHO_MAXIMO_DO_README = 4000;
const PASTAS_IGNORADAS = new Set([
    "node_modules", ".git", "dist", "build", "out", "coverage", ".next", ".turbo", ".vscode", ".idea",
]);
const PASTAS_DE_CODIGO_FONTE = ["src", "lib", "app"];

function lerReadmeTruncado(caminhoDoProjeto: string): string | null {
    for (const nome of ["README.md", "readme.md", "Readme.md"]) {
        const caminhoCompleto = path.join(caminhoDoProjeto, nome);
        if (fs.existsSync(caminhoCompleto)) {
            const conteudo = fs.readFileSync(caminhoCompleto, "utf8");
            return conteudo.length > TAMANHO_MAXIMO_DO_README ? conteudo.slice(0, TAMANHO_MAXIMO_DO_README) + "\n[...truncado]" : conteudo;
        }
    }
    return null;
}

function listarSubpastas(caminho: string): string[] {
    if (!fs.existsSync(caminho)) return [];
    return fs.readdirSync(caminho, { withFileTypes: true })
        .filter((item) => item.isDirectory() && !PASTAS_IGNORADAS.has(item.name) && !item.name.startsWith("."))
        .map((item) => item.name);
}

// Coleta nomes de pastas de primeiro nível e, quando existir uma pasta de
// código-fonte conhecida (src/lib/app), mais um nível dentro dela — em bases
// organizadas por domínio (DDD) esses nomes costumam ecoar os subdomínios.
function coletarEstruturaDePastas(caminhoDoProjeto: string): string[] {
    const pastas: string[] = [];
    for (const nome of listarSubpastas(caminhoDoProjeto)) {
        pastas.push(nome);
        if (PASTAS_DE_CODIGO_FONTE.includes(nome)) {
            for (const subnome of listarSubpastas(path.join(caminhoDoProjeto, nome))) {
                pastas.push(`${nome}/${subnome}`);
            }
        }
    }
    return pastas;
}

function montarPromptDeDominio(sinais: { readme: string | null; manifesto: { nome?: string; descricao?: string; palavrasChave?: string[] } | null; pastas: string[] }): string {
    const linhas: string[] = [
        "Você está analisando um projeto de software para identificar seu DOMÍNIO DE NEGÓCIO e os SUBDOMÍNIOS DO PRODUTO.",
        "",
        "IMPORTANTE: domínio de negócio é o eixo de PROPÓSITO (o problema de negócio que o produto resolve), nunca o eixo TÉCNICO.",
        'Não confunda "domínio Financeiro" com "área backend": pacotes/dependências revelam a stack tecnológica, não o negócio.',
        "Exemplos do eixo correto:",
        '- domínio "Financeiro" com subdomínios "Investimentos", "Câmbio", "Pagamentos"',
        '- domínio "Gestão de Projetos" (ex: Kanban) com subdomínios "Análise de usuário", "Gestão de tempo", "Custo do projeto"',
        "",
        "Sinais disponíveis sobre o projeto:",
    ];

    if (sinais.readme) {
        linhas.push("--- Conteúdo do README ---", sinais.readme, "--- fim do README ---");
    } else {
        linhas.push("(Nenhum README encontrado.)");
    }

    if (sinais.manifesto) {
        linhas.push(
            "--- Dados do manifesto ---",
            `nome: ${sinais.manifesto.nome ?? "(não informado)"}`,
            `descrição: ${sinais.manifesto.descricao ?? "(não informada)"}`,
            `palavras-chave: ${(sinais.manifesto.palavrasChave ?? []).join(", ") || "(nenhuma)"}`,
            "--- fim do manifesto ---"
        );
    }

    linhas.push(
        "--- Estrutura de pastas (nível superior e um nível dentro de src/lib/app) ---",
        sinais.pastas.length > 0 ? sinais.pastas.join(", ") : "(nenhuma pasta relevante encontrada)",
        "--- fim da estrutura ---",
        "",
        "Com base SOMENTE nesses sinais de propósito (ignore o que a stack técnica sugere), responda com um JSON estrito no formato:",
        '{ "dominio": "...", "justificativa_dominio": "...", "subdominios": [ { "nome": "...", "justificativa": "...", "pastas_relacionadas": ["..."] } ] }',
        "Regras para a resposta:",
        "- Preencha \"pastas_relacionadas\" apenas quando a estrutura de pastas realmente sugerir aquele subdomínio (use os nomes EXATOS listados acima); omita ou deixe vazio quando não houver correspondência clara — não force uma relação que não existe.",
        "- Se o projeto não for um produto de negócio, mas sim uma ferramenta/framework/biblioteca, identifique isso como o domínio (ex: \"Plataforma para Agentes de IA\") e liste os subdomínios técnicos do próprio produto (ex: \"Execução de planos\", \"Catalogação de projetos\") com a mesma honestidade sobre pastas relacionadas.",
        "Responda APENAS com o JSON, sem texto adicional, sem explicações e sem blocos de código markdown."
    );

    return linhas.join("\n");
}

function parsearDominio(resposta: string): Dominio {
    const textoJson = resposta.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();

    let bruto: unknown;
    try {
        bruto = JSON.parse(textoJson);
    } catch (erro) {
        throw new Error(`Não foi possível interpretar o domínio retornado pelo modelo como JSON: ${(erro as Error).message}\nResposta recebida: ${resposta}`);
    }

    if (typeof bruto !== "object" || bruto === null) {
        throw new Error(`O domínio retornado pelo modelo não é um objeto válido: ${textoJson}`);
    }

    const objeto = bruto as Record<string, unknown>;
    if (typeof objeto.dominio !== "string" || typeof objeto.justificativa_dominio !== "string" || !Array.isArray(objeto.subdominios)) {
        throw new Error(`Resposta de domínio está incompleta: ${JSON.stringify(objeto)}`);
    }

    const subdominios: Subdominio[] = objeto.subdominios.map((item, indice) => {
        if (typeof item !== "object" || item === null) {
            throw new Error(`Subdomínio ${indice} não é um objeto válido: ${JSON.stringify(item)}`);
        }
        const subdominio = item as Record<string, unknown>;
        if (typeof subdominio.nome !== "string" || typeof subdominio.justificativa !== "string") {
            throw new Error(`Subdomínio ${indice} está incompleto: ${JSON.stringify(subdominio)}`);
        }
        const pastasRelacionadas = Array.isArray(subdominio.pastas_relacionadas) ? subdominio.pastas_relacionadas.map(String) : undefined;
        return {
            nome: subdominio.nome,
            justificativa: subdominio.justificativa,
            ...(pastasRelacionadas ? { pastas_relacionadas: pastasRelacionadas } : {}),
        };
    });

    return { dominio: objeto.dominio, justificativa_dominio: objeto.justificativa_dominio, subdominios };
}

function criarIdentificadorDeDominioDoProjeto(modeloIA: ModeloIA): ImplementacaoDeFerramenta {
    return async (contexto: ContextoDeExecucao) => {
        const readme = lerReadmeTruncado(contexto.caminhoDoProjeto);

        let manifesto: { nome?: string; descricao?: string; palavrasChave?: string[] } | null = null;
        const manifestoLocalizado = localizarManifesto(contexto.caminhoDoProjeto);
        if (manifestoLocalizado?.tipo === "npm") {
            const conteudo = JSON.parse(fs.readFileSync(manifestoLocalizado.caminhoCompleto, "utf8"));
            manifesto = { nome: conteudo.name, descricao: conteudo.description, palavrasChave: conteudo.keywords };
        }

        const pastas = coletarEstruturaDePastas(contexto.caminhoDoProjeto);

        const prompt = montarPromptDeDominio({ readme, manifesto, pastas });
        const resposta = await modeloIA.perguntar(prompt);
        return parsearDominio(resposta);
    };
}

const TRES_MESES_EM_DIAS = 90;

function calcularJanelaDeTresMeses(): { dataInicio: string; dataFim: string } {
    const fim = new Date();
    const inicio = new Date(fim.getTime() - TRES_MESES_EM_DIAS * 24 * 60 * 60 * 1000);
    const formatar = (data: Date) => data.toISOString().slice(0, 10);
    return { dataInicio: formatar(inicio), dataFim: formatar(fim) };
}

// Faz o parse da saída de `git log --pretty=format:"%H|%an|%ae|%ad|%s" --name-only`:
// blocos separados por linha em branco, onde a 1ª linha é o cabeçalho
// `hash|autor|email|data|assunto` e as demais são os arquivos alterados.
function interpretarSaidaDoGitLog(saida: string): Commit[] {
    const blocos = saida.split(/\n\s*\n/).map((bloco) => bloco.trim()).filter(Boolean);

    return blocos.map((bloco) => {
        const [linhaDeCabecalho, ...linhasDeArquivos] = bloco.split("\n");
        const [hash, autor, email, data, ...resto] = (linhaDeCabecalho ?? "").split("|");
        return {
            hash: hash ?? "",
            autor: autor ?? "",
            email: email ?? "",
            data: data ?? "",
            mensagem: resto.join("|"),
            arquivos: linhasDeArquivos.map((linha) => linha.trim()).filter(Boolean),
        };
    });
}

async function listarCommitsPorPeriodo(contexto: ContextoDeExecucao) {
    const { dataInicio, dataFim } = calcularJanelaDeTresMeses();

    const saida = execFileSync(
        "git",
        ["log", `--since=${dataInicio}`, `--until=${dataFim}`, "--pretty=format:%H|%an|%ae|%ad|%s", "--date=short", "--name-only"],
        { cwd: contexto.caminhoDoProjeto, encoding: "utf8" }
    );

    const commits = interpretarSaidaDoGitLog(saida);
    return { periodo: { dataInicio, dataFim }, commits };
}

async function identificarDesenvolvedoresAtivos(contexto: ContextoDeExecucao) {
    const resultadoAnterior = contexto.resultadosAnteriores["listar_commits_por_periodo"];
    if (!resultadoAnterior?.commits) {
        throw new Error('Nenhum resultado de "listar_commits_por_periodo" disponível para identificar desenvolvedores ativos.');
    }

    const commits: Commit[] = resultadoAnterior.commits;
    const porEmail = new Map<string, Desenvolvedor>();

    for (const commit of commits) {
        const chave = commit.email || commit.autor;
        const existente = porEmail.get(chave);
        if (existente) {
            existente.quantidade_commits += 1;
        } else {
            porEmail.set(chave, { autor: commit.autor, email: commit.email, quantidade_commits: 1 });
        }
    }

    return { desenvolvedores: [...porEmail.values()] };
}

async function listarArquivosAlteradosPorAutor(contexto: ContextoDeExecucao) {
    const commitsResultado = contexto.resultadosAnteriores["listar_commits_por_periodo"];
    const desenvolvedoresResultado = contexto.resultadosAnteriores["identificar_desenvolvedores_ativos"];
    if (!commitsResultado?.commits || !desenvolvedoresResultado?.desenvolvedores) {
        throw new Error('Resultados de "listar_commits_por_periodo" e "identificar_desenvolvedores_ativos" são necessários para listar arquivos alterados por autor.');
    }

    const commits: Commit[] = commitsResultado.commits;
    const desenvolvedores: Desenvolvedor[] = desenvolvedoresResultado.desenvolvedores;

    // O toolbox declara `autor: string` no singular, mas o plano gerado tem
    // uma única etapa para esta ação (o planejador não conhece os nomes dos
    // desenvolvedores de antemão). Adaptação deliberada: percorremos aqui,
    // internamente, todos os desenvolvedores ativos e devolvemos o
    // mapeamento completo numa única chamada.
    const arquivosPorDesenvolvedor: Record<string, string[]> = {};
    for (const desenvolvedor of desenvolvedores) {
        const arquivosUnicos = new Set<string>();
        for (const commit of commits) {
            if (commit.email === desenvolvedor.email) {
                for (const arquivo of commit.arquivos) arquivosUnicos.add(arquivo);
            }
        }
        arquivosPorDesenvolvedor[desenvolvedor.autor] = [...arquivosUnicos];
    }

    return { arquivos_por_desenvolvedor: arquivosPorDesenvolvedor };
}

export type ImplementacaoDeFerramenta = (contexto: ContextoDeExecucao) => Promise<any>;

// Apenas as ferramentas com implementação real entram aqui. As demais do
// toolbox.md permanecem só declarativas — o Executor reporta "não
// implementada" para elas, em vez de inventar um resultado.
export function criarFerramentas(modeloIA: ModeloIA): Record<string, ImplementacaoDeFerramenta> {
    return {
        ler_manifesto_de_dependencias: lerManifestoDeDependencias,
        identificar_dominio_do_projeto: criarIdentificadorDeDominioDoProjeto(modeloIA),
        listar_commits_por_periodo: listarCommitsPorPeriodo,
        identificar_desenvolvedores_ativos: identificarDesenvolvedoresAtivos,
        listar_arquivos_alterados_por_autor: listarArquivosAlteradosPorAutor,
    };
}

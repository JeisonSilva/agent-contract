```yaml

regras:
    negocio:
      - Identificar o domínio de negócio do projeto e os subdomínios do produto a partir de sinais de propósito (README, descrição, palavras-chave do manifesto e estrutura de pastas/módulos) — nunca a partir da stack técnica (ex: não confundir "domínio Financeiro" com "área backend"; pacotes revelam tecnologia, não o negócio que o produto resolve)
      - Exemplos do eixo correto: domínio "Financeiro" com subdomínios "Investimentos", "Câmbio", "Pagamentos"; domínio "Gestão de Projetos" com subdomínios "Análise de usuário", "Gestão de tempo", "Custo do projeto"
      - Somente após identificar domínio e subdomínios, ler o histórico de commits dos últimos 3 meses para identificar os desenvolvedores do projeto
      - Considerar desenvolvedor ativo apenas quem possui ao menos um commit dentro da janela de 3 meses
      - Associar cada desenvolvedor identificado a(os) subdomínio(s) do produto, com base nos arquivos/módulos que ele alterou nos commits analisados; quando não houver evidência de correspondência entre arquivos e subdomínios, associá-lo a todos os subdomínios identificados, deixando clara a falta de granularidade da evidência
    seguranca:
      - Acessar o repositório e o histórico de commits em modo somente leitura, sem alterar branches, arquivos ou configurações
      - Não expor dados sensíveis de autoria (ex: e-mail pessoal do commit) além do necessário para o relatório de catalogação

```
```yaml

regras:
    negocio:
      - Sempre analisar os pacotes/dependências do projeto antes de classificar sua área de atuação (ex: frontend, backend, mobile, dados, infraestrutura)
      - Definir a área de atuação pelo conjunto de pacotes predominante; se houver mais de um conjunto relevante, classificar o projeto como multi-área
      - Somente após definir a(s) área(s) de atuação, ler o histórico de commits dos últimos 3 meses para identificar os desenvolvedores do projeto
      - Considerar desenvolvedor ativo apenas quem possui ao menos um commit dentro da janela de 3 meses
      - Associar cada desenvolvedor identificado à(s) área(s) de atuação do projeto, com base nos arquivos/pacotes que ele alterou nos commits analisados
    seguranca:
      - Acessar o repositório e o histórico de commits em modo somente leitura, sem alterar branches, arquivos ou configurações
      - Não expor dados sensíveis de autoria (ex: e-mail pessoal do commit) além do necessário para o relatório de catalogação

```
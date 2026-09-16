# idleDEX Calculator V12

Calculadora web de apoio para o idleDEX, com foco em captura, XP, Silver e evolução.

## Estrutura

- `index.html` — interface.
- `style.css` — tema responsivo/dark.
- `app.js` — lógica da aplicação.
- `data/idledex-data.json` — dataset separado da interface.

## Atualização de dados

A aplicação foi desenhada para que o dataset possa ser substituído sem alterar a interface. A Wiki oficial do idleDEX informa que seus dados são gerados a partir dos arquivos do jogo a cada release.

**Importante:** os campos de combate/rendimento que ainda não possuem dados oficiais confirmados não devem ser tratados como valores reais do jogo. A próxima etapa da V12 é ampliar o dataset com dados completos e verificáveis de mapas, encontros, níveis, XP e recompensas.

## Objetivos da V12

1. Busca de Pokémon e mapas por chance de encontro.
2. Planejamento de XP por faixa de nível.
3. Cálculo de Silver usando os valores reais informados pelo jogador.
4. Planejamento de evolução.
5. Dataset desacoplado para facilitar atualizações futuras.

## Rodando localmente

Como o app usa `fetch()` para carregar o JSON, abra por um servidor local em vez de clicar diretamente no `index.html`.

Exemplo com VS Code + Live Server ou qualquer servidor HTTP estático.

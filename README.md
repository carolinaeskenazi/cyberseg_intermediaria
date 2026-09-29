# Privacy Guard — Extensão Firefox para detecção de rastreadores

Extensão para Firefox (WebExtension, Manifest V2) que detecta e apresenta, por página, mecanismos de rastreamento e violação de privacidade no cliente web: conexões a terceiros, cookies, armazenamento HTML5, canvas fingerprinting, cookie sync / bounce tracking e indicadores de hijacking/hook. Também calcula uma pontuação de privacidade e permite bloquear domínios com uma lista personalizada.

Avaliação Intermediária de Cibersegurança — Insper.

## Instalação (about:debugging)

1. Clone o repositório:
   ```bash
   git clone https://github.com/carolinaeskenazi/cyberseg_intermediaria.git
   ```
2. No Firefox, acesse `about:debugging#/runtime/this-firefox`.
3. Clique em **Carregar extensão temporária...** (*Load Temporary Add-on...*).
4. Selecione o arquivo `privacy-guard/manifest.json`.
5. O ícone **Privacy Guard** aparece na barra de ferramentas. Navegue até uma página, aguarde o carregamento e clique no ícone para ver o relatório.

> A extensão temporária é removida ao fechar o Firefox; repita o passo 3 para carregá-la novamente.
> Para ver os logs do background, clique em **Inspecionar** ao lado da extensão em `about:debugging`.

## Estrutura

```
privacy-guard/
├── manifest.json               # permissões, scripts e popup
├── background/background.js    # webRequest: terceiros, redirects, parâmetros, cookies, blocklist
├── content/content.js          # storage HTML5 por frame; injeta o monitor na página
├── content/canvas-monitor.js   # roda no contexto da página: hooks de Canvas e WebSocket
├── popup/                      # interface (relatório por página + blocklist)
└── evidencias/
    ├── ddg/                    # prints do plugin nas DuckDuckGo Privacy Test Pages
    ├── har/                    # HARs exportados do DevTools (globo, mercadolivre, youcom)
    └── sites/site-{1,2,3}/     # prints do plugin, Blacklight e uBlock Origin por site
```

## O que é detectado e como

| Detecção | Técnica |
|---|---|
| **Domínios de terceira parte** | `webRequest.onBeforeRequest` em todas as requisições da aba. Um domínio é de terceira parte quando não é igual nem subdomínio do domínio do documento principal. O popup lista cada domínio com o número de requisições. |
| **Cookies** | `cookies.getAll()` para a URL da página e para cada domínio terceiro observado. Classificação em **primeira/terceira parte** (domínio do cookie × domínio da página) e **sessão/persistente** (atributo `session`, ou seja, sem `Expires`/`Max-Age`). |
| **Storage HTML5** | O content script roda em todos os frames (`all_frames`) e informa `localStorage`, `sessionStorage` e `IndexedDB` (`indexedDB.databases()`) de cada contexto, indicando quando o acesso está bloqueado (útil para *storage partitioning/blocking*). |
| **Canvas fingerprinting** | Script injetado no contexto da página sobrescreve `HTMLCanvasElement.prototype.toDataURL`, `toBlob` e `CanvasRenderingContext2D.prototype.getImageData`, registrando cada chamada com timestamp e stack trace (visível no tooltip do popup). |
| **Cookie sync** | Parâmetros de URL com nome típico de identificador (`uid`, `client_id`, `gclid`, `fbclid`...) ou valor com aparência de ID (≥16 caracteres alfanuméricos). Quando o **mesmo valor** aparece em requisições para **domínios diferentes**, é sinalizado como possível sincronização. |
| **Bounce tracking** | Histórico de navegações do `main_frame`: o padrão **A → B → A** em até 30 s, ou um redirect HTTP entre domínios no documento principal, é sinalizado. Identificadores `bounceUid*` nos parâmetros também são exibidos. |
| **Hijacking / hook** | O construtor `WebSocket` é interceptado; conexões WebSocket para domínio de terceira parte são tratadas como **indicador** de canal de comando e controle (ex.: hook do BeEF). |
| **Lista de bloqueio** | Domínios adicionados no popup são salvos em `storage.local` e bloqueados em `onBeforeRequest` (`cancel: true`), incluindo subdomínios. |

## Pontuação de privacidade

A página começa com **100 pontos** e perde pontos por critério. A soma das penalidades máximas é 100, então o score fica entre 0 e 100. O cálculo está em `calculatePrivacyScore()` (`popup/popup.js`), e o popup mostra o detalhamento em "Ver cálculo".

| Critério | Faixas | Penalidade máx. | Justificativa |
|---|---|---|---|
| Domínios de terceira parte | 1–5: −5 · 6–10: −10 · 11–20: −15 · ≥21: −20 | **20** | Cada terceiro recebe IP, User-Agent e Referer do usuário. É o critério de maior peso porque é a base de todos os outros tipos de rastreamento. Faixas em vez de valor linear porque páginas grandes carregam dezenas de CDNs. |
| Cookies de terceira parte | 1–2: −5 · 3–5: −10 · ≥6: −15 | **15** | Permitem reconhecer o usuário entre sites diferentes (rastreamento cross-site clássico). |
| Cookies persistentes | 1–10: −3 · 11–30: −6 · ≥31: −10 | **10** | Mantêm o identificador entre sessões. Peso menor porque muitos são funcionais (login, preferências). |
| Storage HTML5 (frame principal) | localStorage −4 · IndexedDB −4 · sessionStorage −2 | **10** | Pode guardar identificadores fora do controle de cookies. sessionStorage pesa menos porque é apagado ao fechar a aba. |
| Canvas fingerprinting | presença | **15** | Identifica o dispositivo sem armazenar nada no cliente e sobrevive à limpeza de cookies, o que o torna difícil de evitar. |
| Cookie sync | presença | **15** | Indica troca explícita de identificadores entre empresas, juntando perfis de rastreadores diferentes. |
| Bounce tracking | presença | **10** | Contorna o bloqueio de cookies de terceiros ao passar o usuário por um domínio rastreador como primeira parte. |
| WebSocket para terceiro (hook) | presença | **5** | Peso baixo porque é apenas um indicador: chats e notificações legítimos também usam WebSocket. |

Canvas, cookie sync e bounce são binários (presença/ausência) porque uma única ocorrência já basta para identificar ou ligar o usuário; a quantidade não aumenta muito o risco.

## Evidências

- **DuckDuckGo Privacy Test Pages** (`evidencias/ddg/`): Tracker Reporting (img, script, fetch), Tracker Blocking, Storage Blocking, Storage Partitioning, Canvas Fingerprinting, Bounce Tracking e Query Parameters.
- **Sites reais** (`evidencias/har/` e `evidencias/sites/`):
  - site-1: youcom.com.br
  - site-2: globo.com
  - site-3: mercadolivre.com.br

  Para cada site: HAR exportado do DevTools, prints do plugin, relatório do Blacklight (The Markup) e bloqueios do uBlock Origin.

A tabela do DDG (esperado × obtido × explicação), a reconciliação com Blacklight/uBlock e a comparação do score estão no relatório em PDF.

## Limitações conhecidas

- A terceira parte é definida por hostname, não por domínio registrável (eTLD+1). CDNs do próprio site (ex.: `glbimg.com` para a Globo, `mlstatic.com` para o Mercado Livre) contam como terceira parte.
- A contagem de cookies lê o *cookie jar* atual, então inclui cookies de visitas anteriores. Cookies particionados pela Total Cookie Protection do Firefox não são lidos sem `partitionKey`, o que pode subcontar os cookies de terceira parte.
- Detecções de canvas, cookie sync, bounce e hook são **heurísticas** ("Possível"): `getImageData` e WebSocket têm usos legítimos, e redirects entre domínios do mesmo grupo podem ser sinalizados como bounce.
- O monitor de canvas é carregado por `<script src>`, então scripts inline executados antes dele não são observados.

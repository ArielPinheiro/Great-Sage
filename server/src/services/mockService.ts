/**
 * Mock streaming service for testing without an LLM API key.
 * Streams clean, professional simulated responses with realistic delays.
 */

const MOCK_CHAT_RESPONSES = [
  `Esta é uma resposta do modo de demonstração local.

A interface de chat e o pipeline de streaming estão funcionando perfeitamente.

Para ativar as respostas completas geradas por inteligência artificial em tempo real:
1. Configure a variável \`GEMINI_API_KEY\` no arquivo \`.env\` na raiz do projeto.
2. O servidor detectará a chave e passará a utilizar a API do Google Gemini.`,

  `O sistema está pronto para atender suas solicitações.

Atualmente você está visualizando uma mensagem de teste do ambiente local. A transmissão em tempo real, a formatação em Markdown e o cancelamento de mensagens estão operacionais.

Basta configurar sua chave de API no arquivo \`.env\` para conversar diretamente com o modelo de IA.`,

  `Mensagem recebida com sucesso.

O fluxo de dados da interface e a comunicação com o servidor foram concluídos normalmente.

Para enviar consultas a um modelo de linguagem em produção, adicione sua \`GEMINI_API_KEY\` no arquivo \`.env\`.`,
];

const MOCK_ANALYSIS_RESPONSES = [
  `**Resumo**
O material enviado foi analisado. Trata-se de uma implementação modular com boa separação de responsabilidades e estrutura clara de controle de fluxo.

**Pontos fortes**
- Separação adequada entre rotas, regras de negócio e serviços.
- Tipagem estática consistente nos módulos principais.
- Suporte a fluxos assíncronos e tratamento de cancelamento.

**Falhas e riscos**
- Necessidade de monitoramento de timeouts em chamadas externas.
- Garantir que limites de payload e rate limit estejam sempre calibrados.

**Próximos passos**
1. Adicionar testes automatizados para os fluxos principais.
2. Validar variáveis de ambiente logo na inicialização.
3. Acompanhar métricas de latência e consumo de tokens.

**Nível de confiança**
Alto. O código analisado apresenta estrutura organizada e permite análise determinística.`,
];

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new DOMException('Aborted', 'AbortError'));
    }
    const timer = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        },
        { once: true },
      );
    }
  });
}

/**
 * Creates an async generator that yields mock chunks with realistic timing.
 * Yields SSE formatted strings:
 *   data: {"content":"..."}\n\n
 *   data: [DONE]\n\n
 */
export async function* createMockStream(
  userMessage: string,
  mode: 'chat' | 'analysis' = 'chat',
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const responses =
    mode === 'analysis' ? MOCK_ANALYSIS_RESPONSES : MOCK_CHAT_RESPONSES;

  const idx =
    Math.abs(
      userMessage.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0),
    ) % responses.length;
  const fullText = responses[idx];

  // Split into word chunks of ~2-4 words
  const words = fullText.split(/(\s+)/);
  const chunks: string[] = [];
  let buffer = '';
  let wordCount = 0;
  const chunkSize = 3;

  for (const word of words) {
    buffer += word;
    if (word.trim().length > 0) wordCount++;
    if (wordCount >= chunkSize) {
      chunks.push(buffer);
      buffer = '';
      wordCount = 0;
    }
  }
  if (buffer.length > 0) chunks.push(buffer);

  for (const chunk of chunks) {
    if (signal?.aborted) return;

    const payload = JSON.stringify({ content: chunk });
    yield `data: ${payload}\n\n`;

    const delay = 30 + Math.random() * 30;
    try {
      await sleep(delay, signal);
    } catch {
      return;
    }
  }

  if (!signal?.aborted) {
    yield 'data: [DONE]\n\n';
  }
}

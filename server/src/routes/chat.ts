import { Router, Request, Response } from 'express';

export const chatRouter = Router();

// Placeholder — will be fully implemented in Etapa 4
chatRouter.post('/chat', async (req: Request, res: Response) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Campo "message" é obrigatório.' });
    return;
  }

  // For Etapa 1: echo response to verify connectivity
  res.json({
    role: 'assistant',
    content: `《Grande Sábio》Análise: mensagem recebida — "${message}". Integração com LLM será ativada na Etapa 4.`,
  });
});

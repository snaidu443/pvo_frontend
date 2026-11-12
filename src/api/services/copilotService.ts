import { isMock } from '../../config/env';
import { endpoints } from '../endpoints';
import { http } from '../httpClient';
import { respond } from '../mock/mockDb';

export interface CopilotAnswer {
  text: string;
  /** Source citations returned by the AgentCore summarizer (API mode). */
  citations?: { title: string; url?: string }[];
}

export const copilotService = {
  /**
   * Mock: answers with the rule-based PolicyPilot (`localAnswer`).
   * API: POST /copilot/ask; the backend runs guardrails, the orchestrator and the summarizer.
   * `assetId` gives the agents context; send no other client data.
   */
  ask(question: string, assetId: string | null, localAnswer: () => string): Promise<CopilotAnswer> {
    const q = question.trim().slice(0, 300);
    if (!isMock()) return http.post<CopilotAnswer>(endpoints.copilot.ask, { question: q, assetId });
    return respond({ text: localAnswer() });
  }
};

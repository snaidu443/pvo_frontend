import { isMock } from '../../config/env';
import { endpoints } from '../endpoints';
import { http } from '../httpClient';
import { db, persist, respond, upsert } from '../mock/mockDb';
import type { ExtractedField, JudgmentQuestion } from '../../types/domain';

export const inputsService = {
  /** Replace the full set of extracted fields for an asset (after extraction or indication changes). */
  replaceFields(assetId: string, fields: ExtractedField[]): Promise<ExtractedField[]> {
    if (!isMock()) return http.put<ExtractedField[]>(endpoints.inputs.fieldsForAsset(assetId), fields);
    db.fields = db.fields.filter(f => f.assetId !== assetId).concat(structuredClone(fields));
    persist();
    return respond(fields);
  },

  updateField(field: ExtractedField): Promise<ExtractedField> {
    if (!isMock()) return http.patch<ExtractedField>(endpoints.inputs.field(field.id), field);
    const saved = upsert(db.fields, field, f => f.id);
    persist();
    return respond(saved);
  },

  replaceQuestions(assetId: string, questions: JudgmentQuestion[]): Promise<JudgmentQuestion[]> {
    if (!isMock()) return http.put<JudgmentQuestion[]>(endpoints.inputs.questionsForAsset(assetId), questions);
    db.questions = db.questions.filter(q => q.assetId !== assetId).concat(structuredClone(questions));
    persist();
    return respond(questions);
  },

  updateQuestion(question: JudgmentQuestion): Promise<JudgmentQuestion> {
    if (!isMock()) return http.patch<JudgmentQuestion>(endpoints.inputs.question(question.id), question);
    const saved = upsert(db.questions, question, q => q.id);
    persist();
    return respond(saved);
  },

  /** Triggers AI extraction on the backend. Mock: extraction is simulated on the client. */
  extract(assetId: string): Promise<void> {
    if (!isMock()) return http.post(endpoints.inputs.extract(assetId));
    return respond(undefined);
  }
};

import { endpoints } from '../endpoints';
import { http } from '../httpClient';
import type { ExtractedField, JudgmentQuestion } from '../../types/domain';

/** structx.sqlite has no starter fields or questions: the API accepts an empty list and refuses anything else. Values are saved with the asset. */
export const inputsService = {
  replaceFields(assetId: string, fields: ExtractedField[]): Promise<ExtractedField[]> {
    return http.put<ExtractedField[]>(endpoints.inputs.fieldsForAsset(assetId), fields);
  },

  updateField(field: ExtractedField): Promise<ExtractedField> {
    return http.patch<ExtractedField>(endpoints.inputs.field(field.id), field);
  },

  replaceQuestions(assetId: string, questions: JudgmentQuestion[]): Promise<JudgmentQuestion[]> {
    return http.put<JudgmentQuestion[]>(endpoints.inputs.questionsForAsset(assetId), questions);
  },

  updateQuestion(question: JudgmentQuestion): Promise<JudgmentQuestion> {
    return http.patch<JudgmentQuestion>(endpoints.inputs.question(question.id), question);
  }
};

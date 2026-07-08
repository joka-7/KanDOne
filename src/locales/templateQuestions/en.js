import { TEMPLATES } from '../../data/interviewTemplates.js';
import { TASK_TEMPLATES } from '../../data/taskTemplates.js';

export const interviewQuestions = Object.fromEntries(
  Object.entries(TEMPLATES).map(([key, cat]) => [key, [...cat.questions]]),
);

export const taskQuestions = Object.fromEntries(
  Object.entries(TASK_TEMPLATES).map(([key, cat]) => [key, [...cat.questions]]),
);

export const noSearchResults = 'No questions match your search.';

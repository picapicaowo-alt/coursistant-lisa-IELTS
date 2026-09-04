import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {isRecord} from '@/utils/apiError';
import {QuestionPreview} from './QuestionPreview';
import {newQuestion} from './model';
import {contentErrors, QUESTION_TYPES, type Field} from './questionSchema';

// Populate the same typed fields as the editor, then exercise the actual
// student renderers. This catches drift between each dropdown and its preview.
function example(field: Field, nextId: () => number, index = 0): unknown {
  switch (field.type) {
    case 'text':
      return `${String.fromCharCode(65 + index)}. Example`;
    case 'number':
      return field.questionId ? nextId() : 1;
    case 'choice':
      return field.choices[0];
    case 'object':
      return Object.fromEntries(
        Object.entries(field.fields).map(([key, item]) => [
          key,
          example(item, nextId, index),
        ]),
      );
    case 'list':
      return Array.from({length: field.min ?? 1}, (_, position) =>
        example(field.item, nextId, position),
      );
    case 'variant': {
      const type =
        'gap' in field.variants ? 'gap' : Object.keys(field.variants)[0];
      const content = example(field.variants[type], nextId, index);
      return {type, ...(isRecord(content) ? content : {})};
    }
  }
}

describe('all guided question types', () => {
  it('keeps official alternatives out of the student preview and takes one response string', () => {
    const content = {questions: [{id: 9, prompt: 'What material?', answers: ['cow dung', 'dung cow']}]};
    const question = {...newQuestion(), kind: 'shortAnswer', start: '9', end: '9', payload: JSON.stringify(content)};
    const {container} = render(<QuestionPreview subject="reading" question={question} />);
    const input = screen.getByRole('textbox', {name: 'Question 9'});
    expect(input).toHaveValue('');
    expect(container).not.toHaveTextContent('cow dung');
    expect(container).not.toHaveTextContent('dung cow');
    fireEvent.change(input, {target: {value: 'Student response'}});
    expect(input).toHaveValue('Student response');
    expect(JSON.parse(question.payload)).toEqual(content);
  });
  for (const subject of ['listening', 'reading'] as const) {
    for (const definition of QUESTION_TYPES[subject]) {
      if (!('schema' in definition) || !definition.schema) continue;
      const schema = definition.schema;
      it(`validates and renders ${subject} ${definition.kind}`, () => {
        let id = 1;
        const content = example(schema, () => id++);
        expect(contentErrors(subject, definition.kind, content)).toEqual([]);
        const {container} = render(
          <QuestionPreview
            subject={subject}
            question={{
              ...newQuestion(),
              kind: definition.kind,
              title: 'Preview test',
              start: '1',
              end: String(id - 1),
              payload: JSON.stringify(content),
            }}
          />,
        );
        expect(
          screen.getByRole('heading', {name: 'Preview test'}),
        ).toBeVisible();
        expect(container.querySelector('input, select, button')).not.toBeNull();
      });
    }
  }
});

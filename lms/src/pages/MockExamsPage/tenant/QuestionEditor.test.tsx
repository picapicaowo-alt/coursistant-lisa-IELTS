import {useState} from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {QuestionEditor} from './QuestionEditor';
import {newQuestion, type QuestionDraft} from './model';
import {PassageEditor} from './PassageEditor';
import {ContentFields} from './ContentFields';
import type {Field} from './questionSchema';

function Editor({initial = newQuestion()}: {initial?: QuestionDraft}) {
  const [question, setQuestion] = useState(initial);
  return (
    <>
      <QuestionEditor
        subject="listening"
        question={question}
        onChange={(patch) => setQuestion((current) => ({...current, ...patch}))}
        suggestedNumber={1}
      />
      <output data-testid="question">{JSON.stringify(question)}</output>
    </>
  );
}
describe('friendly question editor', () => {
  it('retains a cell value and blank number through display mode changes', () => {
    const field: Field = {
      type: 'variant',
      label: 'Cell',
      variants: {
        text: {
          type: 'object',
          label: 'Text',
          fields: {value: {type: 'text', label: 'Cell text'}},
        },
        gap: {
          type: 'object',
          label: 'Blank',
          fields: {
            id: {type: 'number', label: 'Question number', questionId: true},
          },
        },
      },
    };
    const original = {
      type: 'gap',
      id: 7,
      value: 'Keep this text',
      answer: ['Keep this answer'],
    };
    let changed: unknown;
    render(
      <ContentFields
        field={field}
        value={original}
        nextNumber={() => 99}
        onChange={(next) => {
          changed = next;
        }}
      />,
    );
    fireEvent.change(screen.getByLabelText('Cell content'), {
      target: {value: 'text'},
    });
    expect(changed).toEqual({...original, type: 'text'});
  });
  it('builds content and question ranges using fields rather than JSON', () => {
    render(<Editor />);
    fireEvent.change(screen.getByLabelText('Question type'), {
      target: {value: 'formCompletion'},
    });
    fireEvent.change(screen.getByLabelText('Form / Form heading'), {
      target: {value: 'Booking form'},
    });
    fireEvent.change(
      screen.getByLabelText('Form / Form fields 1 / Field label'),
      {target: {value: 'Name'}},
    );
    fireEvent.click(screen.getByRole('button', {name: 'Add form field'}));
    const question = JSON.parse(
      screen.getByTestId('question').textContent ?? '{}',
    );
    expect(question).toMatchObject({
      kind: 'formCompletion',
      start: '1',
      end: '2',
    });
    expect(JSON.parse(question.payload).fields).toEqual([
      {id: 1, label: 'Name'},
      {id: 2, label: ''},
    ]);
  });
  it('retains nested answers and unknown fields when editing display text', () => {
    render(
      <Editor
        initial={{
          ...newQuestion(),
          kind: 'formCompletion',
          payload: JSON.stringify({
            id: 123,
            formTitle: 'Form',
            fields: [{id: 1, label: 'Name', answer: ['Alice']}],
            scoring: {version: 2},
          }),
        }}
      />,
    );
    fireEvent.change(
      screen.getByLabelText('Form / Form fields 1 / Field label'),
      {target: {value: 'Full name'}},
    );
    expect(
      JSON.parse(
        JSON.parse(screen.getByTestId('question').textContent ?? '{}').payload,
      ),
    ).toEqual({
      id: 123,
      formTitle: 'Form',
      fields: [{id: 1, label: 'Full name', answer: ['Alice']}],
      scoring: {version: 2},
    });
    expect(
      JSON.parse(screen.getByTestId('question').textContent ?? '{}'),
    ).toMatchObject({start: '1', end: '1'});
  });
  it('requires confirmation before changing a populated type and cancel keeps everything', () => {
    const initial = {
      ...newQuestion(),
      kind: 'formCompletion',
      payload: JSON.stringify({
        formTitle: 'Form',
        fields: [{id: 1, label: 'Name'}],
      }),
    };
    render(<Editor initial={initial} />);
    fireEvent.change(screen.getByLabelText('Question type'), {
      target: {value: 'mcq'},
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Replace the question content?',
    );
    expect(
      JSON.parse(screen.getByTestId('question').textContent ?? '{}'),
    ).toEqual(initial);
    fireEvent.click(screen.getByRole('button', {name: 'Keep current type'}));
    expect(
      JSON.parse(screen.getByTestId('question').textContent ?? '{}'),
    ).toEqual(initial);
    fireEvent.change(screen.getByLabelText('Question type'), {
      target: {value: 'mcq'},
    });
    fireEvent.click(screen.getByRole('button', {name: 'Replace content'}));
    expect(
      JSON.parse(screen.getByTestId('question').textContent ?? '{}').kind,
    ).toBe('mcq');
  });
  it('does not replace invalid JSON or structured paragraphs', () => {
    render(
      <Editor initial={{...newQuestion(), kind: 'mcq', payload: '{bad'}} />,
    );
    expect(screen.getByLabelText('Question data (JSON)')).toHaveValue('{bad');
    expect(screen.getByRole('alert')).toHaveTextContent('JSON cannot be read');
    render(
      <PassageEditor
        value='[{"text":"Keep formatting"}]'
        onChange={() => {
          throw new Error('Must not write automatically');
        }}
      />,
    );
    expect(screen.getByLabelText('Paragraph data (JSON)')).toHaveValue(
      '[{"text":"Keep formatting"}]',
    );
  });
});

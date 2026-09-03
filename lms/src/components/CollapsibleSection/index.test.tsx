import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {CollapsibleSection} from './index';

describe('CollapsibleSection', () => {
  it('starts closed and preserves mounted field values across disclosure changes', () => {
    const {container, rerender} = render(<CollapsibleSection title="Notes"><input aria-label="Draft" defaultValue=""/></CollapsibleSection>);
    const section = container.querySelector('details')!;
    expect(section.open).toBe(false);
    section.open = true;
    fireEvent.change(screen.getByLabelText('Draft'), {target: {value: 'Unsaved notes'}});
    section.open = false;
    rerender(<CollapsibleSection title="Notes" count={1}><input aria-label="Draft" defaultValue=""/></CollapsibleSection>);
    section.open = true;
    expect(screen.getByLabelText('Draft')).toHaveValue('Unsaved notes');
  });

  it('reveals invalid fields and all enclosing sections without opening unrelated ones', () => {
    const {container} = render(<><CollapsibleSection title="Profile"><CollapsibleSection title="Identity"><input aria-label="Name" required/></CollapsibleSection></CollapsibleSection><CollapsibleSection title="Notes">Notes</CollapsibleSection></>);
    fireEvent.invalid(screen.getByLabelText('Name'));
    expect([...container.querySelectorAll('details')].map(item => item.open)).toEqual([true, true, false]);
  });

  it('opens the explicit edit target and preserves the user’s later collapse', () => {
    const {container, rerender} = render(<CollapsibleSection title="Editor">Editor</CollapsibleSection>);
    const section = container.querySelector('details')!;
    rerender(<CollapsibleSection title="Editor" revealKey={7}>Editor</CollapsibleSection>);
    expect(section.open).toBe(true);
    section.open = false;
    rerender(<CollapsibleSection title="Editor" revealKey={7} count={2}>Editor</CollapsibleSection>);
    expect(section.open).toBe(false);
  });
});

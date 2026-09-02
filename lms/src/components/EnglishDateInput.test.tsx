import {useState} from 'react';
import {fireEvent, render, screen, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {EnglishDateInput, EnglishDateTimeInput, EnglishTimeInput} from './EnglishDateInput';

describe('English date inputs', () => {
  it('shows and emits datetime values in a fixed English format', () => {
    const Harness = () => {
      const [value, setValue] = useState('2026-08-03T22:19');
      return <><label>Due time<EnglishDateTimeInput value={value} onChangeValue={setValue}/></label><output>{value}</output></>;
    };
    render(<Harness/>);

    const input = screen.getByLabelText('Due time') as HTMLInputElement;
    expect(input.value).toBe('08/03/2026, 10:19 PM');
    fireEvent.change(input, {target: {value: '09/15/2026, 11:45 PM'}});

    expect(screen.getByText('2026-09-15T23:45').textContent).toBe('2026-09-15T23:45');
    expect(input.lang).toBe('en-US');
    expect(input.type).toBe('text');
  });

  it('normalizes date and time values without the browser locale', () => {
    const dateChange = vi.fn();
    const timeChange = vi.fn();
    render(
      <>
        <label>Start date<EnglishDateInput value="" onChangeValue={dateChange}/></label>
        <label>Start time<EnglishTimeInput value="" onChangeValue={timeChange}/></label>
      </>,
    );

    fireEvent.change(screen.getByLabelText('Start date'), {target: {value: '02/28/2027'}});
    fireEvent.change(screen.getByLabelText('Start time'), {target: {value: '12:05 AM'}});

    expect(dateChange).toHaveBeenLastCalledWith('2027-02-28');
    expect(timeChange).toHaveBeenLastCalledWith('00:05');
    expect((screen.getByLabelText('Start date') as HTMLInputElement).placeholder).toBe('MM/DD/YYYY');
  });

  it('opens a floating calendar on focus and selects a date directly', () => {
    const Harness = () => {
      const [value, setValue] = useState('2026-08-03');
      return <><label>Event date<EnglishDateInput value={value} onChangeValue={setValue}/></label><output>{value}</output></>;
    };
    render(<Harness/>);

    fireEvent.focus(screen.getByLabelText('Event date'));
    const dialog = screen.getByRole('dialog', {name: 'Select date'});
    fireEvent.click(within(dialog).getByRole('button', {name: 'Monday, August 17, 2026'}));

    expect(screen.queryByRole('dialog', {name: 'Select date'})).toBeNull();
    expect(screen.getByText('2026-08-17').textContent).toBe('2026-08-17');
    expect((screen.getByLabelText('Event date') as HTMLInputElement).value).toBe('08/17/2026');
  });

  it('keeps a dedicated calendar button in addition to focus-to-open', () => {
    render(<label>Start date<EnglishDateInput value="" onChangeValue={vi.fn()}/></label>);

    fireEvent.click(screen.getByRole('button', {name: 'Open calendar'}));

    expect(screen.getByRole('dialog', {name: 'Select date'})).toBeInTheDocument();
  });

  it('sets both calendar date and time from the floating picker', () => {
    const Harness = () => {
      const [value, setValue] = useState('2026-08-03T10:19');
      return <><label>Quiz closes<EnglishDateTimeInput value={value} onChangeValue={setValue}/></label><output>{value}</output></>;
    };
    render(<Harness/>);

    fireEvent.focus(screen.getByLabelText('Quiz closes'));
    const dialog = screen.getByRole('dialog', {name: 'Select date & time'});
    fireEvent.click(within(dialog).getByRole('button', {name: 'Monday, August 17, 2026'}));
    fireEvent.change(within(dialog).getByLabelText('Hour'), {target: {value: '11'}});
    fireEvent.change(within(dialog).getByLabelText('Minute'), {target: {value: '45'}});
    fireEvent.change(within(dialog).getByLabelText('AM or PM'), {target: {value: 'PM'}});
    fireEvent.click(within(dialog).getByRole('button', {name: 'Set date & time'}));

    expect(screen.getByText('2026-08-17T23:45').textContent).toBe('2026-08-17T23:45');
    expect((screen.getByLabelText('Quiz closes') as HTMLInputElement).value).toBe('08/17/2026, 11:45 PM');
  });
});

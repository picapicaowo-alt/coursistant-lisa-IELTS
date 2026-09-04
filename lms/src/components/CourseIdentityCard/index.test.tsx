import '@testing-library/jest-dom';
import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {CourseIdentityCard} from './index';
import {CourseCardGrid} from './CourseCardGrid';

describe('shared course identity presentation', () => {
  it('keeps a named article, status, identity, schedule and caller-owned actions', () => {
    const open = vi.fn();
    render(<CourseIdentityCard courseId={71} title="Academic Writing" headingLevel={2} code="WR101"
      instructor="Sarah Lim" status={<span>Active</span>} footer={<span>Mon 10:00 · Room 3A</span>}
      actions={<button type="button" onClick={open}>View details</button>}/>);
    expect(screen.getByRole('article', {name: 'Academic Writing'})).toHaveAttribute('data-course-card', '71');
    expect(screen.getByRole('heading', {level: 2})).toHaveTextContent('Academic Writing');
    expect(screen.getByText('Active')).toBeVisible();
    expect(screen.getByText('Sarah Lim')).toBeVisible();
    expect(screen.getByText('Mon 10:00 · Room 3A')).toBeVisible();
    fireEvent.click(screen.getByRole('button', {name: 'View details'}));
    expect(open).toHaveBeenCalledOnce();
  });

  it('does not invent progress or actions for a read-only course', () => {
    render(<CourseIdentityCard courseId={71} title="Read-only course"/>);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('preserves valid lecture progress and distinguishes missing progress', () => {
    const {rerender} = render(<CourseIdentityCard courseId={71} title="Writing" progress={{completed: 4, total: 10}}/>);
    expect(screen.getByRole('progressbar', {name: 'Writing: lecture progress'})).toHaveAttribute('value', '4');
    expect(screen.getByText('40%')).toBeVisible();
    rerender(<CourseIdentityCard courseId={71} title="Writing" progress={{completed: 4, total: 0}}/>);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText('Not available')).toBeVisible();
  });

  it('keeps disabled actions disabled and menu controls independently operable', () => {
    const open = vi.fn();
    render(<CourseIdentityCard courseId={71} title="Writing" menu={<button type="button" onClick={open}>More actions</button>}
      actions={<button type="button" disabled data-variant="secondary">Publish</button>}/>);
    expect(screen.getByRole('button', {name: 'Publish'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name: 'More actions'}));
    expect(open).toHaveBeenCalledOnce();
  });

  it.each([
    {completed: -1, total: 10},
    {completed: 11, total: 10},
    {completed: 1, total: Infinity},
    {completed: NaN, total: 10},
    {},
  ])('does not turn malformed lecture counts into a percentage: %j', progress => {
    render(<CourseIdentityCard courseId={71} title="Writing" progress={progress}/>);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText('Not available')).toBeVisible();
  });

  it('preserves collection busy state and list view without changing the cards', () => {
    render(<CourseCardGrid label="Owned courses" busy view="list"><CourseIdentityCard courseId={71} title="Writing"/></CourseCardGrid>);
    expect(screen.getByRole('region', {name: 'Owned courses'})).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('region', {name: 'Owned courses'})).toHaveAttribute('data-view', 'list');
    expect(screen.getByRole('article', {name: 'Writing'})).toBeVisible();
  });
});

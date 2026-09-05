import {describe, expect, it} from 'vitest';
import '@testing-library/jest-dom';
import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import type {CourseAnnouncementSummary} from '@/apis';
import {AnnouncementsCard} from './AnnouncementsCard';

const mockAnnouncement = (
  id: number,
  title: string,
  postedAt: string,
): CourseAnnouncementSummary => ({
  id,
  courseId: 33,
  courseCode: 'CSCI-201',
  title,
  authorUserId: 1,
  authorName: 'Prof. Morgan',
  postedAt,
  editedAt: null,
  read: true,
});

describe('AnnouncementsCard', () => {
  it('renders "Manage announcements" button for staff with manage permissions', () => {
    render(
      <MemoryRouter>
        <AnnouncementsCard
          courseId={33}
          announcements={[]}
          failed={false}
          canManage={true}
        />
      </MemoryRouter>,
    );

    const button = screen.getByRole('link', {name: 'Manage announcements'});
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('href', '/course/33/announcements');
  });

  it('renders "View all" button for students without manage permissions', () => {
    render(
      <MemoryRouter>
        <AnnouncementsCard
          courseId={33}
          announcements={[]}
          failed={false}
          canManage={false}
        />
      </MemoryRouter>,
    );

    const button = screen.getByRole('link', {name: 'View all'});
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('href', '/course/33/announcements');
  });

  it('renders error message when loading failed', () => {
    render(
      <MemoryRouter>
        <AnnouncementsCard
          courseId={33}
          announcements={[]}
          failed={true}
          canManage={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load announcements.");
  });

  it('renders clean empty state without orphan icon when no announcements exist', () => {
    render(
      <MemoryRouter>
        <AnnouncementsCard
          courseId={33}
          announcements={[]}
          failed={false}
          canManage={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('No announcements in this course yet.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('renders up to 3 announcements sorted newest first', () => {
    const list = [
      mockAnnouncement(1, 'Oldest Note', '2026-08-01T10:00:00Z'),
      mockAnnouncement(2, 'Latest Note', '2026-08-10T10:00:00Z'),
      mockAnnouncement(3, 'Middle Note', '2026-08-05T10:00:00Z'),
    ];

    render(
      <MemoryRouter>
        <AnnouncementsCard
          courseId={33}
          announcements={list}
          failed={false}
          canManage={true}
        />
      </MemoryRouter>,
    );

    const links = screen.getAllByRole('link');
    // Top right "Manage announcements", followed by 3 rows
    expect(links).toHaveLength(4);

    const titles = screen.getAllByText(/Note$/).map((el) => el.textContent);
    expect(titles).toEqual(['Latest Note', 'Middle Note', 'Oldest Note']);

    // Total <= 3 should not show the footer link
    expect(screen.queryByText(/View all announcements/)).not.toBeInTheDocument();
  });

  it('renders top 3 items and footer "View all announcements (5)" when more than 3 items exist', () => {
    const list = [
      mockAnnouncement(1, 'Ann 1', '2026-08-01T10:00:00Z'),
      mockAnnouncement(2, 'Ann 2', '2026-08-02T10:00:00Z'),
      mockAnnouncement(3, 'Ann 3', '2026-08-03T10:00:00Z'),
      mockAnnouncement(4, 'Ann 4', '2026-08-04T10:00:00Z'),
      mockAnnouncement(5, 'Ann 5', '2026-08-05T10:00:00Z'),
    ];

    render(
      <MemoryRouter>
        <AnnouncementsCard
          courseId={33}
          announcements={list}
          failed={false}
          canManage={true}
        />
      </MemoryRouter>,
    );

    // Only Ann 5, Ann 4, Ann 3 should be displayed
    expect(screen.getByText('Ann 5')).toBeInTheDocument();
    expect(screen.getByText('Ann 4')).toBeInTheDocument();
    expect(screen.getByText('Ann 3')).toBeInTheDocument();
    expect(screen.queryByText('Ann 2')).not.toBeInTheDocument();
    expect(screen.queryByText('Ann 1')).not.toBeInTheDocument();

    const footerLink = screen.getByRole('link', {name: 'View all announcements (5)'});
    expect(footerLink).toBeInTheDocument();
    expect(footerLink).toHaveAttribute('href', '/course/33/announcements');
  });
});

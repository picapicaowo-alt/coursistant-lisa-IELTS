import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {CourseWeek} from '@/apis';
import {courseApiService} from '@/apis/services/course-api';
import {WeekContentCard} from './WeekContentCard';

vi.mock('@/apis/services/course-api', () => ({
  courseApiService: {
    createMaterials: vi.fn(),
    renameMaterial: vi.fn(),
    deleteMaterial: vi.fn(),
    moveMaterial: vi.fn(),
    reorderMaterials: vi.fn(),
  },
}));

const weeks: CourseWeek[] = [
  {
    id: 11,
    courseId: 31,
    title: 'Week 1',
    orderPosition: 0,
    state: 'Draft',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    materials: [
      {
        id: 81,
        weekId: 11,
        courseId: 31,
        materialType: 'LINK',
        displayName: 'Reading',
        orderPosition: 0,
        originalFilename: null,
        contentType: null,
        extension: null,
        sizeBytes: null,
        linkUrl: 'https://example.com',
        uploadedBy: 385,
        previewAvailable: false,
        downloadUrl: '/download',
      },
      {
        id: 82,
        weekId: 11,
        courseId: 31,
        materialType: 'FILE',
        displayName: 'Slides',
        orderPosition: 1,
        originalFilename: 'slides.pdf',
        contentType: 'application/pdf',
        extension: 'pdf',
        sizeBytes: 1024,
        linkUrl: null,
        uploadedBy: 999,
        previewAvailable: true,
        downloadUrl: '/download',
      },
    ],
  },
  {
    id: 12,
    courseId: 31,
    title: 'Week 2',
    orderPosition: 1,
    state: 'Published',
    materials: [],
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  },
];

const renderCard = (canManageExistingMaterials: boolean) => {
  const client = new QueryClient({defaultOptions: {mutations: {retry: false}}});
  return render(
    <QueryClientProvider client={client}>
      <WeekContentCard
        courseId={31}
        week={weeks[0]}
        weeks={weeks}
        currentUserId={385}
        canManageExistingMaterials={canManageExistingMaterials}
        canUploadMaterials
        onChanged={vi.fn()}
      />
    </QueryClientProvider>
  );
};

describe('WeekContentCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(courseApiService.reorderMaterials).mockResolvedValue({} as never);
  });

  it('gives course managers working reorder, rename, move, upload, link, and delete controls', async () => {
    renderCard(true);

    expect(screen.getByRole('button', {name: 'Upload files'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Add link'})).toBeTruthy();
    expect(screen.getByLabelText('Rename Reading')).toBeTruthy();
    expect(screen.getByLabelText('Move Reading to another week')).toBeTruthy();
    expect(screen.getByLabelText('Delete Reading')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Move Reading down'));
    await waitFor(() => expect(courseApiService.reorderMaterials).toHaveBeenCalledWith(
      31,
      11,
      [82, 81],
      expect.any(String),
    ));
  });

  it('limits a content-enabled TA to uploads and deleting their own material', () => {
    renderCard(false);

    expect(screen.getByRole('button', {name: 'Upload files'})).toBeTruthy();
    expect(screen.getByLabelText('Delete Reading')).toBeTruthy();
    expect(screen.queryByLabelText('Delete Slides')).toBeNull();
    expect(screen.queryByLabelText('Rename Reading')).toBeNull();
    expect(screen.queryByLabelText('Move Reading to another week')).toBeNull();
    expect(screen.queryByLabelText('Publish Reading')).toBeNull();
    expect(screen.queryByLabelText('Unpublish Reading')).toBeNull();
  });

  it('shows publish and unpublish controls for course managers', () => {
    renderCard(true);

    expect(screen.getByLabelText('Publish Reading')).toBeTruthy();
  });
});

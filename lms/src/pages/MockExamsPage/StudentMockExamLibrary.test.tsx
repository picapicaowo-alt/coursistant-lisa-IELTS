import {render, screen} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import {describe, expect, it} from 'vitest'
import {StudentMockExamLibrary} from './StudentMockExamLibrary'

describe('StudentMockExamLibrary', () => {
  it('links only the sections included in the assigned exam response', () => {
    render(
      <MemoryRouter>
        <StudentMockExamLibrary value={{content: [{
          studentMockExamId: 17,
          title: 'Cambridge Practice Set 1',
          listeningSelected: true,
          readingSelected: true,
          writingSelected: false,
        }]}} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', {name: 'Cambridge Practice Set 1'})).toBeInTheDocument()
    expect(screen.getByRole('link', {name: /Listening/})).toHaveAttribute('href', '/mock-exams/17/listening')
    expect(screen.getByRole('link', {name: /Reading/})).toHaveAttribute('href', '/mock-exams/17/reading')
    expect(screen.queryByRole('link', {name: /Writing/})).not.toBeInTheDocument()
  })

  it('keeps an honest empty state when there are no assignments', () => {
    render(<StudentMockExamLibrary value={[]} />, {wrapper: MemoryRouter})
    expect(screen.getByRole('heading', {name: 'No assigned papers yet'})).toBeInTheDocument()
  })
})

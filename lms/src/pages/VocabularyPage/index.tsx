import {useMemo, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ArrowRight, BookOpen, Filter, Layers3, Play, Sparkles} from 'lucide-react';
import {Link, useNavigate} from 'react-router-dom';
import type {ContinueStudy} from '@/apis/types/vocabulary';
import {vocabularyApi} from '@/apis/services/vocabulary-api';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {PageState} from '@/pages/vocabulary/components/PageState';
import {ProgressRing} from '@/pages/vocabulary/components/ProgressRing';
import {vocabularyQueryKeys} from '@/pages/vocabulary/queryKeys';
import {VOCABULARY_PATHS} from '@/pages/vocabulary/routes';
import {getApiErrorMessage} from '@/utils/apiError';
import styles from './index.module.scss';

interface LibraryFilters {
  theme: string;
  skillFocus: string;
  difficulty: string;
}

const EMPTY_FILTERS: LibraryFilters = {theme: '', skillFocus: '', difficulty: ''};

const VocabularyPage = () => {
  const {user} = useRequiredAuth();
  const studentId = String(user.userId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS);
  const queryFilters = useMemo(() => ({
    ...(filters.theme ? {theme: filters.theme} : {}),
    ...(filters.skillFocus ? {skillFocus: filters.skillFocus} : {}),
    ...(filters.difficulty ? {difficulty: filters.difficulty} : {}),
  }), [filters]);
  const query = useQuery({
    queryKey: vocabularyQueryKeys.library(studentId, queryFilters),
    queryFn: () => vocabularyApi.list(studentId, queryFilters),
    staleTime: 30_000,
  });
  const resumeMutation = useMutation({
    mutationFn: (resumable: ContinueStudy) => vocabularyApi.startSession(
      studentId,
      resumable.unitId,
      {mode: resumable.mode},
      crypto.randomUUID(),
    ),
    onSuccess: session => {
      queryClient.setQueryData(vocabularyQueryKeys.session(studentId, session.id), session);
      void queryClient.invalidateQueries({queryKey: vocabularyQueryKeys.all});
      navigate(VOCABULARY_PATHS.session(session.unitId, session.id));
    },
  });

  if (query.isPending) return <main className={styles.page}><PageState kind="loading" title="Opening your library" detail="Loading lists and private study progress…"/></main>;
  if (query.isError) return <main className={styles.page}><PageState kind="error" title="The library could not be loaded" detail="Your progress is safe. The Vocabulary service is temporarily unavailable; please try again." onRetry={() => void query.refetch()}/></main>;

  const data = query.data;
  const resumableSession = data.continue;
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <div className={styles.eyebrow}><Sparkles size={15}/> Your independent study space</div>
          <h1>Vocabulary</h1>
          <p>Build confident recall at your own pace. Ratings stay private and never affect courses, assignments, or reports.</p>
        </div>
        <div className={styles.heroMark} aria-hidden="true">
          <BookOpen/>
          <span>word<br/>by word</span>
        </div>
      </header>

      {resumableSession ? (
        <section className={styles.continueCard} aria-labelledby="continue-heading">
          <div className={styles.continueIcon}><Play fill="currentColor"/></div>
          <div>
            <span className={styles.kicker}>Continue where you left off</span>
            <h2 id="continue-heading">{resumableSession.listName}</h2>
            <p>{resumableSession.unitName} · {resumableSession.mode === 'TEST' ? 'Test mode' : 'Remember mode'}</p>
          </div>
          <button
            type="button"
            disabled={resumeMutation.isPending}
            onClick={() => resumeMutation.mutate(resumableSession)}
          >
            {resumeMutation.isPending ? 'Resuming…' : 'Resume session'} <ArrowRight size={18}/>
          </button>
          {resumeMutation.isError ? (
            <p className={styles.continueError} role="alert">
              {getApiErrorMessage(resumeMutation.error, 'The session could not be resumed. Your saved position is unchanged.')}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className={styles.librarySection} aria-labelledby="library-heading">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.kicker}>Curated library</span>
            <h2 id="library-heading">Choose a word list</h2>
          </div>
          <span className={styles.listCount}><Layers3 size={16}/>{data.items.length} lists</span>
        </div>

        <div className={styles.filters} aria-label="Filter vocabulary lists">
          <Filter size={18} aria-hidden="true"/>
          <label>
            <span>Theme</span>
            <select value={filters.theme} onChange={event => setFilters(current => ({...current, theme: event.target.value}))}>
              <option value="">All themes</option>
              {data.filters.themes.map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span>Skill focus</span>
            <select value={filters.skillFocus} onChange={event => setFilters(current => ({...current, skillFocus: event.target.value}))}>
              <option value="">All skills</option>
              {data.filters.skillFocuses.map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span>Difficulty</span>
            <select value={filters.difficulty} onChange={event => setFilters(current => ({...current, difficulty: event.target.value}))}>
              <option value="">All levels</option>
              {data.filters.difficulties.map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
          {Object.values(filters).some(Boolean) ? (
            <button type="button" onClick={() => setFilters(EMPTY_FILTERS)}>Clear</button>
          ) : null}
        </div>

        {data.items.length === 0 ? (
          <PageState kind="empty" title="No lists match these filters" detail="Clear one or more filters to see the full library."/>
        ) : (
          <div className={styles.listGrid}>
            {data.items.map((list, index) => (
              <Link className={styles.listCard} to={VOCABULARY_PATHS.list(list.id)} key={list.id}>
                <div className={styles.cardTop}>
                  <span className={styles.ordinal}>{String(index + 1).padStart(2, '0')}</span>
                  <ProgressRing value={list.progress.clearedWords} max={list.progress.totalWords} label={`${list.name} progress`}/>
                </div>
                <div className={styles.tags}><span>{list.theme}</span><span>{list.difficulty}</span></div>
                <h3>{list.name}</h3>
                <p>{list.description}</p>
                <div className={styles.cardFooter}>
                  <span>{list.totalWords} words · {list.skillFocus}</span>
                  <ArrowRight size={18}/>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default VocabularyPage;

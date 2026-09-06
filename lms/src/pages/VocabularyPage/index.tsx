import { useTranslation } from 'react-i18next';
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
import {formatNumber} from '@/i18n/formatting';
import styles from './index.module.scss';

interface LibraryFilters {
  theme: string;
  skillFocus: string;
  difficulty: string;
}

const EMPTY_FILTERS: LibraryFilters = {theme: '', skillFocus: '', difficulty: ''};

const VocabularyPage = () => {
  const { t: translate } = useTranslation();
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

  if (query.isPending) return <main className={styles.page}><PageState kind="loading" title={translate("vocabulary:library.opening")} detail={translate("vocabulary:library.loading")}/></main>;
  if (query.isError) return <main className={styles.page}><PageState kind="error" title={translate("vocabulary:library.failed")} detail={translate("vocabulary:library.failedHelp")} onRetry={() => void query.refetch()}/></main>;

  const data = query.data;
  const resumableSession = data.continue;
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <div className={styles.eyebrow}><Sparkles size={15}/> {' '}{translate("vocabulary:library.eyebrow")}</div>
          <h1>{translate("common:sidebar.vocabulary")}</h1>
          <p>{translate("vocabulary:library.help")}</p>
        </div>
        <div className={styles.heroMark} aria-hidden="true">
          <BookOpen/>
          <span>{translate("vocabulary:library.wordByWord")}</span>
        </div>
      </header>

      {resumableSession ? (
        <section className={styles.continueCard} aria-labelledby="continue-heading">
          <div className={styles.continueIcon}><Play fill="currentColor"/></div>
          <div>
            <span className={styles.kicker}>{translate("vocabulary:library.continue")}</span>
            <h2 id="continue-heading">{resumableSession.listName}</h2>
            <p>{resumableSession.unitName} · {resumableSession.mode === 'TEST' ? translate("vocabulary:mode.testMode") : translate("vocabulary:mode.rememberMode")}</p>
          </div>
          <button
            type="button"
            disabled={resumeMutation.isPending}
            onClick={() => resumeMutation.mutate(resumableSession)}
          >
            {resumeMutation.isPending ? translate('common:navigationControls.resuming') : translate('common:navigationControls.resumeSession')}
          </button>
          {resumeMutation.isError ? (
            <p className={styles.continueError} role="alert">
              {getApiErrorMessage(resumeMutation.error, translate("vocabulary:session.resumeFailed"))}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className={styles.librarySection} aria-labelledby="library-heading">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.kicker}>{translate("vocabulary:library.curated")}</span>
            <h2 id="library-heading">{translate("vocabulary:library.choose")}</h2>
          </div>
          <span className={styles.listCount}><Layers3 size={16}/>{translate("vocabulary:library.lists", {count: data.items.length, number: formatNumber(data.items.length)})}</span>
        </div>

        <div className={styles.filters} aria-label={translate("vocabulary:library.filters")}>
          <Filter size={18} aria-hidden="true"/>
          <label>
            <span>{translate("vocabulary:library.theme")}</span>
            <select value={filters.theme} onChange={event => setFilters(current => ({...current, theme: event.target.value}))}>
              <option value="">{translate("vocabulary:library.allThemes")}</option>
              {data.filters.themes.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span>{translate("vocabulary:library.skill")}</span>
            <select value={filters.skillFocus} onChange={event => setFilters(current => ({...current, skillFocus: event.target.value}))}>
              <option value="">{translate("vocabulary:library.allSkills")}</option>
              {data.filters.skillFocuses.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span>{translate("vocabulary:library.difficulty")}</span>
            <select value={filters.difficulty} onChange={event => setFilters(current => ({...current, difficulty: event.target.value}))}>
              <option value="">{translate("vocabulary:library.allLevels")}</option>
              {data.filters.difficulties.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          {Object.values(filters).some(Boolean) ? (
            <button type="button" onClick={() => setFilters(EMPTY_FILTERS)}>{translate("common:actions.clear")}</button>
          ) : null}
        </div>

        {data.items.length === 0 ? (
          <PageState kind="empty" title={translate("vocabulary:library.noMatches")} detail={translate("vocabulary:library.clearHelp")}/>
        ) : (
          <div className={styles.listGrid}>
            {data.items.map((list, index) => (
              <Link className={styles.listCard} to={VOCABULARY_PATHS.list(list.id)} key={list.id}>
                <div className={styles.cardTop}>
                  <span className={styles.ordinal}>{formatNumber(index + 1, {minimumIntegerDigits: 2})}</span>
                  <ProgressRing value={list.progress.clearedWords} max={list.progress.totalWords} label={translate("vocabulary:library.progress", {name: list.name})}/>
                </div>
                <div className={styles.tags}><span>{list.theme}</span><span>{list.difficulty}</span></div>
                <h3>{list.name}</h3>
                <p>{list.description}</p>
                <div className={styles.cardFooter}>
                  <span>{translate("vocabulary:words", {count: list.totalWords, number: formatNumber(list.totalWords)})} · {list.skillFocus}</span>
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

import {useEffect} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ArrowRight, Check, CheckCircle2, ChevronLeft, Headphones, HelpCircle, X} from 'lucide-react';
import {useNavigate, useParams} from 'react-router-dom';
import type {RecallRating, StudySessionResponse} from '@/apis/types/vocabulary';
import {vocabularyApi} from '@/apis/services/vocabulary-api';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {PageState} from '@/pages/vocabulary/components/PageState';
import {vocabularyQueryKeys} from '@/pages/vocabulary/queryKeys';
import {VOCABULARY_PATHS} from '@/pages/vocabulary/routes';
import styles from './index.module.scss';

const RATING_OPTIONS: Array<{rating: RecallRating; label: string; hint: string; icon: typeof Check}> = [
  {rating: 'KNOW_WELL', label: 'Know well', hint: 'Confident recall', icon: Check},
  {rating: 'KIND_OF_KNOW', label: 'Kind of know', hint: 'Partial or hesitant', icon: HelpCircle},
  {rating: 'DONT_REMEMBER', label: "Don't remember", hint: 'No recall yet', icon: X},
];

const VocabularySessionPage = () => {
  const {sessionId = '', unitId = ''} = useParams();
  const {user} = useRequiredAuth();
  const studentId = String(user.userId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({
    queryKey: vocabularyQueryKeys.session(studentId, sessionId),
    queryFn: () => vocabularyApi.getSession(studentId, sessionId),
    enabled: Boolean(sessionId),
  });
  const unitQuery = useQuery({
    queryKey: vocabularyQueryKeys.unit(studentId, unitId),
    queryFn: () => vocabularyApi.getUnit(studentId, unitId),
    enabled: Boolean(unitId),
  });
  const setSession = (session: StudySessionResponse) => queryClient.setQueryData(
    vocabularyQueryKeys.session(studentId, sessionId),
    session,
  );
  const rateMutation = useMutation({
    mutationFn: ({wordId, rating}: {wordId: string; rating: RecallRating}) => vocabularyApi.rateCard(
      studentId,
      sessionId,
      {wordId, rating},
      crypto.randomUUID(),
    ),
    onSuccess: setSession,
  });
  const advanceMutation = useMutation({
    mutationFn: (direction: 'NEXT' | 'PREVIOUS') => vocabularyApi.advance(
      studentId,
      sessionId,
      {direction},
      crypto.randomUUID(),
    ),
    onSuccess: session => {
      setSession(session);
      if (session.status === 'COMPLETED') void queryClient.invalidateQueries({queryKey: vocabularyQueryKeys.all});
    },
  });
  const exitMutation = useMutation({
    mutationFn: () => vocabularyApi.exit(studentId, sessionId, crypto.randomUUID()),
    onSuccess: () => {
      void queryClient.invalidateQueries({queryKey: vocabularyQueryKeys.all});
      if (unitQuery.data) navigate(VOCABULARY_PATHS.list(unitQuery.data.listId));
      else navigate(VOCABULARY_PATHS.root);
    },
  });

  const session = sessionQuery.data;
  useEffect(() => {
    if (!session || session.mode !== 'TEST' || session.revealed || session.status !== 'ACTIVE' || rateMutation.isPending) return;
    const handleKey = (event: KeyboardEvent): void => {
      const option = RATING_OPTIONS[Number(event.key) - 1];
      if (!option || !session.currentCard) return;
      event.preventDefault();
      rateMutation.mutate({wordId: session.currentCard.wordId, rating: option.rating});
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [rateMutation, session]);

  if (sessionQuery.isPending || unitQuery.isPending) return <main className={styles.page}><PageState kind="loading" title="Preparing your cards" detail="Restoring the exact session position…"/></main>;
  if (sessionQuery.isError || unitQuery.isError || !session || !unitQuery.data) return <main className={styles.page}><PageState kind="error" title="This session is unavailable" detail="Your last saved position has not been changed. Return to the library or retry." onRetry={() => {void sessionQuery.refetch(); void unitQuery.refetch();}}/></main>;

  const unit = unitQuery.data;
  const isBusy = rateMutation.isPending || advanceMutation.isPending || exitMutation.isPending;
  const mutationError = rateMutation.isError || advanceMutation.isError || exitMutation.isError;

  if (session.status === 'COMPLETED') {
    return (
      <main className={styles.resultPage}>
        <section className={styles.resultCard}>
          <div className={styles.resultIcon}><CheckCircle2/></div>
          <span className={styles.kicker}>{session.mode === 'TEST' ? 'Session complete' : 'Remember mode complete'}</span>
          <h1>{session.mode === 'TEST' && session.summary?.unitCompletionOccurred ? 'A full pass, cleared.' : 'Good work. Take the win.'}</h1>
          {session.summary ? (
            <>
              <p>{session.summary.carriedForward > 0 ? 'The session ended on time. Words that still need work are already prioritised for next time.' : 'Every word scheduled for this pass is clear.'}</p>
              <dl className={styles.resultStats}>
                <div><dt>Cleared now</dt><dd>{session.summary.clearedThisSession}</dd></div>
                <div><dt>Current pass</dt><dd>{session.summary.currentPassCleared}/{session.summary.currentPassTotal}</dd></div>
                <div><dt>Carried forward</dt><dd>{session.summary.carriedForward}</dd></div>
                <div><dt>Unit completions</dt><dd>{session.summary.unitCompletionCount}</dd></div>
              </dl>
            </>
          ) : <p>You browsed all {session.totalScheduled} cards. Remember mode did not change ratings, history, or completion.</p>}
          <div className={styles.resultActions}>
            <button type="button" className={styles.primary} onClick={() => navigate(VOCABULARY_PATHS.list(unit.listId))}>Back to units <ArrowRight size={18}/></button>
            <button type="button" onClick={() => navigate(VOCABULARY_PATHS.root)}>Vocabulary library</button>
          </div>
        </section>
      </main>
    );
  }

  const card = session.currentCard;
  if (!card) return <main className={styles.page}><PageState kind="error" title="No card is available" detail="Exit this session and start the unit again."/></main>;
  const progress = session.totalScheduled > 0 ? Math.round(((session.position + 1) / session.totalScheduled) * 100) : 0;

  return (
    <main className={styles.page}>
      <header className={styles.sessionHeader}>
        <button type="button" className={styles.exitButton} onClick={() => exitMutation.mutate()} disabled={isBusy}><X size={18}/> Save & exit</button>
        <div className={styles.sessionMeta}>
          <span>{unit.listName}</span>
          <strong>Unit {unit.number} · {session.mode === 'TEST' ? 'Test' : 'Remember'}</strong>
        </div>
        <span className={styles.position}>{session.position + 1} / {session.totalScheduled}</span>
      </header>

      <div className={styles.progressBar} aria-label={`${progress}% through this session`}><span style={{width: `${progress}%`}}/></div>

      <p className={styles.modeGuidance}>
        {session.mode === 'TEST'
          ? session.revealed
            ? 'Rating saved · answer revealed'
            : "Word first · choose a rating, including Don't remember, to reveal the answer"
          : 'Full-card browsing · no recall rating or completion change'}
      </p>

      <section className={`${styles.studyCard} ${session.revealed ? styles.revealed : ''}`} aria-live="polite">
        <div className={styles.cardPrompt}>
          <span className={styles.partOfSpeech}>{card.partOfSpeech}</span>
          <h1>{card.word}</h1>
          {session.mode === 'TEST' && !session.revealed ? <p>Recall the meaning before you choose.</p> : null}
        </div>

        {card.answer ? (
          <div className={styles.answer}>
            <div className={styles.pronunciation}>
              <span><small>UK</small>{card.answer.ukPhonetic}</span>
              {card.answer.usPhonetic ? <span><small>US</small>{card.answer.usPhonetic}</span> : null}
              {card.answer.audioUrl ? <button type="button" onClick={() => void new Audio(card.answer?.audioUrl ?? '').play()} aria-label="Play pronunciation"><Headphones size={18}/></button> : null}
            </div>
            <div className={styles.meaning}>
              <strong>{card.answer.primaryMeaningZh}</strong>
              {card.answer.secondaryMeaningsZh.length ? <span>{card.answer.secondaryMeaningsZh.join(' · ')}</span> : null}
            </div>
            <blockquote>
              <p>{card.answer.exampleEn}</p>
              <footer>{card.answer.exampleZh}</footer>
            </blockquote>
          </div>
        ) : null}
      </section>

      {mutationError ? <p className={styles.inlineError} role="alert">That action was not saved. Please try it again.</p> : null}

      <footer className={styles.controls}>
        {session.mode === 'TEST' && !session.revealed ? (
          <div className={styles.ratingGroup} aria-label="Rate your recall">
            {RATING_OPTIONS.map(({rating, label, hint, icon: Icon}, index) => (
              <button key={rating} type="button" className={styles[rating.toLowerCase()]} disabled={isBusy} onClick={() => rateMutation.mutate({wordId: card.wordId, rating})}>
                <span className={styles.key}>{index + 1}</span><Icon size={19}/><span><strong>{label}</strong><small>{hint}</small></span>
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.navigationControls}>
            {session.mode === 'REMEMBER' ? (
              <button type="button" onClick={() => advanceMutation.mutate('PREVIOUS')} disabled={!session.canGoPrevious || isBusy}><ChevronLeft size={18}/> Previous</button>
            ) : <span className={styles.lockedRating}><Check size={16}/> Rating saved · answer revealed</span>}
            <button type="button" className={styles.nextButton} onClick={() => advanceMutation.mutate('NEXT')} disabled={isBusy}>
              {session.position + 1 >= session.totalScheduled ? 'Finish session' : 'Next card'} <ArrowRight size={18}/>
            </button>
          </div>
        )}
      </footer>
    </main>
  );
};

export default VocabularySessionPage;

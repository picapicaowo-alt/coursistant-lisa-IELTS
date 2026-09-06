import { useTranslation } from 'react-i18next';
import {useEffect, useRef, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Check, CheckCircle2, Headphones, HelpCircle, RefreshCcw, X} from 'lucide-react';
import {useNavigate, useParams} from 'react-router-dom';
import type {RecallRating, StudyMode, StudySessionResponse} from '@/apis/types/vocabulary';
import {vocabularyApi} from '@/apis/services/vocabulary-api';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {PageState} from '@/pages/vocabulary/components/PageState';
import {vocabularyQueryKeys} from '@/pages/vocabulary/queryKeys';
import {VOCABULARY_PATHS} from '@/pages/vocabulary/routes';
import {getApiErrorCode, getApiErrorMessage} from '@/utils/apiError';
import {formatNumber, formatPercent} from '@/i18n/formatting';
import styles from './index.module.scss';

const RATING_OPTIONS: Array<{rating: RecallRating; labelKey: string; hintKey: string; icon: typeof Check}> = [
  {rating: 'KNOW_WELL', labelKey: 'vocabulary:rating.know', hintKey: 'vocabulary:rating.knowHelp', icon: Check},
  {rating: 'KIND_OF_KNOW', labelKey: 'vocabulary:rating.partial', hintKey: 'vocabulary:rating.partialHelp', icon: HelpCircle},
  {rating: 'DONT_REMEMBER', labelKey: 'vocabulary:rating.forget', hintKey: 'vocabulary:rating.forgetHelp', icon: X},
];

const VocabularySessionPage = () => {
  const { t: translate } = useTranslation();
  const {sessionId = '', unitId = ''} = useParams();
  const {user} = useRequiredAuth();
  const studentId = String(user.userId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [requiresResume, setRequiresResume] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [audioErrorFor, setAudioErrorFor] = useState<string | null>(null);
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
  const reconcileInactiveSession = (error: unknown): void => {
    if (getApiErrorCode(error) === 'SESSION_NOT_ACTIVE') setRequiresResume(true);
  };
  const revealMutation = useMutation({
    mutationFn: () => vocabularyApi.revealCard(studentId, sessionId, crypto.randomUUID()),
    onSuccess: setSession,
    onError: reconcileInactiveSession,
  });
  const rateMutation = useMutation({
    mutationFn: ({wordId, rating}: {wordId: string; rating: RecallRating}) => vocabularyApi.rateCard(
      studentId,
      sessionId,
      {wordId, rating},
      crypto.randomUUID(),
    ),
    onSuccess: setSession,
    onError: reconcileInactiveSession,
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
    onError: reconcileInactiveSession,
  });
  const exitMutation = useMutation({
    mutationFn: () => vocabularyApi.exit(studentId, sessionId, crypto.randomUUID()),
    onSuccess: () => {
      void queryClient.invalidateQueries({queryKey: vocabularyQueryKeys.all});
      if (unitQuery.data) navigate(VOCABULARY_PATHS.list(unitQuery.data.listId));
      else navigate(VOCABULARY_PATHS.root);
    },
    onError: reconcileInactiveSession,
  });
  const resumeMutation = useMutation({
    mutationFn: (mode: StudyMode) => vocabularyApi.startSession(
      studentId,
      unitId,
      {mode},
      crypto.randomUUID(),
    ),
    onSuccess: resumedSession => {
      setRequiresResume(false);
      setSession(resumedSession);
      void queryClient.invalidateQueries({queryKey: vocabularyQueryKeys.all});
    },
  });

  const session = sessionQuery.data;
  useEffect(() => () => {
    if (audio.current) {audio.current.onerror = null; audio.current.pause(); audio.current = null;}
  }, [session?.currentCard?.wordId]);

  const playPronunciation = async () => {
    const currentCard = session?.currentCard;
    const url = currentCard?.answer?.audioUrl;
    if (!url || !currentCard) return;
    setAudioErrorFor(null);
    if (audio.current) {audio.current.onerror = null; audio.current.pause();}
    const playback = new Audio(url);
    audio.current = playback;
    const reportFailure = () => {if (audio.current === playback) setAudioErrorFor(currentCard.wordId);};
    playback.onerror = reportFailure;
    try {await playback.play();} catch {reportFailure();}
  };
  useEffect(() => {
    if (!session || session.mode !== 'TEST' || !session.revealed || session.rated || session.status !== 'ACTIVE' || rateMutation.isPending) return;
    const handleKey = (event: KeyboardEvent): void => {
      const option = RATING_OPTIONS[Number(event.key) - 1];
      if (!option || !session.currentCard) return;
      event.preventDefault();
      rateMutation.mutate({wordId: session.currentCard.wordId, rating: option.rating});
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [rateMutation, session]);

  if (sessionQuery.isPending || unitQuery.isPending) return <main className={styles.page}><PageState kind="loading" title={translate("vocabulary:session.preparing")} detail={translate("vocabulary:session.restoring")}/></main>;
  if (sessionQuery.isError || unitQuery.isError || !session || !unitQuery.data) return <main className={styles.page}><PageState kind="error" title={translate("vocabulary:session.unavailable")} detail={translate("vocabulary:session.unavailableHelp")} onRetry={() => {void sessionQuery.refetch(); void unitQuery.refetch();}}/></main>;

  const unit = unitQuery.data;
  const isBusy = revealMutation.isPending || rateMutation.isPending || advanceMutation.isPending || exitMutation.isPending || resumeMutation.isPending;
  const mutationError = revealMutation.error ?? rateMutation.error ?? advanceMutation.error ?? exitMutation.error;

  if (session.status === 'COMPLETED' || session.status === 'ENDED') {
    const wasEnded = session.status === 'ENDED';
    return (
      <main className={styles.resultPage}>
        <section className={styles.resultCard}>
          <div className={styles.resultIcon}><CheckCircle2/></div>
          <span className={styles.kicker}>{wasEnded ? translate("vocabulary:result.ended") : session.mode === 'TEST' ? translate("vocabulary:result.complete") : translate("vocabulary:result.rememberComplete")}</span>
          <h1>{wasEnded ? translate("vocabulary:result.fresh") : session.mode === 'TEST' && session.summary?.unitCompletionOccurred ? translate("vocabulary:result.cleared") : translate("vocabulary:result.goodWork")}</h1>
          {wasEnded ? (
            <p>{translate("vocabulary:result.endedHelp")}</p>
          ) : session.summary ? (
            <>
              <p>{session.summary.carriedForward > 0 ? translate("vocabulary:result.carriedHelp") : translate("vocabulary:result.allClear")}</p>
              <dl className={styles.resultStats}>
                <div><dt>{translate("vocabulary:result.clearedNow")}</dt><dd>{formatNumber(session.summary.clearedThisSession)}</dd></div>
                <div><dt>{translate("vocabulary:result.currentPass")}</dt><dd>{formatNumber(session.summary.currentPassCleared)}/{formatNumber(session.summary.currentPassTotal)}</dd></div>
                <div><dt>{translate("vocabulary:result.carried")}</dt><dd>{formatNumber(session.summary.carriedForward)}</dd></div>
                <div><dt>{translate("vocabulary:result.completions")}</dt><dd>{formatNumber(session.summary.unitCompletionCount)}</dd></div>
              </dl>
            </>
          ) : <p>{translate("vocabulary:result.browsed", {count: session.totalScheduled, number: formatNumber(session.totalScheduled)})}</p>}
          <div className={styles.resultActions}>
            <button type="button" className={styles.primary} onClick={() => navigate(VOCABULARY_PATHS.list(unit.listId))}>{translate('common:navigationControls.backToUnits')} </button>
            <button type="button" onClick={() => navigate(VOCABULARY_PATHS.root)}>{translate("common:navigationControls.vocabularyLibrary")}</button>
          </div>
        </section>
      </main>
    );
  }

  if (session.status === 'PAUSED' || requiresResume) {
    return (
      <main className={styles.page}>
        <PageState
          kind={resumeMutation.isError ? 'error' : 'empty'}
          title={translate("vocabulary:session.paused")}
          detail={resumeMutation.isError
            ? getApiErrorMessage(resumeMutation.error, translate("vocabulary:session.resumeFailed"))
            : translate("vocabulary:session.resumeFirst")}
          actionLabel={translate("common:navigationControls.resumeSession")}
          actionPending={resumeMutation.isPending}
          onRetry={() => resumeMutation.mutate(session.mode)}
        />
      </main>
    );
  }

  const card = session.currentCard;
  if (!card) return <main className={styles.page}><PageState kind="error" title={translate("vocabulary:session.noCard")} detail={translate("vocabulary:session.restartHelp")}/></main>;
  const progress = session.totalScheduled > 0 ? Math.round(((session.position + 1) / session.totalScheduled) * 100) : 0;
  const canReveal = session.mode === 'TEST' && !session.revealed;
  const isAwaitingRating = session.mode === 'TEST' && !session.rated;

  return (
    <main className={styles.page}>
      <header className={styles.sessionHeader}>
        <button type="button" className={styles.exitButton} onClick={() => exitMutation.mutate()} disabled={isBusy}><X size={18}/> {' '}{translate("vocabulary:session.exit")}</button>
        <div className={styles.sessionMeta}>
          <span>{unit.listName}</span>
          <strong>{translate('common:records.unit', {number: formatNumber(unit.number)})} · {session.mode === 'TEST' ? translate("vocabulary:mode.test") : translate("vocabulary:mode.remember")}</strong>
        </div>
        <span className={styles.position}>{formatNumber(session.position + 1)} / {formatNumber(session.totalScheduled)}</span>
      </header>

      <div className={styles.progressBar} aria-label={translate("vocabulary:session.progress", {percent: formatPercent(progress / 100)})}><span style={{width: `${progress}%`}}/></div>

      <p className={styles.modeGuidance}>
        {session.mode === 'TEST'
          ? session.rated
            ? translate("vocabulary:session.ratingSavedHelp")
            : session.revealed
              ? translate("vocabulary:session.revealedHelp")
              : translate("vocabulary:session.wordFirst")
          : translate("vocabulary:session.browseHelp")}
      </p>

      <section
        className={`${styles.studyCard} ${session.revealed ? styles.revealed : ''}`}
        aria-live="polite"
        aria-label={canReveal ? translate("vocabulary:session.showFor", {word: card.word}) : undefined}
        role={canReveal ? 'button' : undefined}
        tabIndex={canReveal ? 0 : undefined}
        onClick={canReveal && !isBusy ? () => revealMutation.mutate() : undefined}
        onKeyDown={canReveal && !isBusy ? event => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          revealMutation.mutate();
        } : undefined}
      >
        <div className={styles.cardPrompt}>
          <span className={styles.partOfSpeech}>{card.partOfSpeech}</span>
          <h1>{card.word}</h1>
          {canReveal ? (
            <>
              <p>{translate("vocabulary:session.recallHelp")}</p>
              <span className={styles.flipPrompt}><RefreshCcw size={17}/> {' '}{translate("vocabulary:session.showAnswer")}</span>
            </>
          ) : null}
        </div>

        {card.answer ? (
          <div className={styles.answer}>
            <div className={styles.pronunciation}>
              <span><small>{translate("vocabulary:session.uk")}</small>{card.answer.ukPhonetic}</span>
              {card.answer.usPhonetic ? <span><small>{translate("vocabulary:session.us")}</small>{card.answer.usPhonetic}</span> : null}
              {card.answer.audioUrl ? <button type="button" onClick={() => void playPronunciation()} aria-label={translate("vocabulary:session.play")}><Headphones size={18}/></button> : null}
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

      {audioErrorFor === card.wordId ? <p className={styles.inlineError} role="alert">{translate('vocabulary:session.playFailed')}</p> : null}
      {mutationError && getApiErrorCode(mutationError) !== 'SESSION_NOT_ACTIVE' ? (
        <p className={styles.inlineError} role="alert">
          {getApiErrorMessage(mutationError, translate("vocabulary:session.actionFailed"))}
        </p>
      ) : null}

      <footer className={styles.controls}>
        {isAwaitingRating ? (
          <div className={styles.ratingPanel}>
            <p id="rating-instruction" className={styles.ratingInstruction}>
              {session.revealed ? translate("vocabulary:rating.choose") : translate("vocabulary:rating.flipFirst")}
            </p>
            <div className={styles.ratingGroup} aria-label={translate("vocabulary:rating.label")} aria-describedby="rating-instruction">
              {RATING_OPTIONS.map(({rating, labelKey, hintKey, icon: Icon}, index) => (
                <button key={rating} type="button" className={styles[rating.toLowerCase()]} disabled={!session.revealed || isBusy} onClick={() => rateMutation.mutate({wordId: card.wordId, rating})}>
                  <span className={styles.key}>{formatNumber(index + 1)}</span><Icon size={19}/><span><strong>{translate(labelKey)}</strong><small>{translate(hintKey)}</small></span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.navigationControls}>
            {session.mode === 'REMEMBER' ? (
              <button type="button" onClick={() => advanceMutation.mutate('PREVIOUS')} disabled={!session.canGoPrevious || isBusy}> {translate("common:actions.previous")}</button>
            ) : <span className={styles.lockedRating}><Check size={16}/> {' '}{translate("vocabulary:rating.saved")}</span>}
            <button type="button" className={styles.nextButton} onClick={() => advanceMutation.mutate('NEXT')} disabled={isBusy}>
              {session.position + 1 >= session.totalScheduled ? translate('common:navigationControls.finishSession') : translate('common:navigationControls.nextCard')}
            </button>
          </div>
        )}
      </footer>
    </main>
  );
};

export default VocabularySessionPage;

import { useTranslation } from 'react-i18next';
import {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {BookOpenCheck, Check, Clock3, Layers3, RefreshCcw, Shuffle, Square, X} from 'lucide-react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import type {StudyMode, VocabularyUnitSummary} from '@/apis/types/vocabulary';
import {vocabularyApi} from '@/apis/services/vocabulary-api';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {PageState} from '@/pages/vocabulary/components/PageState';
import {ProgressRing} from '@/pages/vocabulary/components/ProgressRing';
import {vocabularyQueryKeys} from '@/pages/vocabulary/queryKeys';
import {VOCABULARY_PATHS} from '@/pages/vocabulary/routes';
import {getApiErrorMessage} from '@/utils/apiError';
import i18n from '@/i18n';
import {formatNumber, formatPercent} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
import styles from './index.module.scss';

const VocabularyListPage = () => {
  const {t: translate} = useTranslation();
  const {listId = ''} = useParams();
  const {user} = useRequiredAuth();
  const studentId = String(user.userId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<StudyMode>('TEST');
  const [shuffle, setShuffle] = useState(false);
  const [startingUnitId, setStartingUnitId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: vocabularyQueryKeys.list(studentId, listId),
    queryFn: () => vocabularyApi.getList(studentId, listId),
    enabled: Boolean(listId),
  });
  const startMutation = useMutation({
    mutationFn: ({unitId, sessionMode}: {unitId: string; sessionMode: StudyMode}) => vocabularyApi.startSession(
      studentId,
      unitId,
      {mode: sessionMode, ...(sessionMode === 'REMEMBER' ? {shuffle} : {})},
      crypto.randomUUID(),
    ),
    onMutate: ({unitId}) => setStartingUnitId(unitId),
    onSuccess: session => {
      void queryClient.invalidateQueries({queryKey: vocabularyQueryKeys.all});
      navigate(VOCABULARY_PATHS.session(session.unitId, session.id));
    },
    onSettled: () => setStartingUnitId(null),
  });
  const endMutation = useMutation({
    mutationFn: ({sessionId}: {sessionId: string; unitId: string}) => vocabularyApi.endSession(
      studentId,
      sessionId,
      crypto.randomUUID(),
    ),
    onSuccess: () => queryClient.invalidateQueries({queryKey: vocabularyQueryKeys.all}),
  });

  if (query.isPending) return <main className={styles.page}><PageState kind="loading" title={translate("vocabulary:units.loading")} detail={translate("vocabulary:units.loadingHelp")}/></main>;
  if (query.isError || !query.data) return <main className={styles.page}><PageState kind="error" title={translate("vocabulary:units.unavailable")} detail={translate("vocabulary:units.unavailableHelp")} onRetry={() => void query.refetch()}/></main>;

  const list = query.data;
  return (
    <main className={styles.page}>
      <Link className={styles.backLink} to={VOCABULARY_PATHS.root}> {translate('common:navigationControls.vocabularyLibrary')}</Link>
      <section className={styles.overview}>
        <div className={styles.overviewCopy}>
          <div className={styles.tags}><span>{list.theme}</span><span>{list.skillFocus}</span><span>{list.difficulty}</span></div>
          <h1>{list.name}</h1>
          <p>{list.description}</p>
          <div className={styles.facts}>
            <span><Layers3 size={17}/>{translate("vocabulary:units.count", {count: list.units.length, number: formatNumber(list.units.length)})}</span>
            <span><BookOpenCheck size={17}/>{translate("vocabulary:words", {count: list.totalWords, number: formatNumber(list.totalWords)})}</span>
            <span><RefreshCcw size={17}/>{translate("vocabulary:units.passes", {count: list.progress.completionCount, number: formatNumber(list.progress.completionCount)})}</span>
          </div>
        </div>
        <ProgressRing value={list.progress.clearedWords} max={list.progress.totalWords} label={translate("vocabulary:units.currentPass")} size="large"/>
      </section>

      <section className={styles.modeSection} aria-labelledby="mode-heading">
        <div>
          <span className={styles.kicker}>{translate("vocabulary:units.setup")}</span>
          <h2 id="mode-heading">{translate("vocabulary:units.choose")}</h2>
        </div>
        <div className={styles.modeControls}>
          <div className={styles.segmented} aria-label={translate("vocabulary:mode.label")}>
            <button type="button" aria-pressed={mode === 'TEST'} className={mode === 'TEST' ? styles.selected : ''} onClick={() => setMode('TEST')}>
              <Check size={17}/><span><strong>{translate("vocabulary:mode.test")}</strong><small>{translate("vocabulary:mode.testBrief")}</small></span>
            </button>
            <button type="button" aria-pressed={mode === 'REMEMBER'} className={mode === 'REMEMBER' ? styles.selected : ''} onClick={() => setMode('REMEMBER')}>
              <BookOpenCheck size={17}/><span><strong>{translate("vocabulary:mode.remember")}</strong><small>{translate("vocabulary:mode.rememberBrief")}</small></span>
            </button>
          </div>
          <p className={styles.modeDescription}>
            {mode === 'TEST'
              ? translate("vocabulary:mode.testHelp")
              : translate("vocabulary:mode.rememberHelp")}
          </p>
          <div className={styles.modeOption}>
            {mode === 'REMEMBER' ? (
              <label className={styles.shuffle}>
                <input type="checkbox" checked={shuffle} onChange={event => setShuffle(event.target.checked)}/>
                <Shuffle size={16}/> {' '}{translate("vocabulary:mode.shuffle")}</label>
            ) : (
              <span className={styles.testNote}><Shuffle size={16}/> {' '}{translate("vocabulary:mode.alwaysShuffle")}</span>
            )}
          </div>
        </div>
      </section>

      {startMutation.isError || endMutation.isError ? (
        <div className={styles.inlineError} role="alert">
          {startMutation.isError
            ? getApiErrorMessage(startMutation.error, translate("vocabulary:session.startFailed"))
            : getApiErrorMessage(endMutation.error, translate("vocabulary:session.endFailed"))}
        </div>
      ) : null}

      <section className={styles.units} aria-label={translate("vocabulary:units.title")}>
        {list.units.map(unit => (
          <UnitCard
            key={unit.id}
            unit={unit}
            mode={mode}
            pending={startingUnitId === unit.id}
            ending={endMutation.isPending && endMutation.variables?.unitId === unit.id}
            onStart={sessionMode => startMutation.mutate({unitId: unit.id, sessionMode})}
            onEnd={sessionId => endMutation.mutate({sessionId, unitId: unit.id})}
          />
        ))}
      </section>
    </main>
  );
};

interface UnitCardProps {
  unit: VocabularyUnitSummary;
  mode: StudyMode;
  pending: boolean;
  ending: boolean;
  onStart: (mode: StudyMode) => void;
  onEnd: (sessionId: string) => void;
}

const modeLabel = (mode: StudyMode): string => i18n.t(mode === 'TEST' ? 'vocabulary:mode.test' : 'vocabulary:mode.remember');

const UnitCard = ({unit, mode, pending, ending, onStart, onEnd}: UnitCardProps) => {
  const { t: translate } = useTranslation();
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const percent = unit.progress.totalWords > 0 ? Math.max(0, Math.min(100, Math.round((unit.progress.clearedWords / unit.progress.totalWords) * 100))) : 0;
  const activeSession = unit.activeSession;
  const activeModeLabel = activeSession ? modeLabel(activeSession.mode) : null;
  const activeStatusLabel = statusLabel(activeSession?.status);
  const selectedModeLabel = modeLabel(mode);
  const blockedByDifferentMode = Boolean(activeSession && activeSession.mode !== mode);
  const currentCard = activeSession
    ? Math.min(activeSession.position + 1, activeSession.totalScheduled)
    : null;
  return (
    <article className={styles.unitCard}>
      <div className={styles.unitNumber}>{formatNumber(unit.number, {minimumIntegerDigits: 2})}</div>
      <div className={styles.unitMain}>
        <span className={styles.kicker}>{translate('common:records.unit', {number: formatNumber(unit.number)})}</span>
        <h3>{unit.name}</h3>
        <div className={styles.progressTrack} aria-label={translate("vocabulary:units.clearedProgress", {percent: formatPercent(percent / 100)})}>
          <span style={{width: `${percent}%`}}/>
        </div>
        <p>{translate("vocabulary:units.clearedWords", {cleared: formatNumber(unit.progress.clearedWords), total: formatNumber(unit.progress.totalWords)})}</p>
      </div>
      <dl className={styles.unitStats}>
        <div><dt>{translate("vocabulary:units.words")}</dt><dd>{formatNumber(unit.wordCount)}</dd></div>
        <div><dt>{translate("vocabulary:units.completions")}</dt><dd>{formatNumber(unit.progress.completionCount)}</dd></div>
        <div><dt>{translate("vocabulary:units.readyReview")}</dt><dd>{formatNumber(unit.progress.readyForReview)}</dd></div>
      </dl>
      <div className={styles.unitActions}>
        {activeSession ? (
          <div className={styles.activeSession}>
            <div className={styles.activeSessionCopy}>
              <span className={styles.sessionLabel}><Clock3 size={15}/> {' '}{translate("vocabulary:session.current")}</span>
              <strong>{translate("vocabulary:session.position", {status: activeStatusLabel, mode: activeModeLabel, current: formatNumber(currentCard ?? 0), total: formatNumber(activeSession.totalScheduled)})}</strong>
              <p>
                {blockedByDifferentMode
                  ? translate("vocabulary:session.otherMode", {mode: selectedModeLabel})
                  : translate("vocabulary:session.resumeHelp")}
              </p>
            </div>
            {confirmingEnd ? (
              <div className={styles.endConfirmation} role="alert">
                <p>{translate("vocabulary:session.endConfirm", {mode: activeModeLabel})}</p>
                <div>
                  <button type="button" onClick={() => setConfirmingEnd(false)} disabled={ending}>{translate("vocabulary:session.keep")}</button>
                  <button type="button" className={styles.dangerButton} onClick={() => onEnd(activeSession.id)} disabled={ending}>
                    {ending ? <Clock3 size={16}/> : <Square size={15}/>} {ending ? translate("vocabulary:session.ending") : translate("vocabulary:session.end")}
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.activeSessionButtons}>
                <button type="button" className={styles.resumeButton} onClick={() => onStart(activeSession.mode)} disabled={pending || ending}>
                  {pending ? <Clock3 size={17}/> : null}{pending ? translate('common:navigationControls.resuming') : translate(activeSession.mode === 'TEST' ? 'common:navigationControls.resumeTest' : 'common:navigationControls.resumeRemember')}
                </button>
                <button type="button" className={styles.endButton} onClick={() => setConfirmingEnd(true)} disabled={pending || ending}>
                  <X size={16}/> {' '}{translate("vocabulary:session.end")}</button>
              </div>
            )}
          </div>
        ) : (
          <button type="button" className={styles.startButton} onClick={() => onStart(mode)} disabled={pending}>
            {pending ? <Clock3 size={17}/> : null}{pending ? translate('common:navigationControls.starting') : translate(mode === 'TEST' ? 'common:navigationControls.startTest' : 'common:navigationControls.startRemember')}
          </button>
        )}
      </div>
    </article>
  );
};

export default VocabularyListPage;

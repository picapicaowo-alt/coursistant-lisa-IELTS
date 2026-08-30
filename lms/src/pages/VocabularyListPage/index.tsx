import {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ArrowLeft, ArrowRight, BookOpenCheck, Check, Clock3, Layers3, RefreshCcw, Shuffle, Square, X} from 'lucide-react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import type {StudyMode, VocabularyUnitSummary} from '@/apis/types/vocabulary';
import {vocabularyApi} from '@/apis/services/vocabulary-api';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {PageState} from '@/pages/vocabulary/components/PageState';
import {ProgressRing} from '@/pages/vocabulary/components/ProgressRing';
import {vocabularyQueryKeys} from '@/pages/vocabulary/queryKeys';
import {VOCABULARY_PATHS} from '@/pages/vocabulary/routes';
import {getApiErrorMessage} from '@/utils/apiError';
import styles from './index.module.scss';

const VocabularyListPage = () => {
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

  if (query.isPending) return <main className={styles.page}><PageState kind="loading" title="Loading units" detail="Preparing this list and your current pass…"/></main>;
  if (query.isError || !query.data) return <main className={styles.page}><PageState kind="error" title="This list is unavailable" detail="The list may have moved, or the localhost API may be offline." onRetry={() => void query.refetch()}/></main>;

  const list = query.data;
  return (
    <main className={styles.page}>
      <Link className={styles.backLink} to={VOCABULARY_PATHS.root}><ArrowLeft size={17}/> Vocabulary library</Link>
      <section className={styles.overview}>
        <div className={styles.overviewCopy}>
          <div className={styles.tags}><span>{list.theme}</span><span>{list.skillFocus}</span><span>{list.difficulty}</span></div>
          <h1>{list.name}</h1>
          <p>{list.description}</p>
          <div className={styles.facts}>
            <span><Layers3 size={17}/>{list.units.length} {list.units.length === 1 ? 'unit' : 'units'}</span>
            <span><BookOpenCheck size={17}/>{list.totalWords} words</span>
            <span><RefreshCcw size={17}/>{list.progress.completionCount} complete passes</span>
          </div>
        </div>
        <ProgressRing value={list.progress.clearedWords} max={list.progress.totalWords} label="current pass" size="large"/>
      </section>

      <section className={styles.modeSection} aria-labelledby="mode-heading">
        <div>
          <span className={styles.kicker}>Study setup</span>
          <h2 id="mode-heading">Choose a mode, then a unit</h2>
        </div>
        <div className={styles.modeControls}>
          <div className={styles.segmented} aria-label="Study mode">
            <button type="button" className={mode === 'TEST' ? styles.selected : ''} onClick={() => setMode('TEST')}>
              <Check size={17}/><span><strong>Test</strong><small>Word first · rate to reveal</small></span>
            </button>
            <button type="button" className={mode === 'REMEMBER' ? styles.selected : ''} onClick={() => setMode('REMEMBER')}>
              <BookOpenCheck size={17}/><span><strong>Remember</strong><small>Full card · browse only</small></span>
            </button>
          </div>
          <p className={styles.modeDescription}>
            {mode === 'TEST'
              ? "See the word first. Choose a recall rating—including Don't remember—to reveal the answer."
              : 'See the complete card from the start. Browsing does not record a rating or change completion.'}
          </p>
          <div className={styles.modeOption}>
            {mode === 'REMEMBER' ? (
              <label className={styles.shuffle}>
                <input type="checkbox" checked={shuffle} onChange={event => setShuffle(event.target.checked)}/>
                <Shuffle size={16}/> Shuffle this session
              </label>
            ) : (
              <span className={styles.testNote}><Shuffle size={16}/> Test mode always shuffles</span>
            )}
          </div>
        </div>
      </section>

      {startMutation.isError || endMutation.isError ? (
        <div className={styles.inlineError} role="alert">
          {startMutation.isError
            ? getApiErrorMessage(startMutation.error, 'The session could not start. Review the active session shown below.')
            : getApiErrorMessage(endMutation.error, 'The session could not be ended. It is still available to resume.')}
        </div>
      ) : null}

      <section className={styles.units} aria-label="Units">
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

const modeLabel = (mode: StudyMode): string => mode === 'TEST' ? 'Test' : 'Remember';

const UnitCard = ({unit, mode, pending, ending, onStart, onEnd}: UnitCardProps) => {
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const percent = Math.round((unit.progress.clearedWords / unit.progress.totalWords) * 100);
  const activeSession = unit.activeSession;
  const activeModeLabel = activeSession ? modeLabel(activeSession.mode) : null;
  const activeStatusLabel = activeSession?.status === 'ACTIVE' ? 'Active' : 'Paused';
  const selectedModeLabel = modeLabel(mode);
  const blockedByDifferentMode = Boolean(activeSession && activeSession.mode !== mode);
  const currentCard = activeSession
    ? Math.min(activeSession.position + 1, activeSession.totalScheduled)
    : null;
  return (
    <article className={styles.unitCard}>
      <div className={styles.unitNumber}>{String(unit.number).padStart(2, '0')}</div>
      <div className={styles.unitMain}>
        <span className={styles.kicker}>Unit {unit.number}</span>
        <h3>{unit.name}</h3>
        <div className={styles.progressTrack} aria-label={`${percent}% of current pass cleared`}>
          <span style={{width: `${percent}%`}}/>
        </div>
        <p>{unit.progress.clearedWords} of {unit.progress.totalWords} words cleared in this pass</p>
      </div>
      <dl className={styles.unitStats}>
        <div><dt>Words</dt><dd>{unit.wordCount}</dd></div>
        <div><dt>Completions</dt><dd>{unit.progress.completionCount}</dd></div>
        <div><dt>Ready to review</dt><dd>{unit.progress.readyForReview}</dd></div>
      </dl>
      <div className={styles.unitActions}>
        {activeSession ? (
          <div className={styles.activeSession}>
            <div className={styles.activeSessionCopy}>
              <span className={styles.sessionLabel}><Clock3 size={15}/> Current session</span>
              <strong>{activeStatusLabel} {activeModeLabel} session · card {currentCard} of {activeSession.totalScheduled}</strong>
              <p>
                {blockedByDifferentMode
                  ? `This session must be resumed or ended before ${selectedModeLabel} can start.`
                  : `Continue from the exact saved position, or end this session to start over.`}
              </p>
            </div>
            {confirmingEnd ? (
              <div className={styles.endConfirmation} role="alert">
                <p>End this {activeModeLabel} session? Saved ratings remain, but this position cannot be resumed.</p>
                <div>
                  <button type="button" onClick={() => setConfirmingEnd(false)} disabled={ending}>Keep session</button>
                  <button type="button" className={styles.dangerButton} onClick={() => onEnd(activeSession.id)} disabled={ending}>
                    {ending ? <Clock3 size={16}/> : <Square size={15}/>} {ending ? 'Ending…' : 'End session'}
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.activeSessionButtons}>
                <button type="button" className={styles.resumeButton} onClick={() => onStart(activeSession.mode)} disabled={pending || ending}>
                  {pending ? <Clock3 size={17}/> : null}{pending ? 'Resuming…' : `Resume ${activeModeLabel}`}<ArrowRight size={18}/>
                </button>
                <button type="button" className={styles.endButton} onClick={() => setConfirmingEnd(true)} disabled={pending || ending}>
                  <X size={16}/> End session
                </button>
              </div>
            )}
          </div>
        ) : (
          <button type="button" className={styles.startButton} onClick={() => onStart(mode)} disabled={pending}>
            {pending ? <Clock3 size={17}/> : null}{pending ? 'Starting…' : `Start ${selectedModeLabel}`}<ArrowRight size={18}/>
          </button>
        )}
      </div>
    </article>
  );
};

export default VocabularyListPage;

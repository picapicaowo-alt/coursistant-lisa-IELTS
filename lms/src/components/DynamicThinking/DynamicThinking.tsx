import { useTranslation } from 'react-i18next';
import {useEffect, useState} from 'react';
import styles from './DynamicThinking.module.scss';
import {formatNumber} from '@/i18n/formatting';

export interface ThinkingStep {
  id: string;
  text: string;
  /** Frontend-owned progress retains its semantic key across language changes. */
  translationKey?: string;
}

interface DynamicThinkingProps {
  /**
   * Streaming integrations can append high-level status summaries here.
   * Never pass raw model chain-of-thought.
   */
  steps?: readonly ThinkingStep[];
  fallbackSteps?: readonly ThinkingStep[];
  label?: string;
}

const DEFAULT_FALLBACK_STEPS: readonly ThinkingStep[] = [
  {id: 'understand', text: 'assistant:thinking.understand'},
  {id: 'context', text: 'assistant:thinking.context'},
  {id: 'response', text: 'assistant:thinking.response'},
];

const STEP_REVEAL_INTERVAL_SECONDS = 4;

const DynamicThinking = ({
  steps = [],
  fallbackSteps,
  label,
}: DynamicThinkingProps) => {
  const { t: translate } = useTranslation();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const localizeStep = (step: ThinkingStep) => ({...step, text: step.translationKey ? translate(step.translationKey) : step.text});
  const streamedSteps = steps.map(localizeStep).filter(step => step.text.trim());
  const displayLabel = label ?? translate('assistant:thinking.label');
  const safeFallbackSteps = (fallbackSteps?.map(localizeStep) ?? DEFAULT_FALLBACK_STEPS.map(step => ({...step, text: translate(step.text)}))).filter(step => step.text.trim());
  const fallbackCount = Math.min(
    safeFallbackSteps.length,
    1 + Math.floor(elapsedSeconds / STEP_REVEAL_INTERVAL_SECONDS),
  );
  const visibleSteps = streamedSteps.length > 0
    ? streamedSteps
    : safeFallbackSteps.slice(0, fallbackCount);
  const activeStep = visibleSteps[visibleSteps.length - 1];

  return (
    <section
      className={styles.container}
      aria-label={translate("assistant:thinking.progress")}
      aria-busy="true"
    >
      <div className={styles.header} aria-hidden="true">
        <span>{displayLabel}</span>
        <span className={styles.elapsed}>· {translate('assistant:thinking.elapsed', {seconds: formatNumber(elapsedSeconds)})}</span>
      </div>

      <ol className={styles.steps} aria-hidden="true">
        {visibleSteps.map((step, index) => {
          const isActive = index === visibleSteps.length - 1;
          return (
            <li className={isActive ? styles.activeStep : styles.completedStep} key={step.id}>
              <span className={styles.marker} />
              <span>{step.text}</span>
            </li>
          );
        })}
      </ol>

      <span className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {activeStep ? translate('assistant:thinking.status', {label: displayLabel, step: activeStep.text}) : displayLabel}
      </span>
    </section>
  );
};

export default DynamicThinking;

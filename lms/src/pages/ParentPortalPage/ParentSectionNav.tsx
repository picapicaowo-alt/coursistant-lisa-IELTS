import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import {parentHref, PARENT_LEARNING_TABS, PARENT_SCHEDULE_TABS, type ParentSection} from '@/configs/parentNavigation';
import styles from './index.module.scss';

export function ParentSectionNav({section, params}: {section: ParentSection; params: URLSearchParams}) {
  const {t} = useTranslation();
  const tabs = section === 'learning' ? PARENT_LEARNING_TABS : section === 'schedule' ? PARENT_SCHEDULE_TABS : null;
  if (tabs) {
    const selected = tabs.find(tab => tab.id === params.get('tab'))?.id ?? tabs[0].id;
    return <nav className={styles.tabs} aria-label={t(section === 'learning' ? 'navigation:parent.learningViews' : 'navigation:parent.scheduleViews')}>
      {tabs.map(tab => <Link key={tab.id} to={parentHref(section, params, tab.id)} aria-current={selected === tab.id ? 'page' : undefined}>{t(tab.label)}</Link>)}
    </nav>;
  }
  if (section === 'messages' || section === 'notifications') return <nav className={styles.tabs} aria-label={t('navigation:parent.messageViews')}>
    <Link to={parentHref('messages', params)} aria-current={section === 'messages' ? 'page' : undefined}>{t('navigation:parent.conversation')}</Link>
    <Link to={parentHref('notifications', params)} aria-current={section === 'notifications' ? 'page' : undefined}>{t('navigation:parent.notifications')}</Link>
  </nav>;
  return null;
}

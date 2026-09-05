import {formatNumber} from '@/i18n/formatting';
import {useTranslation} from 'react-i18next';
import {Lock, Users} from 'lucide-react';
import {Link} from 'react-router-dom';
import type {CourseGroupSet} from '@/apis';
import styles from './index.module.scss';

interface Props { courseId: number; groupSets: CourseGroupSet[]; failed: boolean; canManage: boolean; }

export const GroupsCard = ({courseId, groupSets, failed, canManage}: Props) => {
  const {t: translate} = useTranslation();
  return <section className={styles.card}>
  <div className={styles.cardHeader}><h2 className={styles.cardTitle}>{translate("courseTools:groups.groups")}</h2><Link to={`/course/${courseId}/groups`} className={styles.addButton}>{canManage ? translate("course:workspace.manageGroups") : translate("common:actions.viewAll")}</Link></div>
  {failed ? <p className={styles.cardEmpty} role="alert">{translate("course:workspace.groupsFailed")}</p> : groupSets.length === 0 ? <p className={styles.cardEmpty}>{translate("course:workspace.groupsEmpty")}</p> : <ul className={styles.rowList}>{groupSets.slice(0, 4).map(item => {
    const myGroup = item.myGroup ? item.groups.find(group => group.id === item.myGroup?.groupId) : null;
    return <li className={styles.row} key={item.id}><Link className={styles.rowLink} to={`/course/${courseId}/group-sets/${item.id}`}><span className={styles.eventBadge}>{item.locked ? <Lock size={16}/> : <Users size={16}/>}</span><span className={styles.rowTitle}>{item.name}</span><span className={styles.rowMeta}>{myGroup?.name || translate('courseTools:subject.groupCount', {count: item.groups.length, number: formatNumber(item.groups.length)})}</span></Link></li>;
  })}</ul>}
</section>;
};

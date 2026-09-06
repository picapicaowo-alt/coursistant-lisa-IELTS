import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';

const NotFoundPage = () => {
  const {t} = useTranslation('common');
  return (
  <main role="alert" style={{padding: '3rem 1.5rem', textAlign: 'center'}}>
    <h1>{t('feedback.pageNotFound')}</h1>
    <p>{t('feedback.unknownUrl')}</p>
    <p><Link to="/">{t('actions.backToHome')}</Link></p>
  </main>
  );
};

export default NotFoundPage;

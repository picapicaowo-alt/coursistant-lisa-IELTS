import {createRoot} from 'react-dom/client'
import './styles/tokens.global.scss'
import './index.css'
import App from './App'
import {QueryProvider} from "@/providers/QueryProvider";
import React from "react";
import i18n from './i18n';
import {installNativeValidationLocalization} from './i18n/nativeValidation';
import {enableMapSet} from "immer"
import {getAppEnv} from '@/config/env';

enableMapSet();
getAppEnv();
const disposeValidationLocalization = installNativeValidationLocalization(i18n, document);
if (import.meta.hot) import.meta.hot.dispose(disposeValidationLocalization);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryProvider>
      <App/>
    </QueryProvider>
  </React.StrictMode>,
);

import React from "react";
import styles from "./index.module.scss";

interface IconButtonProps {
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  title: string;
  width?: number;
}

export const IconButton: React.FC<IconButtonProps & { type?: 'delete' | 'edit' | 'view' }> = ({
                                                                                               onClick,
                                                                                               title,
                                                                                               width = 24,
                                                                                               type = 'delete',
                                                                                             }) => {
  const iconWidth = `${Math.round(width * 2 / 3)}`;
  
  const getIcon = () => {
    switch (type) {
      case 'delete':
        return <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>;
      case 'edit':
        return (
          <>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </>
        );
      case 'view':
        return (
          <>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </>
        );
      default:
        return null;
    }
  };
  
  return (
    <button
      className={`${styles.actionButton} ${styles[type]}`}
      onClick={onClick}
      title={title}
    >
      <svg width={iconWidth} height={iconWidth} viewBox={`0 0 ${width} ${width}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {getIcon()}
      </svg>
    </button>
  )
}
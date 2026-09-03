import {useLayoutEffect, useState} from 'react';

export function useDashboardSizing() {
  const [canvas, canvasRef] = useState<HTMLDivElement | null>(null);
  const [table, tableRef] = useState<HTMLDivElement | null>(null);
  const [intakePageSize, setIntakePageSize] = useState(5);
  const [advisorPageSize, setAdvisorPageSize] = useState(3);

  useLayoutEffect(() => {
    if (!canvas || !table || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const style = getComputedStyle(table);
      const rowHeight = Number(style.getPropertyValue('--intake-row-px'));
      const headingHeight = Number(style.getPropertyValue('--intake-heading-px'));
      if (rowHeight > 0 && table.clientHeight > 0) {
        // CSS owns the row geometry. Only request as many records as can be
        // read without scrolling; page/size are existing backend parameters.
        setIntakePageSize(Math.max(1, Math.min(12, Math.floor((table.clientHeight - headingHeight) / rowHeight))));
      }
      const advisorSize = Number(getComputedStyle(canvas).getPropertyValue('--advisor-page-size'));
      if (advisorSize > 0) setAdvisorPageSize(advisorSize);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    observer.observe(table);
    measure();
    return () => observer.disconnect();
  }, [canvas, table]);

  return {canvasRef, tableRef, intakePageSize, advisorPageSize};
}

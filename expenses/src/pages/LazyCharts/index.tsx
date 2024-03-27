import React, { Suspense } from 'react';

const LazyCharts = () => {
  const Charts = React.lazy(() => import('@pages//Charts'));
  return (
    <Suspense fallback="">
      <Charts />
    </Suspense>
  );
};

export default LazyCharts;
